# Shineovative WhatsApp CRM SaaS — Customer Onboarding & Authentication Flow

## 1. Overview

This document specifies the end-to-end self-service onboarding journey for new SaaS customers: from landing on the registration page, bootstrapping an isolated organization, configuring their business profile, connecting WhatsApp, and inviting colleagues.

---

## 2. The Customer Onboarding Journey

```text
[ /signup ] ──► [ Bootstrap Tenant ] ──► [ /onboarding ] ──► [ /dashboard ]
 (Register)      (accounts + owner)      Step 1: Company Profile
                                         Step 2: WhatsApp Setup
                                         Step 3: Team Invites
```

---

## 3. Step-by-Step Flow Specification

### Step 1: Registration (`/signup`)
- **User Inputs**:
  - Full Name
  - Business Email
  - Password (min 8 characters, mixed case, number)
  - Company / Organization Name (e.g. "Apex Solar Solutions")
- **Action**:
  - Submits to `supabase.auth.signUp()`.
  - Passes `company_name` in `options.data`.
  - Database trigger `handle_new_user()` executes atomically:
    1. Creates new `accounts` row (`name = company_name`, `slug = generated_slug`, `status = 'active'`).
    2. Creates `profiles` row with `account_role = 'owner'`.
    3. Provisions a 14-day Free Trial subscription.
    4. Seeds default sales pipeline stages (New Lead → Qualified → Proposal → Won / Lost).
    5. Seeds default CRM tags (Hot Lead, Follow-up, High Value).

---

### Step 2: The 3-Step Onboarding Wizard (`/onboarding`)

When an organization owner signs in for the first time without completed setup, they are guided through a sleek 3-step wizard:

#### Screen 1: Company & Regional Profile
- **Fields**:
  - Organization Display Name
  - Currency Selection (`INR ₹`, `USD $`, `EUR €`, `AED د.إ`, `GBP £`)
  - Time Zone Selection (defaults to browser locale, e.g. `Asia/Kolkata`)
  - Company Logo Upload (stored in `profile-avatars/{account_id}/logo.webp`)

#### Screen 2: WhatsApp Business API Setup
- Clear guidance on connecting the official Meta WhatsApp Cloud API:
  - **Phone Number ID**: Direct ID from Meta App Dashboard.
  - **WABA ID**: WhatsApp Business Account ID.
  - **Permanent Access Token**: System User Access Token.
- **Dry-Run / Test Mode Toggle**:
  - Allows customers to explore the CRM interface and test internal workflows even before their Meta WABA approval is finalized.

#### Screen 3: Invite Team Members
- Fast multi-invite input:
  - Add up to 3 team members by email.
  - Select role (`Admin`, `Agent`, `Viewer`).
  - Sends immediate invitation emails with secure tokens (`/join/[token]`).

#### Completion:
- Displays celebratory confirmation.
- Directs user to `/dashboard` with a "Quick Start Tour" checklist.

---

## 4. Team Member Invitation & Joining Mechanics

Existing tenants frequently add sales agents and support reps. The invitation system guarantees users join the correct organization:

```text
[ Admin sends invite ]
         │
         ▼
[ Insert into invitations table ]
(account_id, email, role, token, expires_at)
         │
         ▼
[ Email sent with link: https://app.domain.com/join/{token} ]
         │
         ▼
[ Invitee visits /join/{token} ]
         │
         ├── New User: Enters name & sets password ──► Created in auth.users & added to account_members
         │
         └── Existing User: Signs in ───────────────► Linked to account_members for this organization
```

### Security Guarantees:
- Invitation tokens are cryptographically random 64-hex strings.
- Tokens expire after 7 days or upon first redemption.
- Redemptions are processed via atomic database RPC `redeem_invitation(token)` running with `SECURITY DEFINER` to prevent race conditions or duplicate joins.
