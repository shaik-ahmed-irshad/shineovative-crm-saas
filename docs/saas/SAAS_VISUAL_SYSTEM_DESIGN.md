# Shineovative WhatsApp CRM SaaS — Visual System Design & Architecture

> **Purpose:** This document provides an exhaustive, visual end-to-end blueprint of the Shineovative WhatsApp CRM SaaS system architecture, data flows, multi-tenant isolation, webhook dispatching, unified billing, and database entity relationships.

---

## 1. High-Level Platform Architecture

The platform is designed as a cloud-native, high-concurrency, single-database multi-tenant system. All tenant operations are isolated at the database engine level via PostgreSQL Row Level Security (RLS).

```mermaid
flowchart TD
    subgraph Clients["Clients & Users"]
        WebUser["🏢 Tenant Team & Agents<br>(Desktop / Mobile Browser)"]
        SuperUser["👑 Platform Super Admin<br>(/super-admin Control Plane)"]
        EndCustomer["📱 End Customers<br>(WhatsApp App)"]
    end

    subgraph EdgeTier["Edge & Presentation Layer (Next.js 15 Standalone)"]
        EdgeMW["🛡️ Edge Middleware<br>Tenant Gating • Session Check • Subdomain Resolver"]
        AppRoutes["⚡ Next.js App Router (51+ Routes)<br>Dashboard • Chats • Pipelines • Automations"]
        SuperRoutes["🔐 Super Admin Route Group<br>(/super-admin/*)"]
        APIRoutes["🔌 API & Webhook Endpoints<br>/api/webhooks/whatsapp<br>/api/webhooks/billing<br>/api/billing/checkout"]
    end

    subgraph DataTier["Data & Security Layer (Supabase Cloud)"]
        SupaAuth["🔑 Supabase Auth (GoTrue)<br>JWT Tokens • PKCE • Claims: account_id, platform_role"]
        SupaDB["🗄️ PostgreSQL Database (41+ Schemas)<br>Strict Row-Level Security (RLS) Engine"]
        SupaRealtime["⚡ Supabase Realtime Engine<br>WebSockets • Multi-Tenant Channel Filtering"]
        SupaStorage["📦 Supabase Storage Buckets<br>Path Partitioned: tenants/{account_id}/media/*"]
    end

    subgraph ExternalIntegrations["External Third-Party Ecosystem"]
        MetaWABA["💬 Meta WhatsApp Cloud API<br>(Direct Webhooks & Message Dispatch)"]
        RazorpayGW["💳 Razorpay Gateway<br>(India: UPI, Domestic Cards, NetBanking)"]
        StripeGW["💳 Stripe Gateway<br>(Global: International Cards, Multi-Currency)"]
        AIProviders["🤖 AI Engine (BYO-Key / Managed)<br>(OpenAI, Anthropic, OpenRouter)"]
        EmailProvider["📧 Email Dispatch (Resend / AWS SES)<br>(Team Invites, Billing Receipts)"]
    end

    %% Connections
    WebUser -->|HTTPS / WSS| EdgeMW
    SuperUser -->|HTTPS| EdgeMW
    EdgeMW -->|Authorized Tenant Session| AppRoutes
    EdgeMW -->|Verified Super Admin| SuperRoutes
    EdgeMW -->|Public / Signature Webhooks| APIRoutes

    AppRoutes -->|JWT Auth Context| SupaAuth
    AppRoutes -->|RLS-Scoped Queries| SupaDB
    AppRoutes -->|Live Chat Streams| SupaRealtime
    AppRoutes -->|Encrypted Outbound Call| MetaWABA
    AppRoutes -->|AI Summaries & Drafts| AIProviders
    AppRoutes -->|Uploads / Voice Notes| SupaStorage

    SuperRoutes -->|Bypass RLS via Security Definer| SupaDB

    APIRoutes -->|Save Inbound Chat & Media| SupaDB
    APIRoutes -->|Update Subscriptions| SupaDB

    EndCustomer <-->|Encrypted WhatsApp Protocol| MetaWABA
    MetaWABA -->|HTTP POST Signed Webhook| APIRoutes

    AppRoutes -->|Create Session| RazorpayGW
    AppRoutes -->|Create Checkout| StripeGW
    RazorpayGW -->|Signed Webhook Event| APIRoutes
    StripeGW -->|Signed Webhook Event| APIRoutes
    AppRoutes -->|Transactional Emails| EmailProvider
```

---

## 2. Multi-Tenant Request Isolation & RLS Gating Flow

Every single inbound client request travels through a 4-layer security barrier before accessing database records. Data isolation is physically enforced by the PostgreSQL query planner.

