-- Harden the initial PIX claim schema and its security-definer entry points.

create index payment_claims_obligation_claimant_created_at_idx
  on public.payment_claims (obligation_id, claimant_user_id, created_at desc, id desc);

create index payment_claim_audit_events_organization_created_at_idx
  on public.payment_claim_audit_events (organization_id, created_at desc);

create index payment_claim_audit_events_obligation_created_at_idx
  on public.payment_claim_audit_events (obligation_id, created_at desc);

create index payment_claim_audit_events_actor_created_at_idx
  on public.payment_claim_audit_events (actor_user_id, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_claims_terminal_decided_at_check'
      and conrelid = 'public.payment_claims'::regclass
  ) then
    alter table public.payment_claims
      add constraint payment_claims_terminal_decided_at_check
      check (
        status = 'under_review'::public.payment_claim_status_enum
        or decided_at is not null
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_claim_audit_events_transition_check'
      and conrelid = 'public.payment_claim_audit_events'::regclass
  ) then
    alter table public.payment_claim_audit_events
      add constraint payment_claim_audit_events_transition_check
      check (
        (previous_state = 'payment_available'
          and next_state = 'under_review')
        or (
          previous_state = 'under_review'
          and next_state in ('payment_available', 'payment_settled')
        )
      );
  end if;
end;
$$;

alter function public.get_payment_obligation_instructions(uuid)
  set search_path = '';

alter function public.claim_initial_payment(uuid, boolean, text)
  set search_path = '';
