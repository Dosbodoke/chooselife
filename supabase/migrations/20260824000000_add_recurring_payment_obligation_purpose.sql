-- The initial-admission obligation model is also the source of truth for
-- recurring contribution periods. Keep the enum addition in its own
-- migration because PostgreSQL cannot safely use a newly-added enum value
-- before the transaction that adds it has committed.
alter type public.payment_obligation_purpose_enum
  add value if not exists 'recurring';
