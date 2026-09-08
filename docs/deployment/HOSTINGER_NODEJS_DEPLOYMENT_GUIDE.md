# Hostinger Node.js Web Application Deployment Guide

## Overview

This guide provides a repeatable terminal & hPanel workflow for deploying the Next.js CRM application to a Hostinger Node.js Web Application environment (e.g. `crm.solarcubic.in`).

---

## Deployment Architecture

```text
[ Browser / WhatsApp Webhook ]
              │
              ▼
    [ crm.solarcubic.in ]
              │
   (Hostinger Node.js Web App)
     .next/standalone/server.js
              │
              ▼
   [ Supabase Cloud Database ]
  https://wzsiuxicagohbfqnnktf.supabase.co
```

---

## Requirements & Environment Variables

Make sure the following production variables are configured in Hostinger environment or `.env.production`:

| Variable | Description | Type |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://crm.solarcubic.in` | Public |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wzsiuxicagohbfqnnktf.supabase.co` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Cloud Anon Key | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Cloud Service Role Key | Server-only |
| `ENCRYPTION_KEY` | 64-hex Encryption Key | Server-only |
| `META_APP_SECRET` | Meta App Secret | Server-only |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Business Phone Number ID | Server-only |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification secret | Server-only |
| `AUTOMATION_CRON_SECRET` | Cron protection secret | Server-only |

---

## Deployment Workflow (Step-by-Step)

### Option A: Deployment via Hostinger hPanel UI (Git / Node.js Manager)

1. **Hostinger hPanel → Websites → Node.js Web Applications**:
   - Create new Web Application or select `crm.solarcubic.in`.
   - Node.js Version: Select `20.x` or `22.x`.
   - Application Root: `public_html` or domain folder.
   - Application Startup File: `.next/standalone/server.js` or `server.js`.

2. **Build Production Application Locally**:
   ```bash
   npm run build
   ```
   *(Generates standalone bundle at `.next/standalone/`)*.

3. **Deploy Artifacts**:
   - Copy `.next/standalone/`, `.next/static/` (to `.next/standalone/.next/static/`), and `public/` (to `.next/standalone/public/`).
   - Start Node application in hPanel.

---

### Option B: Terminal / SSH Deployment

1. **SSH Connection**:
   ```bash
   ssh -p 65002 u123456789@ssh.hostinger.com
   ```

2. **Navigate to App Directory & Pull Latest Code**:
   ```bash
   cd ~/domains/solarcubic.in/public_html/crm
   git pull origin main
   ```

3. **Install & Build**:
   ```bash
   npm install --production=false
   npm run build
   ```

4. **Start/Restart Node Process**:
   ```bash
   pm2 restart crm || pm2 start .next/standalone/server.js --name "crm"
   ```

---

## Post-Deployment Verification

1. Access `https://crm.solarcubic.in/login` in browser.
2. Confirm login page renders cleanly without missing styles/assets.
3. Test authentication and API endpoint connectivity (`/api/health` or `/login`).
