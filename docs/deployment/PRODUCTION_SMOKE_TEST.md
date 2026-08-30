# Shineovative WhatsApp CRM — Production Smoke Test Checklist

Execute this checklist immediately after deploying to production to ensure all systems operate cleanly.

---

| Step # | Test Area | Action / Procedure | Expected Result | Pass / Fail |
|---|---|---|---|---|
| **1** | **SSL & DNS** | Visit `https://crm.shineovative.com` in browser | Valid HTTPS certificate, no security warnings | `[ ]` |
| **2** | **Owner Authentication** | Log in as initial Owner user (`admin@shineovative.com`) | Redirects to `/dashboard` cleanly | `[ ]` |
| **3** | **Invite-Only Auth** | Visit `https://crm.shineovative.com/signup` | Public signup disabled alert displayed; self-registration blocked | `[ ]` |
| **4** | **Database & RLS** | Navigate to Contacts (`/contacts`) and Deals (`/pipelines`) | Database queries load cleanly without permission errors | `[ ]` |
| **5** | **WhatsApp Webhook** | Trigger Meta webhook verification handshake in Meta App Dashboard | Verification succeeds with 200 OK | `[ ]` |
| **6** | **Inbound WhatsApp Message** | Send test WhatsApp message from personal phone to WABA test number | Message appears in Inbox (`/inbox`) in real time | `[ ]` |
| **7** | **Outbound WhatsApp Message** | Reply to customer from Inbox composer | Message delivers to personal phone with `delivered`/`read` status | `[ ]` |
| **8** | **Conversation → Deal** | Open thread -> Click `Create Deal` -> Submit deal with value | Deal appears on Kanban board (`/pipelines`) linked to contact | `[ ]` |
| **9** | **Follow-up Persistence** | Set follow-up on conversation -> Reload page | Follow-up status badge persists across refresh | `[ ]` |
| **10** | **Team Invitation** | Invite new team member from Settings -> Team | Invitation email sends; new user joins with assigned role | `[ ]` |
