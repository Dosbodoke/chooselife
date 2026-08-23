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

Contribution reminders use the private outbox workflow in issue #211. The
`contribution-reminder-enqueuer` polls for the latest useful logical stage, the
`contribution-reminder-dispatcher` leases one physical member/association
window and sends a generic Ledger deep link, and
`contribution-reminder-receipts` reconciles Expo tickets and retires invalid
tokens. These jobs are scheduled from the migration and use the Vault
`project_url` and `secret_key` values.

The legacy `daily-renewal-check` job and its immediate renewal-notification
behavior were removed by the recurring-obligation cutover. Keep the general
`public.notifications` webhook for unrelated product notifications, but do
not use it for contribution reminders.

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
