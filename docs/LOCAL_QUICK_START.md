# Local Quick Start

Run the entire CRM on this PC: frontend, API, database, login, storage, and realtime.

## One-time Windows setup

Docker Desktop is installed, but Windows still needs its WSL 2 kernel. Open **PowerShell as Administrator** and run:

```powershell
wsl --update --web-download
```

Restart Windows if prompted. Then open Docker Desktop and wait until it says it is running.

## Start everything

Open PowerShell in this folder:

```powershell
cd C:\Users\HP\Desktop\Shinovative\crm-wa.shineovative.com
npx supabase start
npx supabase db reset
```

Run this once and copy the local values shown by Supabase:

```powershell
npx supabase status
```

Create `.env.local` from the example and use the local URL/keys printed above:

```powershell
Copy-Item .env.local.example .env.local
notepad .env.local
```

Set these values:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54331
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase status>
ENCRYPTION_KEY=<64-character key>
META_APP_SECRET=local-only-secret
WHATSAPP_TEMPLATES_DRY_RUN=true
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Generate the encryption key:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Create a local login in Supabase Studio:

1. Open `http://127.0.0.1:54333`.
2. Go to **Authentication → Users → Add user**.
3. Enter an email and password.

Start the CRM:

```powershell
npm run dev
```

Open `http://localhost:3000`, sign in, and start testing.

## Each time after that

```powershell
cd C:\Users\HP\Desktop\Shinovative\crm-wa.shineovative.com
npx supabase start
npm run dev
```

Use `npx supabase stop` when you want to stop the local backend.

No Meta API is needed for normal CRM testing. Keep `WHATSAPP_TEMPLATES_DRY_RUN=true` to test template/campaign screens safely.
