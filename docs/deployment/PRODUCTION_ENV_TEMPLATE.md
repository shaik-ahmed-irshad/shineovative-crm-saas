# Shineovative WhatsApp CRM — Production Environment Variables Template

> **CRITICAL SECURITY NOTICE:**
> Never commit actual production credentials or secret keys into Git.
> Enter these environment variables directly into your hosting platform settings (e.g. Vercel Environment Variables, Docker/Coolify Secrets) and your production server environment.

---

## 1. Core Platform & Database Settings (Required)

```env
# Public URL of your deployed CRM instance (e.g., https://crm.shineovative.com)
NEXT_PUBLIC_SITE_URL="https://crm.shineovative.com"

# Public Supabase URL (from Supabase Project Settings -> API)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"

# Public Supabase Anonymous Key (from Supabase Project Settings -> API)
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Server-Only Supabase Service Role Key (NEVER expose to client browser!)
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Database Direct Connection String (for running migrations during deployment)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Server-Only 64-character Hex Encryption Key (Used for encrypting API keys & secrets at rest)
# Generate a new random key using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
```

---

## 2. Authentication & Access Control (Required)

```env
# Disable public self-registration for internal company deployment (only admin invitations allowed)
NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP="false"

# Optional comma-separated domain whitelist for invitations (e.g., shineovative.com)
ALLOWED_INVITE_HOSTS="shineovative.com"
```

---

## 3. Meta WhatsApp Cloud API (Required for WhatsApp Messaging)

```env
# Meta App Secret (from Meta for Developers -> App Settings -> Basic)
META_APP_SECRET="your_meta_app_secret_here"

# Webhook Verification Token (invent a secret phrase for Meta Webhook verification handshake)
WHATSAPP_WEBHOOK_VERIFY_TOKEN="your_custom_webhook_verify_token_phrase"

# Default Phone Number ID (from Meta WhatsApp -> API Setup)
WHATSAPP_PHONE_NUMBER_ID="your_whatsapp_phone_number_id"

# System User Permanent Access Token (from Meta Business Manager -> System Users)
WHATSAPP_ACCESS_TOKEN="EAAG..."

# Set to false for live production message sending
WHATSAPP_TEMPLATES_DRY_RUN="false"
```

---

## 4. Automation Cron & Scheduler (Required for Scheduled Campaigns & Automations)

```env
# Secret authorization token for triggering scheduled workflows (/api/automations/cron)
# Send in header: Authorization: Bearer YOUR_CRON_SECRET
CRON_SECRET="your_custom_cron_secret_token"
```

---

## 5. AI Assistant Credentials (Optional — BYO Key)

```env
# OpenAI API Key for AI Assistant & auto-reply drafting (BYO key)
OPENAI_API_KEY="sk-proj-..."

# Anthropic API Key (if using Claude models)
ANTHROPIC_API_KEY="sk-ant-..."
```
