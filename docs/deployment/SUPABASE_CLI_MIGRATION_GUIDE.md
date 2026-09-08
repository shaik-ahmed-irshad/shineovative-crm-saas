# Supabase CLI Link & Migration Workflow Guide

## Purpose
This document provides a repeatable, automated terminal workflow skill for linking Supabase CLI to any production Supabase Cloud project using an access token (`SUPABASE_ACCESS_TOKEN`) and pushing database migrations (`001` through `041`).

---

## Prerequisites

1. **Supabase Personal Access Token**:
   Generate from **Supabase Dashboard → Account → Access Tokens**.

2. **Project Reference**:
   Extracted from your Supabase Cloud URL (e.g. `wzsiuxicagohbfqnnktf` from `https://wzsiuxicagohbfqnnktf.supabase.co`).

---

## Step-by-Step Terminal Commands

### Step 1: Set Access Token in Environment or `.env.local`

```bash
# Set environment variable for current terminal session
export SUPABASE_ACCESS_TOKEN="sbp_your_personal_access_token"

# Or add to .env.local (verify .env.local is ignored by Git)
echo "SUPABASE_ACCESS_TOKEN=sbp_your_personal_access_token" >> .env.local
```

### Step 2: Link CLI to Cloud Project

```bash
npx supabase link --project-ref <YOUR_PROJECT_REF>
```

Output expected:
`Finished connecting to project <YOUR_PROJECT_REF>.`

### Step 3: Push Database Migrations to Cloud

```bash
npx supabase db push
```

Output expected:
```text
Connecting to remote database...
Applying migration 001_initial_schema.sql...
...
Applying migration 041_ai_providers_expansion.sql...
Finished supabase db push.
```

---

## Verification

Run a quick Node.js script to confirm schema tables exist in Supabase Cloud:

```javascript
const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://<YOUR_PROJECT_REF>.supabase.co', '<SERVICE_ROLE_KEY>');
client.from('profiles').select('*').limit(1).then(res => {
  console.log('Verification status:', res.error ? res.error.message : 'SUCCESS');
});
```