```mermaid
sequenceDiagram
    autonumber
    actor User as Tenant Agent (Org A)
    participant MW as Edge Middleware
    participant Route as Next.js Server Action / API
    participant Auth as Supabase Auth (JWT)
    participant DB as PostgreSQL RLS Engine
    participant OrgA as Org A Records
    participant OrgB as Org B Records (Hidden)

    User->>MW: Request: GET /contacts (Cookie: sb-access-token)
    MW->>MW: Verify Session Cookie Integrity
    MW->>Route: Forward Request with verified headers
    Route->>Auth: Resolve JWT Claims (auth.uid, account_id)
    Route->>DB: Execute Query: SELECT * FROM contacts;
    Note over DB: PostgreSQL executes RLS Policy:<br/>USING (account_id = auth.current_account_id())
    DB->>OrgA: Matches account_id == Org A UUID
    DB--xOrgB: BLOCKED: account_id != Org A UUID (Zero Leakage)
    DB-->>Route: Return ONLY Org A Contacts
    Route-->>User: Render Contacts Table
```

---

## 3. Multi-Tenant Inbound WhatsApp Event Routing

Multiple independent businesses share the same application webhook endpoint, but their messages and customer chats are strictly routed based on the Meta `phone_number_id`.

```mermaid
flowchart TD
    MetaWebhook["📡 Incoming Meta Webhook POST<br>/api/webhooks/whatsapp"] --> CheckSig{"🔐 Verify Signature<br>X-Hub-Signature-256 == App Secret?"}
    
    CheckSig -- "Invalid / Tampered" --> Reject401["❌ HTTP 401 Unauthorized<br>(Logged to saas_audit_logs)"]
    CheckSig -- "Valid" --> ParsePayload["📦 Extract Payload<br>phone_number_id & message body"]

    ParsePayload --> LookupTenant{"🔍 Query DB:<br>whatsapp_configs WHERE<br>phone_number_id = payload.phone_number_id"}

    LookupTenant -- "Not Found" --> Ignore["⚠️ Unregistered Number<br>Return HTTP 200 (Drop event)"]
    LookupTenant -- "Found (account_id: Org-123)" --> CheckStatus{"Tenant Status Check:<br>accounts.status IN ('active', 'trialing')?"}

    CheckStatus -- "Suspended / Unpaid" --> StoreOnly["📥 Save Message to DB<br>(Suppress Live Automation & Auto-Reply)"]
    CheckStatus -- "Active" --> ProcessInbound["✅ Full Processing:"]

    ProcessInbound --> Step1["1. Match or Create Contact (account_id = Org-123)"]
    Step1 --> Step2["2. Insert Message (account_id = Org-123)"]
    Step2 --> Step3["3. Trigger Active Automations & Bot Responses"]
    Step3 --> Step4["4. Broadcast to Realtime WebSocket Room: `account:Org-123:chat`"]

    Step4 --> LiveAgents["🖥️ Org-123 Agents See Instant Incoming Chat"]
```

---

## 4. Unified Billing & Payment Flow (Razorpay + Stripe)

A clean, unified checkout experience that automatically presents India-optimized payment methods (UPI, NetBanking) or International payment options (Stripe Global Cards) without complicating the business model.

```mermaid
flowchart TD
    User["🏢 Organization Owner"] --> ClickSubscribe["Click: 'Activate All-In-One Subscription'"]
    ClickSubscribe --> ChooseBilling["Select Billing Cycle:<br>• Monthly (₹2,999 / $39)<br>• Annual (₹28,790 / $375)"]

    ChooseBilling --> GeoCheck{"Customer Location / Currency?"}

    %% Razorpay Path
    GeoCheck -- "India / INR" --> RzpOrder["Backend: Create Razorpay Subscription<br>/api/billing/checkout"]
    RzpOrder --> RzpModal["Client: Open Razorpay Standard Checkout Modal<br>(UPI, PhonePe, GPay, Paytm, Cards, NetBanking)"]
    RzpModal --> RzpSuccess["Customer Authorizes Payment"]
    RzpSuccess --> RzpHook["📡 Razorpay Webhook: subscription.charged"]

    %% Stripe Path
    GeoCheck -- "International / USD" --> StripeSession["Backend: Create Stripe Checkout Session<br>/api/billing/checkout"]
    StripeSession --> StripeRedirect["Client: Redirect to Stripe Hosted Checkout<br>(Visa, MC, Amex, Apple Pay, Google Pay)"]
    StripeRedirect --> StripeSuccess["Customer Completes Checkout"]
    StripeSuccess --> StripeHook["📡 Stripe Webhook: checkout.session.completed"]

    %% Unified Webhook Handler
    RzpHook --> UnifiedDispatcher["🛡️ Unified Webhook Dispatcher<br>/api/webhooks/billing"]
    StripeHook --> UnifiedDispatcher

    UnifiedDispatcher --> VerifyCrypt["1. Verify Cryptographic Webhook Signature"]
    VerifyCrypt --> UpdateSub["2. Update `subscriptions` table:<br>status = 'active', current_period_end = NOW() + 1 Month/Year"]
    UpdateSub --> UpdateOrg["3. Update `accounts` table: status = 'active'"]
    UpdateOrg --> SendReceipt["4. Save `billing_invoices` & Email Receipt to Owner"]
```

---

## 5. Customer Self-Serve Onboarding Flow

