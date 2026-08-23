# Generate Membership Ledger Obligations

This scheduled Edge Function materializes the recurring periods that are ready
for payment and creates one targeted notification per obligation.

The database function `generate_membership_billing_obligations` is the
idempotent source of truth. It snapshots the plan, amount, currency, PIX
payload, availability date, and due date into `payment_obligations`. The Edge
Function then links notifications to the exact `obligationId`, so opening a
reminder always refetches the current server-owned Ledger state.

Notification deduplication uses the obligation ID and notification type. A
retry can therefore recover a missing notification without creating a second
obligation or sending a duplicate reminder.

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

The existing `daily-renewal-check` `pg_cron` job invokes this function daily.
The job lives in
`supabase/migrations/20251113121601_schedule-payment.sql` and uses Supabase
Vault for the project URL and service-role key. Keep those secrets out of the
repository.
