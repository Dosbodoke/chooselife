# Generate Membership Ledger Obligations

This scheduled Edge Function materializes recurring periods that are ready for
payment. It is a thin scheduler adapter; it does not send reminders or mutate
membership state.

The database function `generate_membership_billing_obligations` is the
idempotent source of truth. It snapshots the plan, amount, currency, PIX
payload, availability date, and due date into `payment_obligations`. Database
uniqueness makes retries and concurrent runs safe. Reminder stages belong to a
separate workflow and must reference the materialized obligation after
generation.

The production RPC derives the database clock and is executable only by the
Supabase service role. The timestamp-injected worker is private and exists for
local regression tests.

Before the first scheduled run after cutover, review the legacy mapping with
`select * from public.reconcile_legacy_payment_obligations(false)`. Apply only
the reviewed, unambiguous mappings with the same command set to `true`.

## Push delivery

The app's existing notification pipeline expects an `INSERT` Database Webhook
on `public.notifications` to call the `push-notification` Edge Function. Ensure
that webhook is configured in each deployed Supabase project; webhook
configuration is managed outside this repository.

## Deployment

Deploy the function using the Supabase CLI:

```bash
supabase functions deploy generate-renewal-payments --project-ref <your-project-ref>
```

## Scheduling

The cutover migration replaces the legacy `daily-renewal-check` job with one
`membership-billing-obligation-generator` job that runs every 15 minutes. It
uses Supabase Vault for the project URL and service-role key. Keep those
secrets out of the repository.