```mermaid
stateDiagram-v2
    [*] --> Registration: User visits /signup
    Registration --> Verification: Enter Name, Org Name, Work Email & Password
    Verification --> TenantBootstrap: Supabase Auth triggers atomic Tenant Bootstrap
    
    state TenantBootstrap {
        [*] --> CreateOrg: Insert accounts (Organization)
        CreateOrg --> CreateOwner: Insert profile + account_members (role: 'owner')
        CreateOwner --> SeedPipelines: Seed Sales Stages (Lead, Qualified, Won, Lost)
        SeedPipelines --> SeedTags: Seed Default Tags & Quick Replies
        SeedTags --> [*]
    }

    TenantBootstrap --> OnboardingWizard: Redirect to /onboarding
    
    state OnboardingWizard {
        Step1_OrgProfile: Step 1 • Workspace Profile (Logo, Timezone, Currency)
        Step2_TeamInvite: Step 2 • Invite Initial Team Members
        Step3_WABA: Step 3 • Connect WhatsApp Business Account
        Step1_OrgProfile --> Step2_TeamInvite
        Step2_TeamInvite --> Step3_WABA
    }

    OnboardingWizard --> LiveDashboard: Launch Complete! Redirect to /dashboard
    LiveDashboard --> [*]
```

---

## 6. Super Admin Control Plane vs Tenant Separation

```mermaid
flowchart LR
    subgraph PublicInternet["Public Web"]
        Visitor["Prospective Customer"]
    end

    subgraph TenantDomain["Tenant Application Space (/dashboard/*)"]
        OrgAdmin["Tenant Owner / Admin"]
        Agent["Support / Sales Agent"]
    end

    subgraph PlatformControlPlane["Platform Administration (/super-admin/*)"]
        SuperAdmin["👑 Shineovative Super Admin"]
    end

    subgraph GuardLayer["Security Enforcement Engine"]
        TenantRLS["PostgreSQL RLS Filter<br>account_id = current_user_account_id()"]
        SuperRoleCheck["Role-Based Middleware Gate<br>profiles.platform_role == 'super_admin'"]
    end

    subgraph UnifiedDatabase["Single High-Security Database"]
        TenantData["Tenant Tables<br>contacts • deals • messages"]
        PlatformData["Platform Tables<br>accounts • subscriptions • saas_audit_logs"]
    end

    Visitor -->|Access /signup| TenantDomain
    OrgAdmin -->|Read/Write own org| TenantRLS
    Agent -->|Read/Write assigned items| TenantRLS
    TenantRLS --> TenantData

    SuperAdmin -->|Access /super-admin| SuperRoleCheck
    SuperRoleCheck -->|Security Definer RPCs| PlatformData
    SuperRoleCheck -.->|Audit-Logged View-As Mode| TenantData
```

---

## 7. Multi-Tenant Database Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    accounts ||--o{ account_members : "has members"
    accounts ||--o{ subscriptions : "has billing"
    accounts ||--o{ billing_invoices : "has receipts"
    accounts ||--o{ contacts : "owns"
    accounts ||--o{ conversations : "owns"
    accounts ||--o{ pipelines : "owns"
    accounts ||--o{ whatsapp_configs : "owns credentials"
    accounts ||--o{ saas_audit_logs : "tracks actions"

    profiles ||--o{ account_members : "belongs to"
    profiles ||--o{ messages : "sends"
    profiles ||--o{ deals : "assigned to"

    pipelines ||--o{ stages : "contains"
    stages ||--o{ deals : "contains"
    contacts ||--o{ deals : "linked with"
    contacts ||--o{ conversations : "participates in"
    conversations ||--o{ messages : "contains"

    accounts {
        uuid id PK
        string name
        string slug
        string status "active | trialing | past_due | suspended"
        timestamptz created_at
    }

    profiles {
        uuid id PK
        string email
        string full_name
        string platform_role "super_admin | support | none"
        timestamptz created_at
    }

    account_members {
        uuid id PK
        uuid account_id FK
        uuid user_id FK
        string role "owner | admin | agent | viewer"
    }

    subscriptions {
        uuid id PK
        uuid account_id FK
        string gateway "stripe | razorpay"
        string customer_id
        string subscription_id
        string billing_cycle "monthly | annual"
        string currency "INR | USD"
        string status "active | past_due | cancelled"
        timestamptz current_period_end
    }

    whatsapp_configs {
        uuid id PK
        uuid account_id FK
        string phone_number_id "Indexed for Webhook Routing"
        string waba_id
        text encrypted_access_token
        boolean is_active
    }

    contacts {
        uuid id PK
        uuid account_id FK
        string phone_number
        string name
        jsonb metadata
    }

    conversations {
        uuid id PK
        uuid account_id FK
        uuid contact_id FK
        string status "open | pending | closed"
    }

    messages {
        uuid id PK
        uuid account_id FK
        uuid conversation_id FK
        text body
        string direction "inbound | outbound"
        string status "sent | delivered | read | failed"
    }
```
