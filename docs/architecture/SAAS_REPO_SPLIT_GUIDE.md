# SaaS Repository Split & Cherry-Pick Syncing Guide

## Overview

The CRM platform is split into two repositories sharing a common baseline (`core-v1-baseline`):

- **Solar Cubic CRM Repo**: `git@github.com:shaik-ahmed-irshad/solarcubic-crm.git`
- **Shineovative SaaS CRM Repo**: `git@github.com:shaik-ahmed-irshad/shineovative-crm-saas.git`

```text
               core-v1-baseline
                      │
      ┌───────────────┴───────────────┐
      ▼                               ▼
Solar Cubic CRM repo         Shineovative SaaS repo
(future solar: + core:)      (future saas: + core:)
```

---

## Commit Conventions

All commits across both repositories must follow this prefix convention:

- `core:` Universal CRM change shared by Solar + SaaS
- `solar:` Solar Cubic-only change
- `saas:` SaaS/platform-only change
- `docs:` Documentation-only change

### Examples
- `core: fix inbox filtering`
- `core: improve contact deduplication`
- `solar: add Solar Cubic quick replies`
- `saas: add super admin organizations`

---

## Syncing Universal Core Fixes (Cherry-Pick Workflow)

Universal `core:` changes must be kept in small isolated commits so they can easily be cherry-picked between repositories.

### Example 1: Syncing core fix from Solar → SaaS

1. In **Solar repo**:
   ```bash
   git commit -m "core: fix inbox filtering"
   # Commit created with hash: abc1234
   git push origin main
   ```

2. In **SaaS repo**:
   ```bash
   git fetch origin
   git cherry-pick abc1234
   git push origin main
   ```

### Example 2: Syncing core fix from SaaS → Solar

1. In **SaaS repo**:
   ```bash
   git commit -m "core: improve contact deduplication"
   # Commit created with hash: def5678
   git push origin main
   ```

2. In **Solar repo**:
   ```bash
   git fetch origin
   git cherry-pick def5678
   git push origin main
   ```
