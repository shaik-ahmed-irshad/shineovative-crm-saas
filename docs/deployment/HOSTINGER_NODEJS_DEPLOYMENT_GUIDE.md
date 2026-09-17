# Shineovative WhatsApp CRM SaaS — Hostinger Node.js Deployment Guide

## Overview

This guide provides the complete, step-by-step procedure for deploying the **Shineovative WhatsApp CRM SaaS** application to a **Hostinger Node.js Web Application** environment (e.g. `app.shineovative.com`, `crm.shineovative.com`, or staging subdomain).

---

## Deployment Architecture

```text
[ Browser / Tenant Clients / WhatsApp Webhook ]
                      │
                      ▼
     [ Hostinger Node.js Application ]
       (e.g. app.shineovative.com)
     Next.js Standalone (.next/standalone)
                      │
                      ▼
       [ Supabase Cloud Database ]
  https://vbsnouijwjmjvprsxxhl.supabase.co
    (Dedicated Staging: saas-wa-staging)
```

---

## Required Production Environment Variables & Secrets

Configure these environment variables in **Hostinger hPanel → Websites → Node.js → Environment Variables** (or in `.env.production` in your application root on Hostinger):

| Variable | Staging / Production Value | Description |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://app.shineovative.com` | Canonical URL of your SaaS platform |
| `NEXT_PUBLIC_APP_LOCALE` | `en` | Default language locale |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://vbsnouijwjmjvprsxxhl.supabase.co` | Dedicated Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZic25vdWlqd2ptanZwcnN4eGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NDk1MTksImV4cCI6MjEwNTEyNTUxOX0.YpApXzmjt38yaOM0gIRP2dBQZisS44fUeysTI9V6468` | Supabase Anonymous Client Key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZic25vdWlqd2ptanZwcnN4eGhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTU0OTUxOSwiZXhwIjoyMTA1MTI1NTE5fQ.z-a1Tqdwd_WYDkhxd-esZUebH355ItnyHUMiYTHRCVw` | Server-only Supabase Service Role Key |
| `ENCRYPTION_KEY` | `2091729b2ac9cad5eda2c9966a9d36e33f7bb074b796bbbf1f3cb877f74ab028` | AES-256-GCM 64-hex key for tenant WhatsApp tokens |
| `META_APP_SECRET` | `0d562c31e1aa7ba8e92b2b4557dc5e29` | Meta Developer App Secret for webhook HMAC validation |
| `META_APP_ID` | `109283746501928` | Meta Developer App ID for Embedded Signup |
| `CRON_SECRET` | `shineovative_saas_cron_secret_72` | Secret for `/api/cron/maintenance` platform runner |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Stripe secret key for USD card checkouts |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe webhook signing secret |
| `RAZORPAY_KEY_ID` | `rzp_test_...` | Razorpay Key ID for INR UPI checkouts |
| `RAZORPAY_KEY_SECRET` | `mock_secret...` | Razorpay Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | `mock_webhook_secret...` | Razorpay webhook secret |
| `PORT` | `3000` | Port assigned by Hostinger reverse proxy |

---

## Deployment Workflow (Step-by-Step)

### Step 1: Subdomain Setup in Hostinger
1. In **Hostinger hPanel**, navigate to **Websites** $\to$ **Domains / Subdomains**.
2. Create a subdomain (e.g. `app.shineovative.com` or `crm.shineovative.com`).
3. Ensure SSL certificate (Let's Encrypt) is installed and active for the subdomain.

### Step 2: Configure Node.js Web Application
1. In **Hostinger hPanel**, go to **Websites** $\to$ **Node.js**.
2. Select or create the web application for your domain.
3. Configure settings:
   - **Node.js Version:** `20.x` or `22.x`
   - **Application Root:** `/home/u454895597/domains/shineovative.com/public_html/app`
   - **Application Startup File:** `server.js` (or `.next/standalone/server.js`)
   - **Environment:** `production`

### Step 3: Deployment via Git & SSH (Recommended)
1. **Connect via SSH:**
   ```bash
   ssh -p 65002 u454895597@ssh.hostinger.com
   ```
2. **Navigate to app root:**
   ```bash
   cd ~/domains/shineovative.com/public_html/app
   ```
3. **Pull latest SaaS code from GitHub:**
   ```bash
   git clone git@github.com:shaik-ahmed-irshad/shineovative-crm-saas.git .
   # Or pull updates:
   git pull origin main
   ```
4. **Install Dependencies & Build:**
   ```bash
   npm install --production=false
   npm run build
   ```
5. **Copy Static Assets into Standalone Folder:**
   ```bash
   cp -r public .next/standalone/
   cp -r .next/static .next/standalone/.next/
   ```
6. **Start / Restart with PM2:**
   ```bash
   pm2 restart shineovative-saas || pm2 start .next/standalone/server.js --name "shineovative-saas" -- -p 3000
   pm2 save
   ```

---

## Automated Background Maintenance Cron on Hostinger

To ensure expired trials automatically transition and audit logs are recorded:
1. In **Hostinger hPanel**, go to **Advanced** $\to$ **Cron Jobs**.
2. Add a new recurring cron job:
   - **Type:** Custom command or curl
   - **Interval:** Once per day (at 00:00 UTC)
   - **Command:**
     ```bash
     curl -s -X POST https://app.shineovative.com/api/cron/maintenance \
       -H "Authorization: Bearer shineovative_saas_cron_secret_72"
     ```

---

## Post-Deployment Verification

1. Open `https://app.shineovative.com/login` in your browser.
2. Confirm the login page loads with valid HTTPS and SSL.
3. Sign in as Super Admin (`ahmed@shineovative.com` / `MyWaSaasCrm@72`).
4. Confirm access to `/super-admin` with live organization diagnostics.
5. Verify tenant isolation by logging in as `apex.owner@shineovative.com`.
