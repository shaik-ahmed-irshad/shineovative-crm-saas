# Solar Cubic Cloud Production Deployment Guide

## System Architecture

### Local Environment
`Windows → Next.js (localhost:3000) → Local Supabase (127.0.0.1:54331)`

### Production Environment
`Browser → Vercel (Next.js CRM) → Supabase Cloud (DB + Auth + Storage + Realtime) → Meta WhatsApp / AI / Email`

---

## Production Deployment Steps

1. **Supabase Cloud Project**: Create a production Supabase project and obtain the production `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`.
2. **Environment Variables**: Configure environment variables in Vercel project settings (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, `META_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`).
3. **Vercel Project**: Import the private GitHub repository `solarcubic-crm` into Vercel and select Next.js preset.
4. **Database Migrations**: Apply all 41 migrations (`001_initial_schema.sql` through `041_ai_providers_expansion.sql`) to Supabase Cloud using Supabase CLI or SQL editor.
5. **Deploy**: Trigger production build on Vercel (`git push origin main`).
6. **Auth Redirect URLs**: Add production site URL (`https://<your-domain>/auth/callback`) to Supabase Auth Site URL & Redirect URLs settings.
7. **Meta Webhook Setup**: Configure Webhook URL in Meta Developer Dashboard (`https://<your-domain>/api/whatsapp/webhook`) with `WHATSAPP_VERIFY_TOKEN`.
8. **Smoke Test**: Verify login, inbox, contacts, deals, follow-up, conversation to deal flow, and campaign builder in production browser.
