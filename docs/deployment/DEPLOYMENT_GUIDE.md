# Shineovative WhatsApp CRM — Production Deployment Guide

> **Goal:** Deploy the Shineovative WhatsApp CRM to a secure, high-availability production environment.

---

## Deployment Architecture Overview

```
[ WhatsApp Customer ]
        │
        ▼ (Meta Cloud API)
[ Meta Webhook Callback ] ──► [ https://crm.shineovative.com/api/whatsapp/webhook ]
                                      │
                                      ▼
                           [ Next.js Application (Vercel/Node) ]
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
            [ Supabase Auth & DB ]        [ Supabase Storage ]
           (PostgreSQL 17 + RLS)         (Avatars & Chat Media)
```

---

## Phase 1: Database Setup (Supabase Production Project)

1. **Create Supabase Project**:
   * Log into [supabase.com](https://supabase.com) and create a new production project.
   * Region recommendation: Select AWS region closest to your primary user base (e.g. `ap-south-1` Mumbai).
2. **Apply Migrations**:
   * Connect to production database via Supabase CLI:
     ```bash
     npx supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"
     ```
   * Confirm migrations `001_initial_schema.sql` through `040_conversation_followups.sql` execute cleanly in sequence.
3. **Storage Buckets**:
   * Migration `008` and `019` automatically configure storage buckets for avatars (`profile-avatars`) and chat attachments (`chat-media`).

---

## Phase 2: Application Hosting (Vercel or Node.js Container)

### Option A: Vercel Deployment (Recommended)
1. Push local Git repository to your private GitHub repository.
2. Import project into Vercel Dashboard.
3. Set Framework Preset: `Next.js`.
4. Configure Environment Variables (refer to [`PRODUCTION_ENV_TEMPLATE.md`](file:///c:/Users/Shinovative%20Solution/Desktop/shine/201-wacrm-main/docs/deployment/PRODUCTION_ENV_TEMPLATE.md)).
5. Deploy.

### Option B: Self-Hosted Docker / Node.js Container
1. Build production image:
   ```bash
   npm run build
   npm start
   ```
2. Place Nginx reverse proxy in front of port 3000 with SSL termination (`Certbot`/Let's Encrypt).

---

## Phase 3: Meta WhatsApp Business Cloud API Configuration

1. **Webhook Callback URL**:
   * Configure Webhook URL in Meta for Developers -> WhatsApp -> Configuration:
     `https://crm.shineovative.com/api/whatsapp/webhook`
   * Set Verify Token to match `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
2. **Webhook Subscriptions**:
   * Subscribe to fields: `messages`, `message_template_status_update`.
3. **System User Access Token**:
   * Generate a permanent System User Token in Meta Business Manager with permissions:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`

---

## Phase 4: Operational Cron & Automation Scheduler

Set up a recurring HTTP cron trigger every minute or 5 minutes:
* **Vercel Cron**: `vercel.json` contains cron configuration for `/api/automations/cron`.
* **External Cron (e.g. cron-job.org or crontab)**:
  ```bash
  */5 * * * * curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://crm.shineovative.com/api/automations/cron
  ```

---

## Phase 5: Backup & Rollback Procedures

* **Database Backups**: Enable Supabase Daily Automated Backups (Point-in-Time Recovery enabled for Pro plan).
* **Application Rollback**: In Vercel, click "Instant Rollback" to revert to the previous deployment commit if an issue is discovered.
