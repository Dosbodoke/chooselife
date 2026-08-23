SET check_function_bodies = false;
DROP POLICY "Allow all users to insert push tokens" ON public.push_tokens;
DROP POLICY "Allow all users to read push tokens" ON public.push_tokens;
DROP POLICY "Allow authenticated users to update their own push tokens" ON public.push_tokens;
CREATE TYPE public.contribution_cadence_enum AS ENUM ('monthly', 'annual');
CREATE TYPE public.contribution_reminder_attempt_status_enum AS ENUM ('pending', 'leased', 'ticketed', 'retryable', 'delivered', 'terminal');
CREATE TYPE public.contribution_reminder_batch_status_enum AS ENUM ('pending', 'leased', 'awaiting_receipts', 'retryable', 'delivered', 'no_device', 'terminal', 'suppressed');
CREATE TYPE public.contribution_reminder_event_status_enum AS ENUM ('pending', 'delivered', 'coalesced', 'suppressed', 'no_device', 'exhausted');
CREATE TYPE public.contribution_reminder_stage_enum AS ENUM ('available', 'due', 'overdue');
CREATE TYPE public.organization_type_enum AS ENUM ('group', 'association');
CREATE TYPE public.payment_claim_payer_type_enum AS ENUM ('applicant', 'other');
CREATE TYPE public.payment_claim_status_enum AS ENUM ('under_review', 'approved', 'rejected');
CREATE TYPE public.payment_obligation_purpose_enum AS ENUM ('initial_admission', 'recurring');
CREATE TYPE public.payment_obligation_status_enum AS ENUM ('available', 'settled', 'void');
CREATE OR REPLACE FUNCTION public.apply_payment_settlement_effects(p_payment_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  payment_record record;
  subscription_record record;
  period_start timestamp with time zone;
begin
  select
    p.id,
    p.subscription_id,
    p.user_id,
    p.organization_id,
    p.status,
    p.settlement_applied_at
  into payment_record
  from public.payments p
  where p.id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment % was not found.', p_payment_id
      using errcode = 'P0002';
  end if;

  if payment_record.status <> 'succeeded'::public.payment_status_enum then
    return false;
  end if;

  -- Legacy rows can be linked to an initial obligation during migration. They
  -- remain reconciliation evidence; succeeding them is never admission.
  if exists (
    select 1
    from public.payment_obligations po
    where po.legacy_payment_id = payment_record.id
      and po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
  ) then
    return false;
  end if;

  if payment_record.settlement_applied_at is not null then
    return false;
  end if;

  select s.current_period_end, s.plan_type
  into subscription_record
  from public.subscriptions s
  where s.id = payment_record.subscription_id
  for update;

  if not found then
    raise warning 'Cannot apply payment effects. Subscription % was not found for payment %.',
      payment_record.subscription_id,
      payment_record.id;
    return false;
  end if;

  period_start = greatest(
    coalesce(subscription_record.current_period_end, timezone('utc'::text, now())),
    timezone('utc'::text, now())
  );

  update public.subscriptions s
  set
    status = 'active'::public.subscription_status_enum,
    current_period_end = period_start + case subscription_record.plan_type
      when 'annual'::public.subscription_plan_type_enum then interval '1 year'
      else interval '1 month'
    end
  where s.id = payment_record.subscription_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (
    payment_record.organization_id,
    payment_record.user_id,
    'member'::public.organization_role_enum
  )
  on conflict (organization_id, user_id) do update
  set role = case
    when public.organization_members.role = 'admin'::public.organization_role_enum
      then 'admin'::public.organization_role_enum
    else excluded.role
  end;

  update public.payments p
  set settlement_applied_at = timezone('utc'::text, now())
  where p.id = payment_record.id
    and p.settlement_applied_at is null;

  return true;
end;
$function$;
CREATE OR REPLACE FUNCTION public.apply_succeeded_payment_effects()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status <> 'succeeded'::public.payment_status_enum then
    return new;
  end if;

  perform public.apply_payment_settlement_effects(new.id);
  return new;
end;
$function$;
CREATE FUNCTION public.approve_initial_claim(p_claim_id uuid)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, claim_status public.payment_claim_status_enum, obligation_status public.payment_obligation_status_enum, membership_user_id uuid, subscription_id uuid, subscription_status public.subscription_status_enum, subscription_current_period_end timestamp with time zone, audit_event_id uuid, decision_applied_now boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := auth.uid();
  claim_record public.payment_claims%rowtype;
  organization_record public.organizations%rowtype;
  reviewer_membership public.organization_members%rowtype;
  obligation_record public.payment_obligations%rowtype;
  revision_record public.membership_application_revisions%rowtype;
  application_record public.membership_applications%rowtype;
  applicant_membership public.organization_members%rowtype;
  subscription_record public.subscriptions%rowtype;
  audit_record public.payment_claim_audit_events%rowtype;
  applicant_membership_found boolean;
  subscription_found boolean;
  audit_found boolean;
  decision_timestamp timestamp with time zone := timezone('utc'::text, clock_timestamp());
  subscription_end timestamp with time zone;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select pc.*
  into claim_record
  from public.payment_claims pc
  where pc.id = p_claim_id
  for update;

  if not found then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  select o.*
  into organization_record
  from public.organizations o
  where o.id = claim_record.organization_id
  for update;

  if not found then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  if organization_record.organization_type <> 'association'::public.organization_type_enum then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  select om.*
  into reviewer_membership
  from public.organization_members om
  where om.organization_id = claim_record.organization_id
    and om.user_id = actor_id
  for update;

  if not found then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  if reviewer_membership.role <> 'admin'::public.organization_role_enum
    or claim_record.claimant_user_id = actor_id then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  select po.*
  into obligation_record
  from public.payment_obligations po
  where po.id = claim_record.obligation_id
  for update;

  if not found then
    raise exception 'This claim no longer has a valid payment obligation.'
      using errcode = '23514';
  end if;

  select mar.*
  into revision_record
  from public.membership_application_revisions mar
  where mar.id = obligation_record.application_revision_id
  for update;

  if not found then
    raise exception 'This claim no longer has a valid application revision.'
      using errcode = '23514';
  end if;

  select ma.*
  into application_record
  from public.membership_applications ma
  where ma.id = revision_record.application_id
  for update;

  if not found then
    raise exception 'This claim no longer has a valid application.'
      using errcode = '23514';
  end if;

  -- Lock the applicant membership and subscription in the same order for
  -- approve and reject. This keeps concurrent decisions deterministic.
  select om.*
  into applicant_membership
  from public.organization_members om
  where om.organization_id = obligation_record.organization_id
    and om.user_id = obligation_record.user_id
  for update;
  applicant_membership_found := found;

  select s.*
  into subscription_record
  from public.subscriptions s
  where s.organization_id = obligation_record.organization_id
    and s.user_id = obligation_record.user_id
  for update;
  subscription_found := found;

  if claim_record.status = 'approved'::public.payment_claim_status_enum then
    if obligation_record.status <> 'settled'::public.payment_obligation_status_enum then
      raise exception 'The approved claim is missing its settled obligation.'
        using errcode = '23514';
    end if;

    select pcae.*
    into audit_record
    from public.payment_claim_audit_events pcae
    where pcae.claim_id = claim_record.id
      and pcae.next_state = 'payment_settled'
    order by pcae.created_at asc, pcae.id asc
    limit 1;
    audit_found := found;

    if not audit_found then
      raise exception 'The approved claim is missing its audit event.'
        using errcode = '23514';
    end if;

    if not applicant_membership_found
      or not subscription_found
      or subscription_record.status <> 'active'::public.subscription_status_enum then
      raise exception 'The approved claim is missing its admission effects.'
        using errcode = '23514';
    end if;

    return query
    select
      claim_record.id,
      obligation_record.id,
      claim_record.status,
      obligation_record.status,
      applicant_membership.user_id,
      subscription_record.id,
      subscription_record.status,
      subscription_record.current_period_end,
      audit_record.id,
      false;
    return;
  end if;

  if claim_record.status = 'rejected'::public.payment_claim_status_enum then
    raise exception 'This claim was already rejected. Refresh before deciding.'
      using errcode = '40001';
  end if;

  if claim_record.status <> 'under_review'::public.payment_claim_status_enum then
    raise exception 'This claim is no longer awaiting review. Refresh before deciding.'
      using errcode = '40001';
  end if;

  if obligation_record.purpose <> 'initial_admission'::public.payment_obligation_purpose_enum
    or obligation_record.status <> 'available'::public.payment_obligation_status_enum
    or obligation_record.payment_method <> 'manual_pix'
    or nullif(btrim(obligation_record.pix_copy_paste), '') is null
    or obligation_record.organization_id <> claim_record.organization_id
    or obligation_record.user_id <> claim_record.claimant_user_id
    or obligation_record.plan_type <> revision_record.plan_type
    or obligation_record.amount <> revision_record.plan_amount
    or obligation_record.currency <> revision_record.currency
    or obligation_record.application_revision_id <> revision_record.id
    or revision_record.organization_id <> claim_record.organization_id
    or revision_record.user_id <> claim_record.claimant_user_id
    or application_record.organization_id <> claim_record.organization_id
    or application_record.user_id <> claim_record.claimant_user_id
    or application_record.status <> 'submitted'::public.membership_application_status_enum then
    raise exception 'This claim no longer matches an actionable initial application.'
      using errcode = '40001';
  end if;

  if subscription_found
    and subscription_record.plan_type <> revision_record.plan_type then
    raise exception 'The applicant has a conflicting subscription plan.'
      using errcode = '23514';
  end if;

  -- Preserve an existing admin role. A prior member row is also reused so the
  -- approval is idempotent at the organization-membership boundary.
  insert into public.organization_members (organization_id, user_id, role)
  values (
    obligation_record.organization_id,
    obligation_record.user_id,
    'member'::public.organization_role_enum
  )
  on conflict (organization_id, user_id) do update
  set role = case
    when public.organization_members.role = 'admin'::public.organization_role_enum
      then 'admin'::public.organization_role_enum
    else excluded.role
  end
  returning * into applicant_membership;

  subscription_end = case revision_record.plan_type
    when 'annual'::public.subscription_plan_type_enum
      then decision_timestamp + interval '1 year'
    else decision_timestamp + interval '1 month'
  end;

  if subscription_found then
    update public.subscriptions s
    set
      plan_type = revision_record.plan_type,
      status = 'active'::public.subscription_status_enum,
      current_period_end = case
        when subscription_record.status = 'active'::public.subscription_status_enum
          and subscription_record.current_period_end is not null
          and subscription_record.current_period_end > decision_timestamp
          then subscription_record.current_period_end
        else subscription_end
      end
    where s.id = subscription_record.id
    returning * into subscription_record;
  else
    insert into public.subscriptions (
      organization_id,
      user_id,
      plan_type,
      status,
      current_period_end
    )
    values (
      obligation_record.organization_id,
      obligation_record.user_id,
      revision_record.plan_type,
      'active'::public.subscription_status_enum,
      subscription_end
    )
    returning * into subscription_record;
  end if;

  perform set_config('app.payment_claim_decision_command', 'on', true);

  update public.payment_claims pc
  set
    status = 'approved'::public.payment_claim_status_enum,
    decided_at = decision_timestamp,
    decision_reason = null
  where pc.id = claim_record.id;

  perform set_config('app.payment_claim_decision_command', 'off', true);

  update public.payment_obligations po
  set
    status = 'settled'::public.payment_obligation_status_enum,
    settled_at = decision_timestamp
  where po.id = obligation_record.id;

  insert into public.payment_claim_audit_events (
    organization_id,
    obligation_id,
    claim_id,
    actor_user_id,
    previous_state,
    next_state,
    reason,
    created_at
  )
  values (
    obligation_record.organization_id,
    obligation_record.id,
    claim_record.id,
    actor_id,
    'under_review',
    'payment_settled',
    null,
    decision_timestamp
  )
  returning * into audit_record;

  return query
  select
    claim_record.id,
    obligation_record.id,
    'approved'::public.payment_claim_status_enum,
    'settled'::public.payment_obligation_status_enum,
    applicant_membership.user_id,
    subscription_record.id,
    subscription_record.status,
    subscription_record.current_period_end,
    audit_record.id,
    true;
end;
$function$;
COMMENT ON FUNCTION public.approve_initial_claim(uuid) IS 'Atomically verifies an actionable initial claim, settles its obligation, admits the applicant, activates the selected subscription schedule, and appends one audit event.';
REVOKE ALL ON FUNCTION public.approve_initial_claim(uuid) FROM anon;
CREATE FUNCTION public.approve_recurring_payment_claim(p_claim_id uuid)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, claim_status public.payment_claim_status_enum, obligation_status public.payment_obligation_status_enum, audit_event_id uuid, decision_applied_now boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  claim_record public.payment_claims%rowtype;
  obligation_record public.payment_obligations%rowtype;
  audit_record public.payment_claim_audit_events%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select pc.*
  into claim_record
  from public.payment_claims pc
  where pc.id = p_claim_id
  for update;

  if not found then
    raise exception 'This claim is unavailable to the current reviewer.' using errcode = '42501';
  end if;

  if claim_record.claimant_user_id = actor_id
    or not exists (
      select 1
      from public.organization_members om
      join public.organizations o on o.id = om.organization_id
      where om.organization_id = claim_record.organization_id
        and om.user_id = actor_id
        and om.role = 'admin'::public.organization_role_enum
        and o.organization_type = 'association'::public.organization_type_enum
    ) then
    raise exception 'Association admin access is required.' using errcode = '42501';
  end if;

  select po.*
  into obligation_record
  from public.payment_obligations po
  where po.id = claim_record.obligation_id
  for update;

  if not found
    or obligation_record.purpose <> 'recurring'::public.payment_obligation_purpose_enum then
    raise exception 'This claim is not a recurring contribution claim.' using errcode = '40001';
  end if;

  if claim_record.status = 'approved'::public.payment_claim_status_enum then
    select pcae.*
    into audit_record
    from public.payment_claim_audit_events pcae
    where pcae.claim_id = claim_record.id
      and pcae.next_state = 'payment_settled'
    order by pcae.created_at asc, pcae.id asc
    limit 1;

    return query
    select
      claim_record.id,
      obligation_record.id,
      claim_record.status,
      obligation_record.status,
      audit_record.id,
      false;
    return;
  end if;

  if claim_record.status <> 'under_review'::public.payment_claim_status_enum
    or obligation_record.status <> 'available'::public.payment_obligation_status_enum then
    raise exception 'This claim is no longer actionable. Refresh before deciding.'
      using errcode = '40001';
  end if;

  perform set_config('app.payment_claim_decision_command', 'on', true);

  update public.payment_claims pc
  set
    status = 'approved'::public.payment_claim_status_enum,
    decided_at = timezone('utc'::text, clock_timestamp()),
    decision_reason = null
  where pc.id = claim_record.id;

  update public.payment_obligations po
  set
    status = 'settled'::public.payment_obligation_status_enum,
    settled_at = timezone('utc'::text, clock_timestamp())
  where po.id = obligation_record.id;

  perform set_config('app.payment_claim_decision_command', 'off', true);

  insert into public.payment_claim_audit_events (
    organization_id,
    obligation_id,
    claim_id,
    actor_user_id,
    previous_state,
    next_state,
    reason
  )
  values (
    claim_record.organization_id,
    claim_record.obligation_id,
    claim_record.id,
    actor_id,
    'under_review',
    'payment_settled',
    null
  )
  returning * into audit_record;

  return query
  select
    claim_record.id,
    obligation_record.id,
    'approved'::public.payment_claim_status_enum,
    'settled'::public.payment_obligation_status_enum,
    audit_record.id,
    true;
end;
$function$;
COMMENT ON FUNCTION public.approve_recurring_payment_claim(uuid) IS 'Atomically verifies a recurring contribution claim and settles only that obligation.';
REVOKE ALL ON FUNCTION public.approve_recurring_payment_claim(uuid) FROM anon;
CREATE FUNCTION public.claim_contribution_reminder_batches(p_limit integer DEFAULT 20, p_lease_seconds integer DEFAULT 120)
 RETURNS TABLE(batch_id uuid, lease_token uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  batch_record public.contribution_reminder_batches%rowtype;
  lease_value uuid;
  limit_value integer := greatest(1, least(coalesce(p_limit, 20), 100));
  lease_interval interval := make_interval(
    secs => greatest(30, least(coalesce(p_lease_seconds, 120), 900))
  );
begin
  for batch_record in
    select b.*
    from public.contribution_reminder_batches b
    where (
      b.status in (
        'pending'::public.contribution_reminder_batch_status_enum,
        'retryable'::public.contribution_reminder_batch_status_enum
      )
      and b.next_attempt_at <= clock_timestamp()
      or (
        b.status = 'leased'::public.contribution_reminder_batch_status_enum
        and b.lease_expires_at < clock_timestamp()
        and not exists (
          select 1
          from public.contribution_reminder_delivery_attempts da
          where da.batch_id = b.id
            and da.status = 'ticketed'::public.contribution_reminder_attempt_status_enum
        )
      )
    )
    order by b.delivery_window_on, b.organization_id, b.recipient_user_id, b.id
    limit limit_value
    for update skip locked
  loop
    lease_value := gen_random_uuid();

    update public.contribution_reminder_batches
    set
      status = 'leased'::public.contribution_reminder_batch_status_enum,
      lease_token = lease_value,
      lease_expires_at = clock_timestamp() + lease_interval,
      attempt_count = attempt_count + 1,
      updated_at = clock_timestamp()
    where id = batch_record.id;

    batch_id := batch_record.id;
    lease_token := lease_value;
    return next;
  end loop;
end;
$function$;
COMMENT ON FUNCTION public.claim_contribution_reminder_batches(integer,integer) IS 'Claims private reminder batches with SKIP LOCKED so concurrent dispatchers do not process the same batch.';
REVOKE ALL ON FUNCTION public.claim_contribution_reminder_batches(integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_contribution_reminder_batches(integer, integer) FROM authenticated;
CREATE FUNCTION public.claim_contribution_reminder_receipts(p_limit integer DEFAULT 100, p_lease_seconds integer DEFAULT 120)
 RETURNS TABLE(attempt_id uuid, batch_id uuid, lease_token uuid, expo_ticket_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  attempt_record public.contribution_reminder_delivery_attempts%rowtype;
  lease_value uuid;
  limit_value integer := greatest(1, least(coalesce(p_limit, 100), 500));
  lease_interval interval := make_interval(
    secs => greatest(30, least(coalesce(p_lease_seconds, 120), 900))
  );
begin
  for attempt_record in
    select da.*
    from public.contribution_reminder_delivery_attempts da
    join public.contribution_reminder_batches b on b.id = da.batch_id
    where b.status = 'awaiting_receipts'::public.contribution_reminder_batch_status_enum
      and (
        (
          da.status = 'ticketed'::public.contribution_reminder_attempt_status_enum
          and da.next_receipt_check_at <= clock_timestamp()
        )
        or (
          da.status = 'leased'::public.contribution_reminder_attempt_status_enum
          and da.lease_expires_at < clock_timestamp()
        )
      )
    order by da.next_receipt_check_at, da.id
    limit limit_value
    for update of da skip locked
  loop
    lease_value := gen_random_uuid();
    update public.contribution_reminder_delivery_attempts da
    set
      status = 'leased'::public.contribution_reminder_attempt_status_enum,
      lease_token = lease_value,
      lease_expires_at = clock_timestamp() + lease_interval,
      updated_at = clock_timestamp()
    where da.id = attempt_record.id;

    attempt_id := attempt_record.id;
    batch_id := attempt_record.batch_id;
    lease_token := lease_value;
    expo_ticket_id := attempt_record.expo_ticket_id;
    return next;
  end loop;
end;
$function$;
REVOKE ALL ON FUNCTION public.claim_contribution_reminder_receipts(integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_contribution_reminder_receipts(integer, integer) FROM authenticated;
CREATE FUNCTION public.claim_initial_payment(p_obligation_id uuid, p_paid_by_applicant boolean, p_payer_name text DEFAULT NULL::text)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, payer_type public.payment_claim_payer_type_enum, payer_name text, claim_status public.payment_claim_status_enum, claim_created_at timestamp with time zone, audit_event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := auth.uid();
  obligation_record public.payment_obligations%rowtype;
  existing_claim public.payment_claims%rowtype;
  existing_audit_event public.payment_claim_audit_events%rowtype;
  inserted_claim public.payment_claims%rowtype;
  normalized_payer_name text;
  inserted_audit_event public.payment_claim_audit_events%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_obligation_id is null or p_paid_by_applicant is null then
    raise exception 'The payment claim request is incomplete.'
      using errcode = '22023';
  end if;

  normalized_payer_name = nullif(
    btrim(regexp_replace(coalesce(p_payer_name, ''), '\s+', ' ', 'g')),
    ''
  );

  if p_paid_by_applicant and normalized_payer_name is not null then
    raise exception 'Payer name is only allowed when another person paid.'
      using errcode = '22023';
  end if;

  if not p_paid_by_applicant and normalized_payer_name is null then
    raise exception 'Enter the name of the person who made the payment.'
      using errcode = '22023';
  end if;

  if normalized_payer_name is not null
    and char_length(normalized_payer_name) > 120 then
    raise exception 'Payer name must be 120 characters or fewer.'
      using errcode = '22023';
  end if;

  select po.*
  into obligation_record
  from public.payment_obligations po
  where po.id = p_obligation_id
    and po.user_id = actor_id
  for update;

  if not found then
    raise exception 'Payment obligation is unavailable.' using errcode = '42501';
  end if;

  if obligation_record.purpose <> 'initial_admission'::public.payment_obligation_purpose_enum
    or obligation_record.status <> 'available'::public.payment_obligation_status_enum
    or obligation_record.payment_method <> 'manual_pix'
    or nullif(btrim(obligation_record.pix_copy_paste), '') is null then
    raise exception 'This payment obligation cannot be claimed.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.membership_application_revisions mar
    join public.membership_applications ma on ma.id = mar.application_id
    where mar.id = obligation_record.application_revision_id
      and mar.user_id = actor_id
      and ma.status = 'submitted'::public.membership_application_status_enum
  ) then
    raise exception 'This payment obligation is not attached to a submitted application.'
      using errcode = '23514';
  end if;

  select pc.*
  into existing_claim
  from public.payment_claims pc
  where pc.obligation_id = obligation_record.id
    and pc.status = 'under_review'::public.payment_claim_status_enum
  for update;

  if found then
    if existing_claim.payer_type <> (
      case
        when p_paid_by_applicant then 'applicant'::public.payment_claim_payer_type_enum
        else 'other'::public.payment_claim_payer_type_enum
      end
    )
    or existing_claim.payer_name is distinct from normalized_payer_name then
      raise exception 'A payment claim is already under review with different payer details.'
        using errcode = '40001';
    end if;

    select pcae.*
    into existing_audit_event
    from public.payment_claim_audit_events pcae
    where pcae.claim_id = existing_claim.id
      and pcae.next_state = 'under_review'
    order by pcae.created_at asc
    limit 1;

    return query
    select
      existing_claim.id,
      existing_claim.obligation_id,
      existing_claim.payer_type,
      existing_claim.payer_name,
      existing_claim.status,
      existing_claim.created_at,
      existing_audit_event.id;
    return;
  end if;

  if exists (
    select 1
    from public.payment_claims pc
    where pc.obligation_id = obligation_record.id
      and pc.status = 'approved'::public.payment_claim_status_enum
  ) then
    raise exception 'This payment obligation has already been approved.'
      using errcode = '23514';
  end if;

  insert into public.payment_claims (
    obligation_id,
    organization_id,
    claimant_user_id,
    payer_type,
    payer_name,
    status
  )
  values (
    obligation_record.id,
    obligation_record.organization_id,
    actor_id,
    case
      when p_paid_by_applicant then 'applicant'::public.payment_claim_payer_type_enum
      else 'other'::public.payment_claim_payer_type_enum
    end,
    case when p_paid_by_applicant then null else normalized_payer_name end,
    'under_review'::public.payment_claim_status_enum
  )
  returning * into inserted_claim;

  insert into public.payment_claim_audit_events (
    organization_id,
    obligation_id,
    claim_id,
    actor_user_id,
    previous_state,
    next_state
  )
  values (
    obligation_record.organization_id,
    obligation_record.id,
    inserted_claim.id,
    actor_id,
    'payment_available',
    'under_review'
  )
  returning * into inserted_audit_event;

  return query
  select
    inserted_claim.id,
    inserted_claim.obligation_id,
    inserted_claim.payer_type,
    inserted_claim.payer_name,
    inserted_claim.status,
    inserted_claim.created_at,
    inserted_audit_event.id;
end;
$function$;
COMMENT ON FUNCTION public.claim_initial_payment(uuid,boolean,text) IS 'Atomically records one authenticated applicant claim for an available initial manual-PIX obligation without settling it or creating membership.';
REVOKE ALL ON FUNCTION public.claim_initial_payment(uuid, boolean, text) FROM anon;
CREATE FUNCTION public.claim_recurring_payment(p_obligation_id uuid, p_paid_by_applicant boolean, p_payer_name text DEFAULT NULL::text)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, payer_type public.payment_claim_payer_type_enum, payer_name text, claim_status public.payment_claim_status_enum, claim_created_at timestamp with time zone, audit_event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  organization_record public.organizations%rowtype;
  obligation_record public.payment_obligations%rowtype;
  existing_claim public.payment_claims%rowtype;
  audit_record public.payment_claim_audit_events%rowtype;
  inserted_claim public.payment_claims%rowtype;
  normalized_payer_name text;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  normalized_payer_name := nullif(
    btrim(regexp_replace(coalesce(p_payer_name, ''), '\\s+', ' ', 'g')),
    ''
  );

  if p_paid_by_applicant and normalized_payer_name is not null then
    raise exception 'Payer name is only allowed when another person paid.'
      using errcode = '22023';
  end if;

  if not p_paid_by_applicant and normalized_payer_name is null then
    raise exception 'Enter the name of the person who made the payment.'
      using errcode = '22023';
  end if;

  if normalized_payer_name is not null and char_length(normalized_payer_name) > 120 then
    raise exception 'Payer name must be 120 characters or fewer.' using errcode = '22023';
  end if;

  select po.*
  into obligation_record
  from public.payment_obligations po
  where po.id = p_obligation_id
    and po.user_id = actor_id
  for update;

  if not found then
    raise exception 'Payment obligation is unavailable.' using errcode = '42501';
  end if;

  select o.*
  into organization_record
  from public.organizations o
  where o.id = obligation_record.organization_id
    and o.organization_type = 'association'::public.organization_type_enum;

  if not found then
    raise exception 'Payment obligation is unavailable.' using errcode = '42501';
  end if;

  if obligation_record.purpose <> 'recurring'::public.payment_obligation_purpose_enum
    or obligation_record.status <> 'available'::public.payment_obligation_status_enum
    or obligation_record.available_on > timezone(
      coalesce(obligation_record.billing_timezone, organization_record.billing_timezone),
      clock_timestamp()
    )::date
    or obligation_record.payment_method <> 'manual_pix'
    or nullif(btrim(obligation_record.pix_copy_paste), '') is null
    or not exists (
      select 1
      from public.organization_members om
      where om.organization_id = obligation_record.organization_id
        and om.user_id = actor_id
        and om.role in (
          'admin'::public.organization_role_enum,
          'member'::public.organization_role_enum
        )
    ) then
    raise exception 'This recurring contribution cannot be claimed.' using errcode = '23514';
  end if;

  select pc.*
  into existing_claim
  from public.payment_claims pc
  where pc.obligation_id = obligation_record.id
    and pc.status = 'under_review'::public.payment_claim_status_enum
  for update;

  if found then
    if existing_claim.payer_type <> (
      case
        when p_paid_by_applicant then 'applicant'::public.payment_claim_payer_type_enum
        else 'other'::public.payment_claim_payer_type_enum
      end
    )
    or existing_claim.payer_name is distinct from (
      case
        when p_paid_by_applicant then null
        else normalized_payer_name
      end
    ) then
      raise exception 'A payment claim is already under review with different payer details.'
        using errcode = '40001';
    end if;

    select pcae.*
    into audit_record
    from public.payment_claim_audit_events pcae
    where pcae.claim_id = existing_claim.id
      and pcae.next_state = 'under_review'
    order by pcae.created_at asc, pcae.id asc
    limit 1;

    return query
    select
      existing_claim.id,
      existing_claim.obligation_id,
      existing_claim.payer_type,
      existing_claim.payer_name,
      existing_claim.status,
      existing_claim.created_at,
      audit_record.id;
    return;
  end if;

  if exists (
    select 1
    from public.payment_claims pc
    where pc.obligation_id = obligation_record.id
      and pc.status = 'approved'::public.payment_claim_status_enum
  ) then
    raise exception 'This payment obligation has already been approved.' using errcode = '23514';
  end if;

  insert into public.payment_claims (
    obligation_id,
    organization_id,
    claimant_user_id,
    payer_type,
    payer_name,
    status
  )
  values (
    obligation_record.id,
    obligation_record.organization_id,
    actor_id,
    case
      when p_paid_by_applicant then 'applicant'::public.payment_claim_payer_type_enum
      else 'other'::public.payment_claim_payer_type_enum
    end,
    case when p_paid_by_applicant then null else normalized_payer_name end,
    'under_review'::public.payment_claim_status_enum
  )
  returning * into inserted_claim;

  insert into public.payment_claim_audit_events (
    organization_id,
    obligation_id,
    claim_id,
    actor_user_id,
    previous_state,
    next_state
  )
  values (
    obligation_record.organization_id,
    obligation_record.id,
    inserted_claim.id,
    actor_id,
    'payment_available',
    'under_review'
  )
  returning * into audit_record;

  return query
  select
    inserted_claim.id,
    inserted_claim.obligation_id,
    inserted_claim.payer_type,
    inserted_claim.payer_name,
    inserted_claim.status,
    inserted_claim.created_at,
    audit_record.id;
end;
$function$;
COMMENT ON FUNCTION public.claim_recurring_payment(uuid,boolean,text) IS 'Records a recurring payment claim only on or after the obligation''s snapshotted local availability date.';
REVOKE ALL ON FUNCTION public.claim_recurring_payment(uuid, boolean, text) FROM anon;
CREATE FUNCTION public.clamped_billing_date(p_year integer, p_month integer, p_day integer)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select (
    make_date(p_year, p_month, 1)
      + (
        least(
          p_day,
          extract(day from (
            date_trunc('month', make_date(p_year, p_month, 1))
              + interval '1 month - 1 day'
          ))::integer
        ) - 1
      ) * interval '1 day'
  )::date;
$function$;
REVOKE ALL ON FUNCTION public.clamped_billing_date(integer, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.clamped_billing_date(integer, integer, integer) FROM authenticated;
CREATE FUNCTION public.contribution_reminder_backoff(p_attempt_count integer)
 RETURNS interval
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select make_interval(
    secs => least(
      3600::double precision,
      60::double precision * power(
        2::double precision,
        greatest(coalesce(p_attempt_count, 1) - 1, 0)
      )
    )
  );
$function$;
REVOKE ALL ON FUNCTION public.contribution_reminder_backoff(integer) FROM anon;
REVOKE ALL ON FUNCTION public.contribution_reminder_backoff(integer) FROM authenticated;
REVOKE ALL ON FUNCTION public.contribution_reminder_backoff(integer) FROM service_role;
CREATE FUNCTION public.contribution_reminder_delivery_at(p_stage_on date, p_timezone text, p_local_time time without time zone)
 RETURNS timestamp with time zone
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select (
    p_stage_on::timestamp
      + (p_local_time - time '00:00:00')
  ) at time zone p_timezone;
$function$;
REVOKE ALL ON FUNCTION public.contribution_reminder_delivery_at(date, text, time without time zone) FROM anon;
REVOKE ALL ON FUNCTION public.contribution_reminder_delivery_at(date, text, time without time zone) FROM authenticated;
REVOKE ALL ON FUNCTION public.contribution_reminder_delivery_at(date, text, time without time zone) FROM service_role;
CREATE FUNCTION public.contribution_reminder_stage_for_date(p_available_on date, p_due_on date, p_local_date date)
 RETURNS public.contribution_reminder_stage_enum
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_local_date >= p_due_on + 7 then
      'overdue'::public.contribution_reminder_stage_enum
    when p_local_date >= p_due_on then
      'due'::public.contribution_reminder_stage_enum
    when p_local_date >= p_available_on then
      'available'::public.contribution_reminder_stage_enum
    else null
  end;
$function$;
REVOKE ALL ON FUNCTION public.contribution_reminder_stage_for_date(date, date, date) FROM anon;
REVOKE ALL ON FUNCTION public.contribution_reminder_stage_for_date(date, date, date) FROM authenticated;
REVOKE ALL ON FUNCTION public.contribution_reminder_stage_for_date(date, date, date) FROM service_role;
CREATE FUNCTION public.enqueue_contribution_reminder_events_at(p_as_of timestamp with time zone)
 RETURNS TABLE(created_count integer, skipped_count integer, suppressed_count integer, coalesced_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  evaluated_at timestamp with time zone := coalesce(p_as_of, clock_timestamp());
  obligation_record record;
  stage_value public.contribution_reminder_stage_enum;
  stage_on_value date;
  local_date_value date;
  delivery_at_value timestamp with time zone;
  inserted_event public.contribution_reminder_events%rowtype;
  existing_event public.contribution_reminder_events%rowtype;
  batch_record public.contribution_reminder_batches%rowtype;
  affected_count integer;
begin
  if evaluated_at is null then
    raise exception 'The reminder evaluation clock is required.' using errcode = '22023';
  end if;

  created_count := 0;
  skipped_count := 0;
  suppressed_count := 0;
  coalesced_count := 0;

  update public.contribution_reminder_events event_record
  set
    status = 'suppressed'::public.contribution_reminder_event_status_enum,
    suppression_reason = case
      when po.status = 'settled'::public.payment_obligation_status_enum
        then 'obligation_settled'
      when po.status = 'void'::public.payment_obligation_status_enum
        then 'obligation_void'
      when exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      ) then 'claim_under_review'
      else 'membership_not_active'
    end,
    updated_at = clock_timestamp()
  from public.payment_obligations po
  where event_record.obligation_id = po.id
    and event_record.status = 'pending'::public.contribution_reminder_event_status_enum
    and (
      po.status in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      or exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      )
      or not exists (
        select 1
        from public.organization_members om
        join public.subscriptions s
          on s.organization_id = om.organization_id
          and s.user_id = om.user_id
          and s.status = 'active'::public.subscription_status_enum
        where om.organization_id = po.organization_id
          and om.user_id = po.user_id
          and om.role in (
            'admin'::public.organization_role_enum,
            'member'::public.organization_role_enum
          )
      )
    );
  get diagnostics affected_count = row_count;
  suppressed_count := suppressed_count + affected_count;

  for obligation_record in
    select
      po.id,
      po.organization_id,
      po.user_id,
      po.available_on,
      po.due_on,
      coalesce(po.billing_timezone, o.billing_timezone) as billing_timezone,
      o.contribution_reminder_local_time
    from public.payment_obligations po
    join public.organizations o on o.id = po.organization_id
    join public.organization_members om
      on om.organization_id = po.organization_id
      and om.user_id = po.user_id
      and om.role in (
        'admin'::public.organization_role_enum,
        'member'::public.organization_role_enum
      )
    join public.subscriptions s
      on s.organization_id = po.organization_id
      and s.user_id = po.user_id
      and s.status = 'active'::public.subscription_status_enum
    where po.purpose = 'recurring'::public.payment_obligation_purpose_enum
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and o.organization_type = 'association'::public.organization_type_enum
      and not exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      )
    order by po.organization_id, po.user_id, po.due_on, po.id
  loop
    local_date_value := timezone(
      obligation_record.billing_timezone,
      evaluated_at
    )::date;
    stage_value := public.contribution_reminder_stage_for_date(
      obligation_record.available_on,
      obligation_record.due_on,
      local_date_value
    );

    if stage_value is null then
      skipped_count := skipped_count + 1;
      continue;
    end if;

    stage_on_value := case stage_value
      when 'available'::public.contribution_reminder_stage_enum
        then obligation_record.available_on
      when 'due'::public.contribution_reminder_stage_enum
        then obligation_record.due_on
      else obligation_record.due_on + 7
    end;

    delivery_at_value := public.contribution_reminder_delivery_at(
      stage_on_value,
      obligation_record.billing_timezone,
      obligation_record.contribution_reminder_local_time
    );

    if evaluated_at < delivery_at_value then
      skipped_count := skipped_count + 1;
      continue;
    end if;

    update public.contribution_reminder_events event_record
    set
      status = 'suppressed'::public.contribution_reminder_event_status_enum,
      suppression_reason = 'superseded_by_newer_stage',
      updated_at = clock_timestamp()
    where event_record.obligation_id = obligation_record.id
      and event_record.recipient_user_id = obligation_record.user_id
      and event_record.status = 'pending'::public.contribution_reminder_event_status_enum
      and event_record.stage < stage_value;
    get diagnostics affected_count = row_count;
    suppressed_count := suppressed_count + affected_count;

    inserted_event := null;
    existing_event := null;
    insert into public.contribution_reminder_events (
      organization_id,
      obligation_id,
      recipient_user_id,
      stage,
      stage_on,
      delivery_window_on,
      status
    )
    values (
      obligation_record.organization_id,
      obligation_record.id,
      obligation_record.user_id,
      stage_value,
      stage_on_value,
      local_date_value,
      'pending'::public.contribution_reminder_event_status_enum
    )
    on conflict (obligation_id, recipient_user_id, stage)
    do nothing
    returning * into inserted_event;

    if inserted_event.id is null then
      select event_record.*
      into existing_event
      from public.contribution_reminder_events event_record
      where event_record.obligation_id = obligation_record.id
        and event_record.recipient_user_id = obligation_record.user_id
        and event_record.stage = stage_value;
    else
      created_count := created_count + 1;
      existing_event := inserted_event;
    end if;

    if existing_event.status <>
      'pending'::public.contribution_reminder_event_status_enum then
      continue;
    end if;

    batch_record := null;
    insert into public.contribution_reminder_batches (
      organization_id,
      recipient_user_id,
      delivery_window_on
    )
    values (
      obligation_record.organization_id,
      obligation_record.user_id,
      local_date_value
    )
    on conflict (organization_id, recipient_user_id, delivery_window_on)
    do update set updated_at = clock_timestamp()
    returning * into batch_record;

    insert into public.contribution_reminder_batch_events (batch_id, event_id)
    values (batch_record.id, existing_event.id)
    on conflict (event_id) do nothing;

    if batch_record.status =
      'delivered'::public.contribution_reminder_batch_status_enum then
      update public.contribution_reminder_events
      set
        status = 'coalesced'::public.contribution_reminder_event_status_enum,
        suppression_reason = 'coalesced_into_completed_window',
        updated_at = clock_timestamp()
      where id = existing_event.id
        and status = 'pending'::public.contribution_reminder_event_status_enum;
      if found then
        coalesced_count := coalesced_count + 1;
      end if;
    elsif batch_record.status =
      'no_device'::public.contribution_reminder_batch_status_enum then
      update public.contribution_reminder_events
      set
        status = 'no_device'::public.contribution_reminder_event_status_enum,
        suppression_reason = 'no_current_device',
        updated_at = clock_timestamp()
      where id = existing_event.id
        and status = 'pending'::public.contribution_reminder_event_status_enum;
    elsif batch_record.status =
      'terminal'::public.contribution_reminder_batch_status_enum then
      update public.contribution_reminder_events
      set
        status = 'exhausted'::public.contribution_reminder_event_status_enum,
        suppression_reason = 'delivery_exhausted',
        updated_at = clock_timestamp()
      where id = existing_event.id
        and status = 'pending'::public.contribution_reminder_event_status_enum;
    elsif batch_record.status =
      'suppressed'::public.contribution_reminder_batch_status_enum then
      update public.contribution_reminder_events
      set
        status = 'suppressed'::public.contribution_reminder_event_status_enum,
        suppression_reason = 'batch_suppressed',
        updated_at = clock_timestamp()
      where id = existing_event.id
        and status = 'pending'::public.contribution_reminder_event_status_enum;
    end if;
  end loop;

  update public.contribution_reminder_batches queued_batch
  set
    status = 'suppressed'::public.contribution_reminder_batch_status_enum,
    last_failure_code = 'no_pending_events',
    updated_at = clock_timestamp()
  where queued_batch.status =
      'pending'::public.contribution_reminder_batch_status_enum
    and not exists (
      select 1
      from public.contribution_reminder_batch_events batch_event
      join public.contribution_reminder_events event_record
        on event_record.id = batch_event.event_id
      where batch_event.batch_id = queued_batch.id
        and event_record.status =
          'pending'::public.contribution_reminder_event_status_enum
    )
    and not exists (
      select 1
      from public.contribution_reminder_delivery_attempts delivery_attempt
      where delivery_attempt.batch_id = queued_batch.id
    );
  return next;
end;
$function$;
REVOKE ALL ON FUNCTION public.enqueue_contribution_reminder_events_at(timestamp with time zone) FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_contribution_reminder_events_at(timestamp with time zone) FROM authenticated;
REVOKE ALL ON FUNCTION public.enqueue_contribution_reminder_events_at(timestamp with time zone) FROM service_role;
CREATE FUNCTION public.enqueue_contribution_reminder_events()
 RETURNS TABLE(created_count integer, skipped_count integer, suppressed_count integer, coalesced_count integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select *
  from public.enqueue_contribution_reminder_events_at(clock_timestamp());
$function$;
COMMENT ON FUNCTION public.enqueue_contribution_reminder_events() IS 'Trusted scheduler command that creates only the latest useful reminder stage for each eligible recurring obligation.';
REVOKE ALL ON FUNCTION public.enqueue_contribution_reminder_events() FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_contribution_reminder_events() FROM authenticated;
CREATE FUNCTION public.ensure_contribution_schedule(p_organization_id uuid, p_user_id uuid, p_admission_date date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  organization_record public.organizations%rowtype;
  subscription_record public.subscriptions%rowtype;
  schedule_record public.contribution_schedules%rowtype;
  admission_date_value date;
  cadence_value public.contribution_cadence_enum;
  amount_value integer;
  pix_value text;
begin
  select o.*
  into organization_record
  from public.organizations o
  where o.id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum
  for update;

  if not found then
    return null;
  end if;

  if not public.is_valid_billing_timezone(organization_record.billing_timezone)
    or organization_record.billing_due_day not between 1 and 31
    or organization_record.billing_lead_days not between 0 and 31
    or organization_record.billing_currency !~ '^[A-Z]{3}$' then
    raise exception 'The association billing policy is invalid.' using errcode = '23514';
  end if;

  select s.*
  into subscription_record
  from public.subscriptions s
  where s.organization_id = p_organization_id
    and s.user_id = p_user_id
    and s.status = 'active'::public.subscription_status_enum
  for update;

  if not found then
    return null;
  end if;

  cadence_value := case
    when subscription_record.plan_type = 'annual'::public.subscription_plan_type_enum
      then 'annual'::public.contribution_cadence_enum
    else 'monthly'::public.contribution_cadence_enum
  end;
  amount_value := case subscription_record.plan_type
    when 'annual'::public.subscription_plan_type_enum
      then organization_record.annual_price_amount
    else organization_record.monthly_price_amount
  end;
  pix_value := case subscription_record.plan_type
    when 'annual'::public.subscription_plan_type_enum
      then organization_record.annual_pix_copy_paste
    else organization_record.monthly_pix_copy_paste
  end;

  if amount_value is null or amount_value <= 0
    or nullif(btrim(pix_value), '') is null then
    raise exception 'The association contribution price or PIX configuration is incomplete.'
      using errcode = '23514';
  end if;

  admission_date_value := coalesce(
    p_admission_date,
    (
      select timezone(organization_record.billing_timezone, om.joined_at)::date
      from public.organization_members om
      where om.organization_id = p_organization_id
        and om.user_id = p_user_id
    ),
    timezone(organization_record.billing_timezone, clock_timestamp())::date
  );

  insert into public.contribution_schedules (
    organization_id,
    user_id,
    cadence,
    admission_date,
    due_day,
    lead_days,
    billing_timezone,
    currency,
    active
  )
  values (
    p_organization_id,
    p_user_id,
    cadence_value,
    admission_date_value,
    organization_record.billing_due_day,
    organization_record.billing_lead_days,
    organization_record.billing_timezone,
    organization_record.billing_currency,
    true
  )
  on conflict (organization_id, user_id) do update
  set active = true
  returning * into schedule_record;

  if schedule_record.id is null then
    select cs.*
    into schedule_record
    from public.contribution_schedules cs
    where cs.organization_id = p_organization_id
      and cs.user_id = p_user_id
    for update;
  end if;

  perform 1
  from public.contribution_plan_assignments cpa
  where cpa.schedule_id = schedule_record.id
    and cpa.effective_period_start = schedule_record.admission_date
  for update;

  if not found then
    insert into public.contribution_plan_assignments (
      schedule_id,
      effective_period_start,
      plan_type,
      amount,
      currency,
      due_day,
      lead_days,
      billing_timezone,
      pix_copy_paste
    )
    values (
      schedule_record.id,
      schedule_record.admission_date,
      subscription_record.plan_type,
      amount_value,
      organization_record.billing_currency,
      schedule_record.due_day,
      schedule_record.lead_days,
      schedule_record.billing_timezone,
      pix_value
    );
  end if;

  return schedule_record.id;
end;
$function$;
REVOKE ALL ON FUNCTION public.ensure_contribution_schedule(uuid, uuid, date) FROM anon;
REVOKE ALL ON FUNCTION public.ensure_contribution_schedule(uuid, uuid, date) FROM authenticated;
CREATE FUNCTION public.first_recurring_due_date(p_admission_date date, p_cadence public.contribution_cadence_enum, p_due_day integer)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  candidate_month date;
  candidate_due date;
  minimum_due date;
begin
  if p_cadence = 'annual'::public.contribution_cadence_enum then
    return public.clamped_billing_date(
      extract(year from p_admission_date)::integer + 1,
      extract(month from p_admission_date)::integer,
      p_due_day
    );
  end if;

  minimum_due := (p_admission_date + interval '1 month')::date;
  candidate_month := date_trunc('month', minimum_due)::date;
  candidate_due := public.clamped_billing_date(
    extract(year from candidate_month)::integer,
    extract(month from candidate_month)::integer,
    p_due_day
  );

  if candidate_due < minimum_due then
    candidate_month := (candidate_month + interval '1 month')::date;
    candidate_due := public.clamped_billing_date(
      extract(year from candidate_month)::integer,
      extract(month from candidate_month)::integer,
      p_due_day
    );
  end if;

  return candidate_due;
end;
$function$;
REVOKE ALL ON FUNCTION public.first_recurring_due_date(date, public.contribution_cadence_enum, integer) FROM anon;
REVOKE ALL ON FUNCTION public.first_recurring_due_date(date, public.contribution_cadence_enum, integer) FROM authenticated;
CREATE FUNCTION public.generate_membership_billing_obligations_at(p_as_of timestamp with time zone)
 RETURNS TABLE(schedule_id uuid, period_key text, obligation_id uuid, result text, failure_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  evaluated_at timestamp with time zone := coalesce(p_as_of, clock_timestamp());
  schedule_record record;
  assignment_record record;
  term_count integer;
  local_date_value date;
  due_date_value date;
  next_due_date_value date;
  period_key_value text;
  period_start_value date;
  period_end_value date;
  available_on_value date;
  created_obligation public.payment_obligations%rowtype;
  existing_obligation public.payment_obligations%rowtype;
  cadence_value public.contribution_cadence_enum;
begin
  if evaluated_at is null then
    raise exception 'The generation clock is required.' using errcode = '22023';
  end if;

  for schedule_record in
    select
      cs.*,
      o.name as organization_name,
      o.slug as organization_slug
    from public.contribution_schedules cs
    join public.organizations o on o.id = cs.organization_id
    join public.organization_members om
      on om.organization_id = cs.organization_id
      and om.user_id = cs.user_id
    join public.subscriptions s
      on s.organization_id = cs.organization_id
      and s.user_id = cs.user_id
      and s.status = 'active'::public.subscription_status_enum
    where cs.active
      and o.organization_type = 'association'::public.organization_type_enum
      and om.role in (
        'admin'::public.organization_role_enum,
        'member'::public.organization_role_enum
      )
    order by cs.organization_id, cs.user_id
  loop
    begin
      if not public.is_valid_billing_timezone(schedule_record.billing_timezone)
        or schedule_record.due_day not between 1 and 31
        or schedule_record.lead_days not between 0 and 31
        or schedule_record.currency !~ '^[A-Z]{3}$' then
        schedule_id := schedule_record.id;
        period_key := null;
        obligation_id := null;
        result := 'failed';
        failure_reason := 'The contribution schedule billing policy is invalid.';
        return next;
        continue;
      end if;

      local_date_value := timezone(
        schedule_record.billing_timezone,
        evaluated_at
      )::date;
      term_count := 0;

      for assignment_record in
        select
          cpa.*,
          lead(cpa.effective_period_start) over (
            order by cpa.effective_period_start, cpa.id
          ) as next_effective_period_start
        from public.contribution_plan_assignments cpa
        where cpa.schedule_id = schedule_record.id
        order by cpa.effective_period_start, cpa.id
      loop
        term_count := term_count + 1;
        cadence_value := case
          when assignment_record.plan_type = 'annual'::public.subscription_plan_type_enum
            then 'annual'::public.contribution_cadence_enum
          else 'monthly'::public.contribution_cadence_enum
        end;

        if assignment_record.due_day is null
          or assignment_record.due_day not between 1 and 31
          or assignment_record.lead_days is null
          or assignment_record.lead_days not between 0 and 31
          or not public.is_valid_billing_timezone(assignment_record.billing_timezone)
          or assignment_record.currency !~ '^[A-Z]{3}$'
          or assignment_record.amount is null
          or assignment_record.amount <= 0 then
          schedule_id := schedule_record.id;
          period_key := null;
          obligation_id := null;
          result := 'failed';
          failure_reason := 'The recurring billing term is invalid or has no positive price.';
          return next;
          continue;
        end if;

        due_date_value := public.recurring_due_date_on_or_after(
          schedule_record.admission_date,
          cadence_value,
          assignment_record.due_day,
          greatest(
            schedule_record.admission_date,
            assignment_record.effective_period_start
          )
        );

        while due_date_value - assignment_record.lead_days <= local_date_value loop
          if assignment_record.next_effective_period_start is not null
            and due_date_value >= assignment_record.next_effective_period_start then
            exit;
          end if;

          next_due_date_value := public.next_recurring_due_date(
            due_date_value,
            cadence_value,
            assignment_record.due_day
          );
          period_start_value := due_date_value;
          period_end_value := next_due_date_value - 1;
          available_on_value := due_date_value - assignment_record.lead_days;
          period_key_value := public.recurring_period_key(
            cadence_value,
            due_date_value
          );

          if nullif(btrim(assignment_record.pix_copy_paste), '') is null then
            schedule_id := schedule_record.id;
            period_key := period_key_value;
            obligation_id := null;
            result := 'failed';
            failure_reason := 'No PIX snapshot exists for the recurring period.';
            return next;
            due_date_value := next_due_date_value;
            continue;
          end if;

          created_obligation := null;
          existing_obligation := null;

          insert into public.payment_obligations (
            organization_id,
            user_id,
            application_revision_id,
            purpose,
            status,
            plan_type,
            amount,
            currency,
            payment_method,
            pix_copy_paste,
            available_at,
            schedule_id,
            schedule_term_id,
            period_key,
            period_start,
            period_end,
            available_on,
            due_on,
            billing_timezone,
            billing_due_day,
            billing_lead_days,
            organization_name_snapshot,
            organization_slug_snapshot
          )
          values (
            schedule_record.organization_id,
            schedule_record.user_id,
            null,
            'recurring'::public.payment_obligation_purpose_enum,
            'available'::public.payment_obligation_status_enum,
            assignment_record.plan_type,
            assignment_record.amount,
            assignment_record.currency,
            'manual_pix',
            assignment_record.pix_copy_paste,
            available_on_value::timestamp at time zone assignment_record.billing_timezone,
            schedule_record.id,
            assignment_record.id,
            period_key_value,
            period_start_value,
            period_end_value,
            available_on_value,
            due_date_value,
            assignment_record.billing_timezone,
            assignment_record.due_day,
            assignment_record.lead_days,
            schedule_record.organization_name,
            schedule_record.organization_slug
          )
          on conflict on constraint payment_obligations_schedule_period_key
          do nothing
          returning * into created_obligation;

          if created_obligation.id is null then
            select po.*
            into existing_obligation
            from public.payment_obligations po
            where po.schedule_id = schedule_record.id
              and po.period_key = period_key_value
              and po.purpose = 'recurring'::public.payment_obligation_purpose_enum;
          else
            existing_obligation := created_obligation;
          end if;

          schedule_id := schedule_record.id;
          period_key := period_key_value;
          obligation_id := existing_obligation.id;
          result := case
            when created_obligation.id is null then 'already_exists'
            else 'created'
          end;
          failure_reason := null;
          return next;

          due_date_value := next_due_date_value;
        end loop;
      end loop;

      if term_count = 0 then
        schedule_id := schedule_record.id;
        period_key := null;
        obligation_id := null;
        result := 'failed';
        failure_reason := 'No effective-dated billing term exists for the schedule.';
        return next;
      end if;
    exception
      when others then
        schedule_id := schedule_record.id;
        period_key := null;
        obligation_id := null;
        result := 'failed';
        failure_reason := sqlerrm;
        return next;
    end;
  end loop;
end;
$function$;
REVOKE ALL ON FUNCTION public.generate_membership_billing_obligations_at(timestamp with time zone) FROM anon;
REVOKE ALL ON FUNCTION public.generate_membership_billing_obligations_at(timestamp with time zone) FROM authenticated;
REVOKE ALL ON FUNCTION public.generate_membership_billing_obligations_at(timestamp with time zone) FROM service_role;
CREATE FUNCTION public.generate_membership_billing_obligations()
 RETURNS TABLE(schedule_id uuid, period_key text, obligation_id uuid, result text, failure_reason text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select *
  from public.generate_membership_billing_obligations_at(clock_timestamp());
$function$;
COMMENT ON FUNCTION public.generate_membership_billing_obligations() IS 'Trusted scheduler command. Derives the database clock and materializes every available recurring period exactly once.';
REVOKE ALL ON FUNCTION public.generate_membership_billing_obligations() FROM anon;
REVOKE ALL ON FUNCTION public.generate_membership_billing_obligations() FROM authenticated;
CREATE FUNCTION public.get_billing_workspace_claim_detail(p_claim_id uuid)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, organization_id uuid, organization_name text, organization_slug text, purpose public.payment_obligation_purpose_enum, member_user_id uuid, member_name text, member_handle text, member_profile_picture text, claim_status public.payment_claim_status_enum, payer_type public.payment_claim_payer_type_enum, payer_name text, claim_created_at timestamp with time zone, claim_decided_at timestamp with time zone, claim_decision_reason text, plan_type public.subscription_plan_type_enum, amount integer, currency text, period_key text, period_start date, period_end date, available_on date, due_on date, attempt_count bigint, claim_history jsonb, audit_history jsonb, approve_command text, reject_command text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    pc.id,
    po.id,
    pc.organization_id,
    o.name,
    o.slug,
    po.purpose,
    pc.claimant_user_id,
    member_profile.name,
    member_profile.username,
    member_profile.profile_picture,
    pc.status,
    pc.payer_type,
    pc.payer_name,
    pc.created_at,
    pc.decided_at,
    pc.decision_reason,
    po.plan_type,
    po.amount,
    po.currency,
    po.period_key,
    po.period_start,
    po.period_end,
    po.available_on,
    po.due_on,
    (
      select count(*)
      from public.payment_claims attempts
      where attempts.obligation_id = po.id
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'claim_id', history.id,
            'status', history.status,
            'payer_type', history.payer_type,
            'payer_name', history.payer_name,
            'created_at', history.created_at,
            'decided_at', history.decided_at,
            'decision_reason', history.decision_reason
          )
          order by history.created_at asc, history.id asc
        )
        from public.payment_claims history
        where history.obligation_id = po.id
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', audit.id,
            'claim_id', audit.claim_id,
            'actor_user_id', audit.actor_user_id,
            'actor_name', actor_profile.name,
            'actor_handle', actor_profile.username,
            'previous_state', audit.previous_state,
            'next_state', audit.next_state,
            'reason', audit.reason,
            'created_at', audit.created_at
          )
          order by audit.created_at asc, audit.id asc
        )
        from public.payment_claim_audit_events audit
        left join public.profiles actor_profile on actor_profile.id = audit.actor_user_id
        where audit.obligation_id = po.id
      ),
      '[]'::jsonb
    ),
    case
      when pc.status = 'under_review'::public.payment_claim_status_enum
        and po.status = 'available'::public.payment_obligation_status_enum
        then case po.purpose
          when 'initial_admission'::public.payment_obligation_purpose_enum
            then 'approve_initial_claim'
          else 'approve_recurring_payment_claim'
        end
      else null
    end,
    case
      when pc.status = 'under_review'::public.payment_claim_status_enum
        and po.status = 'available'::public.payment_obligation_status_enum
        then case po.purpose
          when 'initial_admission'::public.payment_obligation_purpose_enum
            then 'reject_initial_claim'
          else 'reject_recurring_payment_claim'
        end
      else null
    end
  from public.payment_claims pc
  join public.payment_obligations po on po.id = pc.obligation_id
  join public.organizations o on o.id = pc.organization_id
  join public.profiles member_profile on member_profile.id = pc.claimant_user_id
  left join public.membership_application_revisions mar
    on mar.id = po.application_revision_id
  left join public.membership_applications ma
    on ma.id = mar.application_id
  where pc.id = p_claim_id
    and pc.organization_id = po.organization_id
    and o.organization_type = 'association'::public.organization_type_enum
    and pc.claimant_user_id <> (select auth.uid())
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = pc.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    )
    and (
      po.purpose = 'recurring'::public.payment_obligation_purpose_enum
      or (
        po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
        and po.application_revision_id = mar.id
        and mar.organization_id = pc.organization_id
        and mar.user_id = pc.claimant_user_id
        and ma.organization_id = pc.organization_id
        and ma.user_id = pc.claimant_user_id
        and ma.status = 'submitted'::public.membership_application_status_enum
      )
    );
$function$;
COMMENT ON FUNCTION public.get_billing_workspace_claim_detail(uuid) IS 'Returns authorized common claim detail and immutable chronology for either payment purpose without application-private fields.';
REVOKE ALL ON FUNCTION public.get_billing_workspace_claim_detail(uuid) FROM anon;
CREATE FUNCTION public.get_billing_workspace_members(p_organization_id uuid)
 RETURNS TABLE(member_user_id uuid, member_name text, member_handle text, member_profile_picture text, member_role public.organization_role_enum, joined_at timestamp with time zone, financial_standing text, overdue_count bigint, oldest_attention_due_on date, plan_type public.subscription_plan_type_enum, last_verified_contribution_at timestamp with time zone, next_due_on date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    om.user_id,
    member_profile.name,
    member_profile.username,
    member_profile.profile_picture,
    om.role,
    om.joined_at,
    case
      when coalesce(financial.overdue_count, 0) > 0 then 'overdue'
      when coalesce(financial.payment_available_count, 0) > 0 then 'payment_available'
      when coalesce(financial.under_review_count, 0) > 0 then 'under_review'
      else 'up_to_date'
    end,
    coalesce(financial.overdue_count, 0),
    financial.oldest_attention_due_on,
    coalesce(current_term.plan_type, active_subscription.plan_type),
    financial.last_verified_contribution_at,
    financial.next_due_on
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  join public.profiles member_profile on member_profile.id = om.user_id
  left join public.subscriptions active_subscription
    on active_subscription.organization_id = om.organization_id
    and active_subscription.user_id = om.user_id
    and active_subscription.status = 'active'::public.subscription_status_enum
  left join lateral (
    select cpa.plan_type
    from public.contribution_plan_assignments cpa
    join public.contribution_schedules cs on cs.id = cpa.schedule_id
    where cs.organization_id = om.organization_id
      and cs.user_id = om.user_id
      and cs.active
      and cpa.effective_period_start <= timezone(o.billing_timezone, clock_timestamp())::date
    order by cpa.effective_period_start desc, cpa.id desc
    limit 1
  ) current_term on true
  left join lateral (
    select
      count(*) filter (
        where po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.status not in (
            'settled'::public.payment_obligation_status_enum,
            'void'::public.payment_obligation_status_enum
          )
          and po.due_on < timezone(
            coalesce(po.billing_timezone, o.billing_timezone),
            clock_timestamp()
          )::date
      ) as overdue_count,
      count(*) filter (
        where po.status not in (
            'settled'::public.payment_obligation_status_enum,
            'void'::public.payment_obligation_status_enum
          )
          and not exists (
            select 1
            from public.payment_claims pc
            where pc.obligation_id = po.id
              and pc.status = 'under_review'::public.payment_claim_status_enum
          )
          and (
            (
              po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
              and po.available_at <= clock_timestamp()
            )
            or (
              po.purpose = 'recurring'::public.payment_obligation_purpose_enum
              and po.available_on <= timezone(
                coalesce(po.billing_timezone, o.billing_timezone),
                clock_timestamp()
              )::date
            )
          )
      ) as payment_available_count,
      count(*) filter (
        where po.status not in (
          'settled'::public.payment_obligation_status_enum,
          'void'::public.payment_obligation_status_enum
        )
        and exists (
          select 1
          from public.payment_claims pc
          where pc.obligation_id = po.id
            and pc.status = 'under_review'::public.payment_claim_status_enum
        )
      ) as under_review_count,
      min(
        case
          when po.status not in (
            'settled'::public.payment_obligation_status_enum,
            'void'::public.payment_obligation_status_enum
          )
          and (
            po.due_on < timezone(
              coalesce(po.billing_timezone, o.billing_timezone),
              clock_timestamp()
            )::date
            or po.available_at <= clock_timestamp()
            or po.available_on <= timezone(
              coalesce(po.billing_timezone, o.billing_timezone),
              clock_timestamp()
            )::date
            or exists (
              select 1
              from public.payment_claims pc
              where pc.obligation_id = po.id
                and pc.status = 'under_review'::public.payment_claim_status_enum
            )
          ) then po.due_on
        end
      ) as oldest_attention_due_on,
      max(
        case
          when po.status = 'settled'::public.payment_obligation_status_enum
            then po.settled_at
        end
      ) as last_verified_contribution_at,
      min(
        case
          when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
            and po.status not in (
              'settled'::public.payment_obligation_status_enum,
              'void'::public.payment_obligation_status_enum
            )
            and po.due_on >= timezone(
              coalesce(po.billing_timezone, o.billing_timezone),
              clock_timestamp()
            )::date
            then po.due_on
        end
      ) as next_due_on
    from public.payment_obligations po
    where po.organization_id = om.organization_id
      and po.user_id = om.user_id
  ) financial on true
  where p_organization_id is not null
    and om.organization_id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum
    and om.role in (
      'admin'::public.organization_role_enum,
      'member'::public.organization_role_enum
    )
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = om.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    )
  order by member_profile.name, member_profile.username, om.user_id;
$function$;
COMMENT ON FUNCTION public.get_billing_workspace_members(uuid) IS 'Returns the active association roster with server-derived financial standing and obligation attention.';
REVOKE ALL ON FUNCTION public.get_billing_workspace_members(uuid) FROM anon;
CREATE FUNCTION public.get_billing_workspace_organizations()
 RETURNS TABLE(organization_id uuid, organization_name text, organization_slug text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    o.id,
    o.name,
    o.slug
  from public.organizations o
  where o.organization_type = 'association'::public.organization_type_enum
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = o.id
        and om.user_id = (select auth.uid())
        and om.role = 'admin'::public.organization_role_enum
    )
  order by o.name, o.id;
$function$;
COMMENT ON FUNCTION public.get_billing_workspace_organizations() IS 'Returns the associations where the signed-in person may open the billing workspace.';
REVOKE ALL ON FUNCTION public.get_billing_workspace_organizations() FROM anon;
CREATE FUNCTION public.get_billing_workspace_payments(p_organization_id uuid)
 RETURNS TABLE(obligation_id uuid, organization_id uuid, purpose public.payment_obligation_purpose_enum, member_user_id uuid, member_name text, member_handle text, plan_type public.subscription_plan_type_enum, amount integer, currency text, period_key text, period_start date, period_end date, available_on date, due_on date, obligation_status public.payment_obligation_status_enum, effective_payment_state text, settled_at timestamp with time zone, latest_claim_id uuid, latest_claim_status public.payment_claim_status_enum, latest_claim_created_at timestamp with time zone, latest_claim_decided_at timestamp with time zone, latest_claim_decision_reason text, last_decision_actor_user_id uuid, last_decision_actor_name text, last_decision_at timestamp with time zone, claim_history jsonb, audit_history jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    po.id,
    po.organization_id,
    po.purpose,
    po.user_id,
    member_profile.name,
    member_profile.username,
    po.plan_type,
    po.amount,
    po.currency,
    po.period_key,
    po.period_start,
    po.period_end,
    po.available_on,
    po.due_on,
    po.status,
    case
      when po.status = 'settled'::public.payment_obligation_status_enum then 'settled'
      when po.status = 'void'::public.payment_obligation_status_enum then 'void'
      when exists (
        select 1
        from public.payment_claims under_review
        where under_review.obligation_id = po.id
          and under_review.status = 'under_review'::public.payment_claim_status_enum
      ) then 'under_review'
      when po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
        and po.available_at <= clock_timestamp() then 'available'
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.due_on < timezone(
          coalesce(po.billing_timezone, o.billing_timezone),
          clock_timestamp()
        )::date then 'overdue'
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.available_on <= timezone(
          coalesce(po.billing_timezone, o.billing_timezone),
          clock_timestamp()
        )::date then 'available'
      else 'scheduled'
    end,
    po.settled_at,
    latest_claim.id,
    latest_claim.status,
    latest_claim.created_at,
    latest_claim.decided_at,
    latest_claim.decision_reason,
    last_decision.actor_user_id,
    last_decision.actor_name,
    last_decision.created_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'claim_id', history.id,
            'status', history.status,
            'payer_type', history.payer_type,
            'payer_name', history.payer_name,
            'created_at', history.created_at,
            'decided_at', history.decided_at,
            'decision_reason', history.decision_reason
          )
          order by history.created_at asc, history.id asc
        )
        from public.payment_claims history
        where history.obligation_id = po.id
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', audit.id,
            'claim_id', audit.claim_id,
            'actor_user_id', audit.actor_user_id,
            'actor_name', actor_profile.name,
            'actor_handle', actor_profile.username,
            'previous_state', audit.previous_state,
            'next_state', audit.next_state,
            'reason', audit.reason,
            'created_at', audit.created_at
          )
          order by audit.created_at asc, audit.id asc
        )
        from public.payment_claim_audit_events audit
        left join public.profiles actor_profile on actor_profile.id = audit.actor_user_id
        where audit.obligation_id = po.id
      ),
      '[]'::jsonb
    )
  from public.payment_obligations po
  join public.organizations o on o.id = po.organization_id
  join public.profiles member_profile on member_profile.id = po.user_id
  left join lateral (
    select pc.*
    from public.payment_claims pc
    where pc.obligation_id = po.id
    order by pc.created_at desc, pc.id desc
    limit 1
  ) latest_claim on true
  left join lateral (
    select
      audit.actor_user_id,
      actor_profile.name as actor_name,
      audit.created_at
    from public.payment_claim_audit_events audit
    left join public.profiles actor_profile on actor_profile.id = audit.actor_user_id
    where audit.obligation_id = po.id
      and audit.next_state in ('payment_available', 'payment_settled')
    order by audit.created_at desc, audit.id desc
    limit 1
  ) last_decision on true
  where p_organization_id is not null
    and po.organization_id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = po.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    )
  order by po.due_on desc, po.created_at desc, po.id desc;
$function$;
COMMENT ON FUNCTION public.get_billing_workspace_payments(uuid) IS 'Returns private organization-scoped obligation history with immutable claim decisions and server-derived actors.';
REVOKE ALL ON FUNCTION public.get_billing_workspace_payments(uuid) FROM anon;
CREATE FUNCTION public.get_billing_workspace_queue(p_organization_id uuid)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, organization_id uuid, purpose public.payment_obligation_purpose_enum, member_user_id uuid, member_name text, member_handle text, member_profile_picture text, payer_type public.payment_claim_payer_type_enum, payer_name text, plan_type public.subscription_plan_type_enum, amount integer, currency text, period_key text, period_start date, period_end date, available_on date, due_on date, claim_created_at timestamp with time zone, claim_decided_at timestamp with time zone, claim_decision_reason text, claim_status public.payment_claim_status_enum, attempt_count bigint, approve_command text, reject_command text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    pc.id,
    po.id,
    pc.organization_id,
    po.purpose,
    pc.claimant_user_id,
    member_profile.name,
    member_profile.username,
    member_profile.profile_picture,
    pc.payer_type,
    pc.payer_name,
    po.plan_type,
    po.amount,
    po.currency,
    po.period_key,
    po.period_start,
    po.period_end,
    po.available_on,
    po.due_on,
    pc.created_at,
    pc.decided_at,
    pc.decision_reason,
    pc.status,
    (
      select count(*)
      from public.payment_claims attempts
      where attempts.obligation_id = po.id
    ),
    case
      when pc.status = 'under_review'::public.payment_claim_status_enum
        and po.status = 'available'::public.payment_obligation_status_enum
        and (
          (
            po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
            and po.available_at <= clock_timestamp()
          )
          or (
            po.purpose = 'recurring'::public.payment_obligation_purpose_enum
            and po.available_on <= timezone(
              coalesce(po.billing_timezone, o.billing_timezone),
              clock_timestamp()
            )::date
          )
        )
        then case po.purpose
          when 'initial_admission'::public.payment_obligation_purpose_enum
            then 'approve_initial_claim'
          else 'approve_recurring_payment_claim'
        end
      else null
    end,
    case
      when pc.status = 'under_review'::public.payment_claim_status_enum
        and po.status = 'available'::public.payment_obligation_status_enum
        and (
          (
            po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
            and po.available_at <= clock_timestamp()
          )
          or (
            po.purpose = 'recurring'::public.payment_obligation_purpose_enum
            and po.available_on <= timezone(
              coalesce(po.billing_timezone, o.billing_timezone),
              clock_timestamp()
            )::date
          )
        )
        then case po.purpose
          when 'initial_admission'::public.payment_obligation_purpose_enum
            then 'reject_initial_claim'
          else 'reject_recurring_payment_claim'
        end
      else null
    end
  from public.payment_claims pc
  join public.payment_obligations po on po.id = pc.obligation_id
  join public.organizations o on o.id = pc.organization_id
  join public.profiles member_profile on member_profile.id = pc.claimant_user_id
  left join public.membership_application_revisions mar
    on mar.id = po.application_revision_id
  left join public.membership_applications ma
    on ma.id = mar.application_id
  where p_organization_id is not null
    and pc.organization_id = p_organization_id
    and po.organization_id = pc.organization_id
    and o.organization_type = 'association'::public.organization_type_enum
    and pc.claimant_user_id <> (select auth.uid())
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = pc.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    )
    and (
      (
        po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
        and po.application_revision_id = mar.id
        and mar.organization_id = pc.organization_id
        and mar.user_id = pc.claimant_user_id
        and ma.organization_id = pc.organization_id
        and ma.user_id = pc.claimant_user_id
        and ma.status = 'submitted'::public.membership_application_status_enum
      )
      or (
        po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.schedule_id is not null
        and po.application_revision_id is null
        and po.user_id = pc.claimant_user_id
      )
    )
  order by pc.created_at asc, pc.id asc;
$function$;
COMMENT ON FUNCTION public.get_billing_workspace_queue(uuid) IS 'Returns organization-scoped claim history with safe member summaries and purpose-specific decision commands.';
REVOKE ALL ON FUNCTION public.get_billing_workspace_queue(uuid) FROM anon;
CREATE FUNCTION public.get_initial_payment_claim_detail(p_claim_id uuid)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, application_id uuid, application_revision_id uuid, revision_number integer, draft_version bigint, organization_id uuid, organization_name text, organization_slug text, claimant_user_id uuid, applicant_name text, applicant_handle text, applicant_profile_picture text, claim_status public.payment_claim_status_enum, payer_type public.payment_claim_payer_type_enum, payer_name text, claim_created_at timestamp with time zone, decided_at timestamp with time zone, decision_reason text, attempt_count bigint, plan_type public.subscription_plan_type_enum, amount integer, currency text, terms_version text, accepted_terms_at timestamp with time zone, submitted_at timestamp with time zone, full_name text, birth_date date, nationality text, marital_status public.marital_status_enum, profession text, birthplace text, cpf text, id_document_number text, id_document_issuer text, postal_code text, address_line text, city text, state text, email text, phone text, blood_type public.blood_type_enum, has_allergies boolean, allergies text, has_dietary_restrictions boolean, dietary_restrictions text, highline_experience public.highline_experience_enum, has_rescue_course boolean, first_aid_course public.first_aid_course_enum, emergency_contact_name text, emergency_contact_relationship text, emergency_contact_phone text, claim_history jsonb, audit_history jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    pc.id,
    po.id,
    mar.application_id,
    mar.id,
    mar.revision_number,
    mar.draft_version,
    pc.organization_id,
    o.name,
    o.slug,
    pc.claimant_user_id,
    p.name,
    p.username,
    p.profile_picture,
    pc.status,
    pc.payer_type,
    pc.payer_name,
    pc.created_at,
    pc.decided_at,
    pc.decision_reason,
    (
      select count(*)
      from public.payment_claims attempts
      where attempts.obligation_id = po.id
    ),
    mar.plan_type,
    mar.plan_amount,
    mar.currency,
    mar.terms_version,
    mar.accepted_terms_at,
    mar.submitted_at,
    mar.full_name,
    mar.birth_date,
    mar.nationality,
    mar.marital_status,
    mar.profession,
    mar.birthplace,
    mar.cpf,
    mar.id_document_number,
    mar.id_document_issuer,
    mar.postal_code,
    mar.address_line,
    mar.city,
    mar.state,
    mar.email,
    mar.phone,
    mar.blood_type,
    mar.has_allergies,
    mar.allergies,
    mar.has_dietary_restrictions,
    mar.dietary_restrictions,
    mar.highline_experience,
    mar.has_rescue_course,
    mar.first_aid_course,
    mar.emergency_contact_name,
    mar.emergency_contact_relationship,
    mar.emergency_contact_phone,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'claim_id', history.id,
            'status', history.status,
            'payer_type', history.payer_type,
            'payer_name', history.payer_name,
            'created_at', history.created_at,
            'decided_at', history.decided_at,
            'decision_reason', history.decision_reason
          )
          order by history.created_at asc, history.id asc
        )
        from public.payment_claims history
        where history.obligation_id = po.id
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', audit.id,
            'claim_id', audit.claim_id,
            'actor_user_id', audit.actor_user_id,
            'previous_state', audit.previous_state,
            'next_state', audit.next_state,
            'reason', audit.reason,
            'created_at', audit.created_at
          )
          order by audit.created_at asc, audit.id asc
        )
        from public.payment_claim_audit_events audit
        where audit.obligation_id = po.id
      ),
      '[]'::jsonb
    )
  from public.payment_claims pc
  join public.payment_obligations po on po.id = pc.obligation_id
  join public.membership_application_revisions mar
    on mar.id = po.application_revision_id
  join public.membership_applications ma on ma.id = mar.application_id
  join public.organizations o on o.id = pc.organization_id
  join public.profiles p on p.id = pc.claimant_user_id
  where pc.id = p_claim_id
    and pc.organization_id = po.organization_id
    and po.organization_id = mar.organization_id
    and po.user_id = mar.user_id
    and ma.organization_id = mar.organization_id
    and ma.user_id = mar.user_id
    and ma.status = 'submitted'::public.membership_application_status_enum
    and o.organization_type = 'association'::public.organization_type_enum
    and pc.claimant_user_id <> (select auth.uid())
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = pc.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    );
$function$;
COMMENT ON FUNCTION public.get_initial_payment_claim_detail(uuid) IS 'Returns the exact immutable submitted application revision and authorized claim history for an association admin.';
REVOKE ALL ON FUNCTION public.get_initial_payment_claim_detail(uuid) FROM anon;
CREATE FUNCTION public.get_initial_payment_claim_queue()
 RETURNS TABLE(claim_id uuid, obligation_id uuid, application_revision_id uuid, organization_id uuid, organization_name text, claimant_user_id uuid, applicant_name text, applicant_handle text, applicant_profile_picture text, payer_type public.payment_claim_payer_type_enum, payer_name text, plan_type public.subscription_plan_type_enum, amount integer, currency text, claim_created_at timestamp with time zone, attempt_count bigint, claim_status public.payment_claim_status_enum)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    pc.id,
    po.id,
    po.application_revision_id,
    pc.organization_id,
    o.name,
    pc.claimant_user_id,
    p.name,
    p.username,
    p.profile_picture,
    pc.payer_type,
    pc.payer_name,
    po.plan_type,
    po.amount,
    po.currency,
    pc.created_at,
    (
      select count(*)
      from public.payment_claims attempts
      where attempts.obligation_id = po.id
    ),
    pc.status
  from public.payment_claims pc
  join public.payment_obligations po on po.id = pc.obligation_id
  join public.membership_application_revisions mar
    on mar.id = po.application_revision_id
  join public.membership_applications ma on ma.id = mar.application_id
  join public.organizations o on o.id = pc.organization_id
  join public.profiles p on p.id = pc.claimant_user_id
  where pc.status = 'under_review'::public.payment_claim_status_enum
    and po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
    and po.status = 'available'::public.payment_obligation_status_enum
    and pc.organization_id = po.organization_id
    and po.organization_id = mar.organization_id
    and po.user_id = mar.user_id
    and ma.organization_id = mar.organization_id
    and ma.user_id = mar.user_id
    and ma.status = 'submitted'::public.membership_application_status_enum
    and o.organization_type = 'association'::public.organization_type_enum
    and pc.claimant_user_id <> (select auth.uid())
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = pc.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    )
  order by pc.created_at asc, pc.id asc;
$function$;
COMMENT ON FUNCTION public.get_initial_payment_claim_queue() IS 'Returns a privacy-preserving queue of current initial claims for associations where the caller is an admin.';
REVOKE ALL ON FUNCTION public.get_initial_payment_claim_queue() FROM anon;
CREATE FUNCTION public.get_membership_billing_ledger(p_organization_id uuid, p_history_cursor text DEFAULT NULL::text, p_history_limit integer DEFAULT 24)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  organization_record public.organizations%rowtype;
  application_record public.membership_applications%rowtype;
  schedule_record public.contribution_schedules%rowtype;
  evaluated_at_value timestamp with time zone := clock_timestamp();
  local_date_value date;
  legal_state text;
  financial_state text := 'up_to_date';
  application_correction_reason text;
  plan_type_value public.subscription_plan_type_enum;
  attention_obligation jsonb;
  next_obligation jsonb;
  history jsonb;
  history_count integer;
  history_limit_value integer := greatest(1, least(coalesce(p_history_limit, 24), 50));
  history_has_more boolean := false;
  history_next_cursor text;
  cursor_due_on date;
  cursor_obligation_id uuid;
  member_exists boolean := false;
  application_found boolean := false;
  next_assignment record;
  candidate_due_date date;
  candidate_next_due_date date;
  candidate_available_on date;
  candidate_period_start date;
  candidate_period_end date;
  candidate_plan_type public.subscription_plan_type_enum;
  candidate_amount integer;
  candidate_currency text;
  candidate_found boolean := false;
  candidate_effective_start date;
  selected_candidate_due_date date;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_organization_id is null then
    raise exception 'Organization is required.' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_history_cursor, '')), '') is not null then
    begin
      cursor_due_on := split_part(p_history_cursor, '|', 1)::date;
      cursor_obligation_id := split_part(p_history_cursor, '|', 2)::uuid;
    exception
      when others then
        raise exception 'The Ledger history cursor is invalid.' using errcode = '22023';
    end;
  end if;

  select o.*
  into organization_record
  from public.organizations o
  where o.id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum;

  if not found then
    raise exception 'Association was not found.' using errcode = '40400';
  end if;

  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = actor_id
  )
  into member_exists;

  select ma.*
  into application_record
  from public.membership_applications ma
  where ma.organization_id = p_organization_id
    and ma.user_id = actor_id
  order by ma.updated_at desc, ma.id desc
  limit 1;
  application_found := found;

  if not member_exists and not application_found then
    raise exception 'Membership Ledger was not found.' using errcode = '42501';
  end if;

  legal_state := case when member_exists then 'active' else 'applicant' end;
  local_date_value := timezone(
    organization_record.billing_timezone,
    evaluated_at_value
  )::date;

  select cs.*
  into schedule_record
  from public.contribution_schedules cs
  where cs.organization_id = p_organization_id
    and cs.user_id = actor_id
    and cs.active
  order by cs.id
  limit 1;

  if found then
    select case
      when cpa.plan_type = 'annual'::public.subscription_plan_type_enum
        then 'annual'::public.subscription_plan_type_enum
      else 'monthly'::public.subscription_plan_type_enum
    end
    into plan_type_value
    from public.contribution_plan_assignments cpa
    where cpa.schedule_id = schedule_record.id
      and cpa.effective_period_start <= local_date_value
    order by cpa.effective_period_start desc, cpa.id desc
    limit 1;
  end if;

  if plan_type_value is null and application_found then
    select mar.plan_type
    into plan_type_value
    from public.membership_application_revisions mar
    where mar.application_id = application_record.id
    order by mar.revision_number desc, mar.id desc
    limit 1;
  end if;

  select pc.decision_reason
  into application_correction_reason
  from public.payment_claims pc
  join public.payment_obligations po on po.id = pc.obligation_id
  where pc.claimant_user_id = actor_id
    and pc.organization_id = p_organization_id
    and po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
    and pc.status = 'rejected'::public.payment_claim_status_enum
  order by pc.decided_at desc nulls last, pc.created_at desc, pc.id desc
  limit 1;

  if exists (
    select 1
    from public.payment_obligations po
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and po.purpose = 'recurring'::public.payment_obligation_purpose_enum
      and po.due_on < timezone(
        coalesce(po.billing_timezone, organization_record.billing_timezone),
        evaluated_at_value
      )::date
  ) then
    financial_state := 'overdue';
  elsif exists (
    select 1
    from public.payment_obligations po
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and (
        (
          po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
          and po.available_at <= evaluated_at_value
        )
        or (
          po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.available_on <= timezone(
            coalesce(po.billing_timezone, organization_record.billing_timezone),
            evaluated_at_value
          )::date
        )
      )
      and not exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      )
  ) then
    financial_state := 'payment_available';
  elsif exists (
    select 1
    from public.payment_obligations po
    join public.payment_claims pc on pc.obligation_id = po.id
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and pc.status = 'under_review'::public.payment_claim_status_enum
  ) then
    financial_state := 'under_review';
  end if;

  select jsonb_build_object(
    'obligation_id', po.id,
    'purpose', po.purpose,
    'status', state.effective_status,
    'period_key', po.period_key,
    'period_start', po.period_start,
    'period_end', po.period_end,
    'available_on', po.available_on,
    'due_on', po.due_on,
    'amount', po.amount,
    'currency', po.currency,
    'action', case state.effective_status
      when 'under_review' then jsonb_build_object('type', 'open_claim')
      when 'available' then jsonb_build_object('type', 'open_obligation')
      when 'overdue' then jsonb_build_object('type', 'open_obligation')
      else null
    end,
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object(
        'claim_id', pc.id,
        'status', pc.status,
        'payer', pc.payer_type,
        'payer_name', pc.payer_name,
        'created_at', pc.created_at,
        'decided_at', pc.decided_at,
        'decision_reason', pc.decision_reason
      ) order by pc.created_at asc, pc.id asc)
      from public.payment_claims pc
      where pc.obligation_id = po.id
    ), '[]'::jsonb)
  )
  into attention_obligation
  from public.payment_obligations po
  cross join lateral (
    select case
      when po.status = 'settled'::public.payment_obligation_status_enum then 'settled'
      when po.status = 'void'::public.payment_obligation_status_enum then 'void'
      when exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      ) then 'under_review'
      when po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
        and po.available_at <= evaluated_at_value then 'available'
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.due_on < timezone(
          coalesce(po.billing_timezone, organization_record.billing_timezone),
          evaluated_at_value
        )::date then 'overdue'
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.available_on <= timezone(
        coalesce(po.billing_timezone, organization_record.billing_timezone),
        evaluated_at_value
      )::date then 'available'
      else 'scheduled'
    end as effective_status
  ) state
  where po.organization_id = p_organization_id
    and po.user_id = actor_id
    and state.effective_status in ('available', 'under_review', 'overdue')
  order by
    case state.effective_status
      when 'overdue' then 0
      when 'available' then 1
      when 'under_review' then 2
      else 3
    end,
    po.due_on asc,
    po.created_at asc,
    po.id asc
  limit 1;

  if member_exists and schedule_record.id is not null then
    select jsonb_build_object(
      'obligation_id', po.id,
      'purpose', po.purpose,
      'status', state.effective_status,
      'period_key', po.period_key,
      'period_start', po.period_start,
      'period_end', po.period_end,
      'available_on', po.available_on,
      'due_on', po.due_on,
      'amount', po.amount,
      'currency', po.currency,
      'action', case state.effective_status
        when 'under_review' then jsonb_build_object('type', 'open_claim')
        when 'available' then jsonb_build_object('type', 'open_obligation')
        when 'overdue' then jsonb_build_object('type', 'open_obligation')
        else null
      end
    )
    into next_obligation
    from public.payment_obligations po
    cross join lateral (
      select case
        when exists (
          select 1
          from public.payment_claims pc
          where pc.obligation_id = po.id
            and pc.status = 'under_review'::public.payment_claim_status_enum
        ) then 'under_review'
        when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.available_on <= timezone(
          coalesce(po.billing_timezone, schedule_record.billing_timezone),
          evaluated_at_value
        )::date then 'available'
        else 'scheduled'
      end as effective_status
    ) state
    where po.schedule_id = schedule_record.id
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and po.due_on > timezone(
        coalesce(po.billing_timezone, schedule_record.billing_timezone),
        evaluated_at_value
      )::date
    order by po.due_on asc, po.created_at asc, po.id asc
    limit 1;

    if next_obligation is null then
      for next_assignment in
        select
          cpa.*,
          lead(cpa.effective_period_start) over (
            order by cpa.effective_period_start, cpa.id
          ) as next_effective_period_start
        from public.contribution_plan_assignments cpa
        where cpa.schedule_id = schedule_record.id
        order by cpa.effective_period_start, cpa.id
      loop
        candidate_plan_type := next_assignment.plan_type;
        candidate_effective_start := greatest(
          schedule_record.admission_date,
          next_assignment.effective_period_start
        );
        candidate_due_date := public.recurring_due_date_on_or_after(
          schedule_record.admission_date,
          case candidate_plan_type
            when 'annual'::public.subscription_plan_type_enum
              then 'annual'::public.contribution_cadence_enum
            else 'monthly'::public.contribution_cadence_enum
          end,
          coalesce(next_assignment.due_day, schedule_record.due_day),
          greatest(
            candidate_effective_start,
            timezone(
              coalesce(next_assignment.billing_timezone, schedule_record.billing_timezone),
              evaluated_at_value
            )::date + 1
          )
        );

        if next_assignment.next_effective_period_start is not null
          and candidate_due_date >= next_assignment.next_effective_period_start then
          continue;
        end if;

        if not candidate_found or candidate_due_date < selected_candidate_due_date then
          candidate_found := true;
          selected_candidate_due_date := candidate_due_date;
          candidate_next_due_date := public.next_recurring_due_date(
            candidate_due_date,
            case candidate_plan_type
              when 'annual'::public.subscription_plan_type_enum
                then 'annual'::public.contribution_cadence_enum
              else 'monthly'::public.contribution_cadence_enum
            end,
            coalesce(next_assignment.due_day, schedule_record.due_day)
          );
          candidate_available_on := candidate_due_date
            - coalesce(next_assignment.lead_days, schedule_record.lead_days);
          candidate_period_start := candidate_due_date;
          candidate_period_end := candidate_next_due_date - 1;
          candidate_amount := next_assignment.amount;
          candidate_currency := next_assignment.currency;
          next_obligation := jsonb_build_object(
            'obligation_id', null,
            'purpose', 'recurring',
            'status', 'scheduled',
            'period_key', public.recurring_period_key(
              case candidate_plan_type
                when 'annual'::public.subscription_plan_type_enum
                  then 'annual'::public.contribution_cadence_enum
                else 'monthly'::public.contribution_cadence_enum
              end,
              candidate_due_date
            ),
            'period_start', candidate_period_start,
            'period_end', candidate_period_end,
            'available_on', candidate_available_on,
            'due_on', candidate_due_date,
            'amount', candidate_amount,
            'currency', candidate_currency,
            'action', null
          );
        end if;
      end loop;
    end if;
  end if;

  select coalesce(jsonb_agg(row_data order by due_on desc, obligation_id desc), '[]'::jsonb),
    count(*)::integer
  into history, history_count
  from (
    select
      jsonb_build_object(
        'obligation_id', po.id,
        'purpose', po.purpose,
        'status', state.effective_status,
        'period_key', po.period_key,
        'period_start', po.period_start,
        'period_end', po.period_end,
        'available_on', po.available_on,
        'due_on', po.due_on,
        'amount', po.amount,
        'currency', po.currency,
        'settled_at', po.settled_at,
        'claims', coalesce((
          select jsonb_agg(jsonb_build_object(
            'claim_id', pc.id,
            'status', pc.status,
            'payer', pc.payer_type,
            'payer_name', pc.payer_name,
            'created_at', pc.created_at,
            'decided_at', pc.decided_at,
            'decision_reason', pc.decision_reason
          ) order by pc.created_at asc, pc.id asc)
          from public.payment_claims pc
          where pc.obligation_id = po.id
        ), '[]'::jsonb)
      ) as row_data,
      po.due_on,
      po.created_at,
      po.id as obligation_id
    from public.payment_obligations po
    cross join lateral (
      select case
        when po.status = 'settled'::public.payment_obligation_status_enum then 'settled'
        when po.status = 'void'::public.payment_obligation_status_enum then 'void'
        when exists (
          select 1
          from public.payment_claims pc
          where pc.obligation_id = po.id
            and pc.status = 'under_review'::public.payment_claim_status_enum
        ) then 'under_review'
        when po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
          and po.available_at <= evaluated_at_value then 'available'
        when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.due_on < timezone(
            coalesce(po.billing_timezone, organization_record.billing_timezone),
            evaluated_at_value
          )::date then 'overdue'
        when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.available_on <= timezone(
          coalesce(po.billing_timezone, organization_record.billing_timezone),
          evaluated_at_value
        )::date then 'available'
        else 'scheduled'
      end as effective_status
    ) state
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and (
        cursor_due_on is null
        or (po.due_on, po.id) < (cursor_due_on, cursor_obligation_id)
      )
    order by po.due_on desc, po.id desc
    limit history_limit_value + 1
  ) history_rows;

  if history_count > history_limit_value then
    history_has_more := true;
    select jsonb_agg(value order by ordinal)
    into history
    from jsonb_array_elements(history) with ordinality as items(value, ordinal)
    where ordinal <= history_limit_value;

    select to_char(po.due_on, 'YYYY-MM-DD') || '|' || po.id::text
    into history_next_cursor
    from public.payment_obligations po
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and (
        cursor_due_on is null
        or (po.due_on, po.id) < (cursor_due_on, cursor_obligation_id)
      )
    order by po.due_on desc, po.id desc
    offset history_limit_value
    limit 1;
  end if;

  return jsonb_build_object(
    'organization_id', organization_record.id,
    'organization_slug', organization_record.slug,
    'organization_name', organization_record.name,
    'legal_membership_state', legal_state,
    'application_status', case when application_found then application_record.status else null end,
    'application_correction_reason', application_correction_reason,
    'financial_standing', financial_state,
    'evaluated_at', evaluated_at_value,
    'plan_type', plan_type_value,
    'attention_obligation', attention_obligation,
    'next_contribution', next_obligation,
    'history', coalesce(history, '[]'::jsonb),
    'history_limit', history_limit_value,
    'history_has_more', history_has_more,
    'history_next_cursor', history_next_cursor
  );
end;
$function$;
COMMENT ON FUNCTION public.get_membership_billing_ledger(uuid,text,integer) IS 'Returns the signed-in person''s private Ledger using effective-dated terms and obligation timezone snapshots.';
REVOKE ALL ON FUNCTION public.get_membership_billing_ledger(uuid, text, integer) FROM anon;
CREATE FUNCTION public.get_payment_obligation_instructions(p_obligation_id uuid)
 RETURNS TABLE(obligation_id uuid, organization_id uuid, purpose public.payment_obligation_purpose_enum, status text, plan_type public.subscription_plan_type_enum, amount integer, currency text, payment_method text, pix_copy_paste text, available_at timestamp with time zone, available_on date, due_on date, period_key text, claim_id uuid, claim_status public.payment_claim_status_enum, payer_type public.payment_claim_payer_type_enum, payer_name text, claim_created_at timestamp with time zone, claim_decision_reason text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    po.id,
    po.organization_id,
    po.purpose,
    case
      when po.status = 'settled'::public.payment_obligation_status_enum then 'settled'
      when po.status = 'void'::public.payment_obligation_status_enum then 'void'
      when claim.status = 'under_review'::public.payment_claim_status_enum then 'under_review'
      when po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
        and po.available_at <= clock_timestamp() then 'available'
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.due_on < timezone(
          coalesce(po.billing_timezone, o.billing_timezone),
          clock_timestamp()
        )::date then 'overdue'
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.available_on <= timezone(
        coalesce(po.billing_timezone, o.billing_timezone),
        clock_timestamp()
      )::date then 'available'
      else 'scheduled'
    end,
    po.plan_type,
    po.amount,
    po.currency,
    po.payment_method,
    po.pix_copy_paste,
    po.available_at,
    po.available_on,
    po.due_on,
    po.period_key,
    claim.id,
    claim.status,
    claim.payer_type,
    claim.payer_name,
    claim.created_at,
    claim.decision_reason
  from public.payment_obligations po
  join public.organizations o on o.id = po.organization_id
  left join lateral (
    select
      pc.id,
      pc.status,
      pc.payer_type,
      pc.payer_name,
      pc.created_at,
      pc.decision_reason
    from public.payment_claims pc
    where pc.obligation_id = po.id
      and pc.claimant_user_id = (select auth.uid())
    order by pc.created_at desc, pc.id desc
    limit 1
  ) claim on true
  where po.id = p_obligation_id
    and po.user_id = (select auth.uid());
$function$;
COMMENT ON FUNCTION public.get_payment_obligation_instructions(uuid) IS 'Returns authoritative PIX instructions and evaluates availability using the obligation timezone snapshot.';
REVOKE ALL ON FUNCTION public.get_payment_obligation_instructions(uuid) FROM anon;
CREATE FUNCTION public.is_valid_billing_timezone(p_timezone text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = p_timezone
  );
$function$;
REVOKE ALL ON FUNCTION public.is_valid_billing_timezone(text) FROM anon;
REVOKE ALL ON FUNCTION public.is_valid_billing_timezone(text) FROM authenticated;
CREATE FUNCTION public.next_recurring_due_date(p_due_date date, p_cadence public.contribution_cadence_enum, p_due_day integer)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_cadence = 'annual'::public.contribution_cadence_enum then
      public.clamped_billing_date(
        extract(year from p_due_date)::integer + 1,
        extract(month from p_due_date)::integer,
        p_due_day
      )
    else public.clamped_billing_date(
      extract(year from (p_due_date + interval '1 month'))::integer,
      extract(month from (p_due_date + interval '1 month'))::integer,
      p_due_day
    )
  end;
$function$;
REVOKE ALL ON FUNCTION public.next_recurring_due_date(date, public.contribution_cadence_enum, integer) FROM anon;
REVOKE ALL ON FUNCTION public.next_recurring_due_date(date, public.contribution_cadence_enum, integer) FROM authenticated;
CREATE FUNCTION public.prepare_contribution_reminder_batch(p_batch_id uuid, p_lease_token uuid, p_lease_seconds integer DEFAULT 120)
 RETURNS TABLE(batch_id uuid, organization_slug text, delivery_window_on date, delivery_attempts jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  batch_record public.contribution_reminder_batches%rowtype;
  lease_interval interval := make_interval(
    secs => greatest(30, least(coalesce(p_lease_seconds, 120), 900))
  );
  token_count integer;
  active_event_count integer;
  attempt_count_value integer;
  slug_value text;
begin
  select b.*
  into batch_record
  from public.contribution_reminder_batches b
  where b.id = p_batch_id
    and b.status = 'leased'::public.contribution_reminder_batch_status_enum
    and b.lease_token = p_lease_token
    and b.lease_expires_at > clock_timestamp()
  for update;

  if not found then
    return;
  end if;

  update public.contribution_reminder_events event_record
  set
    status = 'suppressed'::public.contribution_reminder_event_status_enum,
    suppression_reason = case
      when po.status = 'settled'::public.payment_obligation_status_enum
        then 'obligation_settled'
      when po.status = 'void'::public.payment_obligation_status_enum
        then 'obligation_void'
      when exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      ) then 'claim_under_review'
      else 'membership_not_active'
    end,
    updated_at = clock_timestamp()
  from public.contribution_reminder_batch_events batch_event
  join public.contribution_reminder_events batch_event_record
    on batch_event_record.id = batch_event.event_id
  join public.payment_obligations po on po.id = batch_event_record.obligation_id
  where batch_event.batch_id = p_batch_id
    and event_record.id = batch_event.event_id
    and event_record.status = 'pending'::public.contribution_reminder_event_status_enum
    and (
      po.status in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      or exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      )
      or not exists (
        select 1
        from public.organization_members om
        join public.subscriptions s
          on s.organization_id = om.organization_id
          and s.user_id = om.user_id
          and s.status = 'active'::public.subscription_status_enum
        where om.organization_id = po.organization_id
          and om.user_id = po.user_id
          and om.role in (
            'admin'::public.organization_role_enum,
            'member'::public.organization_role_enum
          )
      )
    );

  select count(*)
  into active_event_count
  from public.contribution_reminder_batch_events batch_event
  join public.contribution_reminder_events event_record
    on event_record.id = batch_event.event_id
  where batch_event.batch_id = p_batch_id
    and event_record.status = 'pending'::public.contribution_reminder_event_status_enum;

  if active_event_count = 0 then
    update public.contribution_reminder_batches
    set
      status = 'suppressed'::public.contribution_reminder_batch_status_enum,
      lease_token = null,
      lease_expires_at = null,
      updated_at = clock_timestamp()
    where id = p_batch_id;
    return;
  end if;

  select o.slug
  into slug_value
  from public.organizations o
  where o.id = batch_record.organization_id
    and o.organization_type = 'association'::public.organization_type_enum;

  if slug_value is null then
    update public.contribution_reminder_batches
    set
      status = 'suppressed'::public.contribution_reminder_batch_status_enum,
      last_failure_code = 'organization_unavailable',
      lease_token = null,
      lease_expires_at = null,
      updated_at = clock_timestamp()
    where id = p_batch_id;
    return;
  end if;

  update public.contribution_reminder_delivery_attempts da
  set
    status = 'terminal'::public.contribution_reminder_attempt_status_enum,
    terminal_outcome = 'token_no_longer_owned',
    lease_token = null,
    lease_expires_at = null,
    updated_at = clock_timestamp()
  where da.batch_id = p_batch_id
    and da.status in (
      'pending'::public.contribution_reminder_attempt_status_enum,
      'retryable'::public.contribution_reminder_attempt_status_enum,
      'leased'::public.contribution_reminder_attempt_status_enum
    )
    and not exists (
      select 1
      from public.push_tokens pt
      where pt.token = da.token
        and pt.profile_id = batch_record.recipient_user_id
    );

  insert into public.contribution_reminder_delivery_attempts (
    batch_id,
    push_token_id,
    token,
    language,
    status,
    next_attempt_at
  )
  select
    p_batch_id,
    pt.id,
    pt.token,
    pt.language,
    'pending'::public.contribution_reminder_attempt_status_enum,
    clock_timestamp()
  from public.push_tokens pt
  where pt.profile_id = batch_record.recipient_user_id
  on conflict on constraint contribution_reminder_delivery_attempts_batch_id_token_key
  do update
  set
    push_token_id = excluded.push_token_id,
    language = excluded.language,
    updated_at = clock_timestamp();

  select count(*)
  into token_count
  from public.push_tokens pt
  where pt.profile_id = batch_record.recipient_user_id;

  if token_count = 0 then
    update public.contribution_reminder_batches
    set
      status = 'no_device'::public.contribution_reminder_batch_status_enum,
      lease_token = null,
      lease_expires_at = null,
      updated_at = clock_timestamp()
    where id = p_batch_id;

    update public.contribution_reminder_events event_record
    set
      status = 'no_device'::public.contribution_reminder_event_status_enum,
      suppression_reason = 'no_current_device',
      updated_at = clock_timestamp()
    where event_record.id in (
      select event_id
      from public.contribution_reminder_batch_events batch_event
      where batch_event.batch_id = p_batch_id
    )
      and event_record.status = 'pending'::public.contribution_reminder_event_status_enum;
    return;
  end if;

  with candidates as (
    select da.id
    from public.contribution_reminder_delivery_attempts da
    where da.batch_id = p_batch_id
      and da.status in (
        'pending'::public.contribution_reminder_attempt_status_enum,
        'retryable'::public.contribution_reminder_attempt_status_enum,
        'leased'::public.contribution_reminder_attempt_status_enum
      )
      and (
        da.status in (
          'pending'::public.contribution_reminder_attempt_status_enum,
          'retryable'::public.contribution_reminder_attempt_status_enum
        )
        and da.next_attempt_at <= clock_timestamp()
        or da.status = 'leased'::public.contribution_reminder_attempt_status_enum
          and da.lease_expires_at < clock_timestamp()
      )
      and exists (
        select 1
        from public.push_tokens pt
        where pt.token = da.token
          and pt.profile_id = batch_record.recipient_user_id
      )
    order by da.id
    for update skip locked
  )
  update public.contribution_reminder_delivery_attempts da
  set
    status = 'leased'::public.contribution_reminder_attempt_status_enum,
    lease_token = p_lease_token,
    lease_expires_at = clock_timestamp() + lease_interval,
    attempt_count = da.attempt_count + 1,
    updated_at = clock_timestamp()
  where da.id in (select id from candidates);

  select count(*)
  into attempt_count_value
  from public.contribution_reminder_delivery_attempts da
  where da.batch_id = p_batch_id
    and da.status = 'leased'::public.contribution_reminder_attempt_status_enum
    and da.lease_token = p_lease_token;

  if attempt_count_value = 0 then
    perform public.refresh_contribution_reminder_batch(p_batch_id);
    return;
  end if;

  batch_id := p_batch_id;
  organization_slug := slug_value;
  delivery_window_on := batch_record.delivery_window_on;
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'attempt_id', da.id,
        'token', da.token,
        'language', da.language
      )
      order by da.id
    ),
    '[]'::jsonb
  )
  into delivery_attempts
  from public.contribution_reminder_delivery_attempts da
  where da.batch_id = p_batch_id
    and da.status = 'leased'::public.contribution_reminder_attempt_status_enum
    and da.lease_token = p_lease_token;
  return next;
end;
$function$;
REVOKE ALL ON FUNCTION public.prepare_contribution_reminder_batch(uuid, uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.prepare_contribution_reminder_batch(uuid, uuid, integer) FROM authenticated;
CREATE FUNCTION public.reconcile_legacy_payment_obligations(p_apply boolean DEFAULT false)
 RETURNS TABLE(payment_id uuid, obligation_id uuid, payment_status public.payment_status_enum, result text, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  payment_record record;
  candidate_obligation_id uuid;
  candidate_count integer;
  matched_obligation public.payment_obligations%rowtype;
begin
  for payment_record in
    select p.*
    from public.payments p
    where p.status in (
      'pending'::public.payment_status_enum,
      'succeeded'::public.payment_status_enum
    )
      and p.payment_provider is null
      and p.provider_payment_id is null
      and not exists (
        select 1
        from public.payment_obligations linked
        where linked.legacy_payment_id = p.id
      )
    order by coalesce(p.paid_at, p.created_at), p.id
  loop
    select count(*)::integer, min(candidates.id::text)::uuid
    into candidate_count, candidate_obligation_id
    from public.payment_obligations candidates
    where candidates.purpose = 'recurring'::public.payment_obligation_purpose_enum
      and candidates.legacy_payment_id is null
      and candidates.organization_id = payment_record.organization_id
      and candidates.user_id = payment_record.user_id
      and candidates.amount = payment_record.amount
      and timezone(
        coalesce(
          candidates.billing_timezone,
          (select o.billing_timezone
           from public.organizations o
           where o.id = candidates.organization_id)
        ),
        coalesce(payment_record.paid_at, payment_record.created_at)
      )::date between candidates.period_start and candidates.period_end;

    payment_id := payment_record.id;
    obligation_id := candidate_obligation_id;
    payment_status := payment_record.status;

    if candidate_count = 0 then
      result := 'unmatched';
      reason := 'No stable recurring period matches this legacy payment.';
      return next;
      continue;
    end if;

    if candidate_count > 1 then
      obligation_id := null;
      result := 'ambiguous';
      reason := 'More than one recurring period matches this legacy payment.';
      return next;
      continue;
    end if;

    select po.*
    into matched_obligation
    from public.payment_obligations po
    where po.id = candidate_obligation_id
    for update;

    if exists (
      select 1
      from public.payment_claims pc
      where pc.obligation_id = matched_obligation.id
        and pc.status = 'under_review'::public.payment_claim_status_enum
    ) then
      result := 'blocked_under_review';
      reason := 'The period has an active payment claim under review.';
      return next;
      continue;
    end if;

    if not p_apply then
      result := 'ready';
      reason := 'One stable period matches; apply only after dry-run review.';
      return next;
      continue;
    end if;

    update public.payment_obligations po
    set
      legacy_payment_id = payment_record.id,
      status = case
        when payment_record.status = 'succeeded'::public.payment_status_enum
          then 'settled'::public.payment_obligation_status_enum
        else po.status
      end,
      settled_at = case
        when payment_record.status = 'succeeded'::public.payment_status_enum
          then coalesce(payment_record.paid_at, payment_record.created_at)
        else po.settled_at
      end
    where po.id = matched_obligation.id
      and po.legacy_payment_id is null;

    if found then
      result := 'linked';
      reason := 'One stable period was linked to the legacy payment.';
    else
      result := 'already_linked';
      reason := 'The stable period was linked by an earlier reconciliation row.';
    end if;
    return next;
  end loop;
end;
$function$;
COMMENT ON FUNCTION public.reconcile_legacy_payment_obligations(boolean) IS 'Returns a dry-run legacy payment mapping by default; only unambiguous reviewed mappings may be applied.';
REVOKE ALL ON FUNCTION public.reconcile_legacy_payment_obligations(boolean) FROM anon;
REVOKE ALL ON FUNCTION public.reconcile_legacy_payment_obligations(boolean) FROM authenticated;
CREATE FUNCTION public.record_contribution_reminder_receipts(p_receipts jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  receipt_record record;
  updated_count integer := 0;
  changed_count integer;
  normalized_error text;
  batch_id_value uuid;
begin
  for receipt_record in
    select *
    from jsonb_to_recordset(coalesce(p_receipts, '[]'::jsonb)) as receipt(
      attempt_id uuid,
      lease_token uuid,
      status text,
      error_code text
    )
  loop
    normalized_error := lower(
      replace(coalesce(receipt_record.error_code, ''), '_', '')
    );

    select da.batch_id
    into batch_id_value
    from public.contribution_reminder_delivery_attempts da
    where da.id = receipt_record.attempt_id
      and da.status = 'leased'::public.contribution_reminder_attempt_status_enum
      and da.lease_token = receipt_record.lease_token;

    if batch_id_value is null then
      continue;
    end if;

    if receipt_record.status = 'ok' then
      update public.contribution_reminder_delivery_attempts da
      set
        status = 'delivered'::public.contribution_reminder_attempt_status_enum,
        expo_receipt_status = 'ok',
        expo_receipt_error_code = null,
        terminal_outcome = null,
        lease_token = null,
        lease_expires_at = null,
        next_receipt_check_at = null,
        updated_at = clock_timestamp()
      where da.id = receipt_record.attempt_id
        and da.status = 'leased'::public.contribution_reminder_attempt_status_enum
        and da.lease_token = receipt_record.lease_token;
      get diagnostics changed_count = row_count;
      updated_count := updated_count + changed_count;
    else
      update public.contribution_reminder_delivery_attempts da
      set
        status = case
          when normalized_error in (
            'toomanyrequests',
            'ratelimited',
            'messagerateexceeded',
            'serviceunavailable',
            'internalservererror',
            'timeout',
            'network'
          ) and da.attempt_count < 5
            then 'retryable'::public.contribution_reminder_attempt_status_enum
          else 'terminal'::public.contribution_reminder_attempt_status_enum
        end,
        expo_receipt_status = 'error',
        expo_receipt_error_code = nullif(receipt_record.error_code, ''),
        terminal_outcome = case
          when normalized_error = 'devicenotregistered'
            then 'device_not_registered'
          when normalized_error in (
            'toomanyrequests',
            'ratelimited',
            'messagerateexceeded',
            'serviceunavailable',
            'internalservererror',
            'timeout',
            'network'
          ) and da.attempt_count < 5 then null
          when da.attempt_count >= 5 then 'retry_exhausted'
          else 'expo_receipt_error'
        end,
        next_attempt_at = case
          when normalized_error in (
            'toomanyrequests',
            'ratelimited',
            'messagerateexceeded',
            'serviceunavailable',
            'internalservererror',
            'timeout',
            'network'
          ) and da.attempt_count < 5
            then clock_timestamp() + public.contribution_reminder_backoff(da.attempt_count)
          else da.next_attempt_at
        end,
        lease_token = null,
        lease_expires_at = null,
        next_receipt_check_at = null,
        updated_at = clock_timestamp()
      where da.id = receipt_record.attempt_id
        and da.status = 'leased'::public.contribution_reminder_attempt_status_enum
        and da.lease_token = receipt_record.lease_token;
      get diagnostics changed_count = row_count;
      updated_count := updated_count + changed_count;

      if normalized_error = 'devicenotregistered'
        or normalized_error = 'invalidpushtoken'
        or normalized_error = 'invalidtoken' then
        delete from public.push_tokens pt
        where exists (
          select 1
          from public.contribution_reminder_delivery_attempts da
          where da.id = receipt_record.attempt_id
            and da.token = pt.token
        );
      end if;
    end if;

    perform public.refresh_contribution_reminder_batch(batch_id_value);
  end loop;

  return updated_count;
end;
$function$;
REVOKE ALL ON FUNCTION public.record_contribution_reminder_receipts(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.record_contribution_reminder_receipts(jsonb) FROM authenticated;
CREATE FUNCTION public.record_contribution_reminder_send_failure(p_batch_id uuid, p_lease_token uuid, p_failure_code text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  updated_count integer;
begin
  update public.contribution_reminder_delivery_attempts da
  set
    status = case
      when da.attempt_count < 5
        then 'retryable'::public.contribution_reminder_attempt_status_enum
      else 'terminal'::public.contribution_reminder_attempt_status_enum
    end,
    expo_receipt_status = 'send_error',
    expo_receipt_error_code = case
      when p_failure_code in ('network', 'rate_limit', 'server')
        then p_failure_code
      else 'unknown'
    end,
    terminal_outcome = case
      when da.attempt_count >= 5 then 'retry_exhausted'
      else null
    end,
    next_attempt_at = case
      when da.attempt_count < 5
        then clock_timestamp() + public.contribution_reminder_backoff(da.attempt_count)
      else da.next_attempt_at
    end,
    lease_token = null,
    lease_expires_at = null,
    updated_at = clock_timestamp()
  where da.batch_id = p_batch_id
    and da.status = 'leased'::public.contribution_reminder_attempt_status_enum
    and da.lease_token = p_lease_token;
  get diagnostics updated_count = row_count;

  update public.contribution_reminder_batches
  set
    status = 'retryable'::public.contribution_reminder_batch_status_enum,
    last_failure_code = case
      when p_failure_code in ('network', 'rate_limit', 'server') then p_failure_code
      else 'unknown'
    end,
    lease_token = null,
    lease_expires_at = null,
    updated_at = clock_timestamp()
  where id = p_batch_id
    and status = 'leased'::public.contribution_reminder_batch_status_enum
    and lease_token = p_lease_token;

  perform public.refresh_contribution_reminder_batch(p_batch_id);
  return updated_count;
end;
$function$;
REVOKE ALL ON FUNCTION public.record_contribution_reminder_send_failure(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.record_contribution_reminder_send_failure(uuid, uuid, text) FROM authenticated;
CREATE FUNCTION public.record_contribution_reminder_tickets(p_batch_id uuid, p_lease_token uuid, p_tickets jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  ticket_record record;
  updated_count integer := 0;
  changed_count integer;
  normalized_error text;
begin
  for ticket_record in
    select *
    from jsonb_to_recordset(coalesce(p_tickets, '[]'::jsonb)) as ticket(
      attempt_id uuid,
      status text,
      expo_ticket_id text,
      error_code text
    )
  loop
    normalized_error := lower(
      replace(coalesce(ticket_record.error_code, ''), '_', '')
    );

    if ticket_record.status = 'ok'
      and nullif(ticket_record.expo_ticket_id, '') is not null then
      update public.contribution_reminder_delivery_attempts da
      set
        status = 'ticketed'::public.contribution_reminder_attempt_status_enum,
        expo_ticket_id = ticket_record.expo_ticket_id,
        expo_receipt_status = null,
        expo_receipt_error_code = null,
        terminal_outcome = null,
        lease_token = null,
        lease_expires_at = null,
        next_receipt_check_at = clock_timestamp() + interval '1 minute',
        updated_at = clock_timestamp()
      where da.id = ticket_record.attempt_id
        and da.batch_id = p_batch_id
        and da.status = 'leased'::public.contribution_reminder_attempt_status_enum
        and da.lease_token = p_lease_token;
      get diagnostics changed_count = row_count;
      updated_count := updated_count + changed_count;
    else
      update public.contribution_reminder_delivery_attempts da
      set
        status = case
          when normalized_error in (
            'toomanyrequests',
            'ratelimited',
            'messagerateexceeded',
            'serviceunavailable',
            'internalservererror',
            'timeout',
            'network'
          ) and da.attempt_count < 5
            then 'retryable'::public.contribution_reminder_attempt_status_enum
          else 'terminal'::public.contribution_reminder_attempt_status_enum
        end,
        expo_receipt_status = 'error',
        expo_receipt_error_code = nullif(ticket_record.error_code, ''),
        terminal_outcome = case
          when normalized_error = 'devicenotregistered'
            then 'device_not_registered'
          when normalized_error in (
            'toomanyrequests',
            'ratelimited',
            'messagerateexceeded',
            'serviceunavailable',
            'internalservererror',
            'timeout',
            'network'
          ) and da.attempt_count < 5 then null
          when da.attempt_count >= 5 then 'retry_exhausted'
          else 'expo_ticket_error'
        end,
        next_attempt_at = case
          when normalized_error in (
            'toomanyrequests',
            'ratelimited',
            'messagerateexceeded',
            'serviceunavailable',
            'internalservererror',
            'timeout',
            'network'
          ) and da.attempt_count < 5
            then clock_timestamp() + public.contribution_reminder_backoff(da.attempt_count)
          else da.next_attempt_at
        end,
        lease_token = null,
        lease_expires_at = null,
        updated_at = clock_timestamp()
      where da.id = ticket_record.attempt_id
        and da.batch_id = p_batch_id
        and da.status = 'leased'::public.contribution_reminder_attempt_status_enum
        and da.lease_token = p_lease_token;
      get diagnostics changed_count = row_count;
      updated_count := updated_count + changed_count;

      if normalized_error = 'devicenotregistered'
        or normalized_error = 'invalidpushtoken'
        or normalized_error = 'invalidtoken' then
        delete from public.push_tokens pt
        where exists (
          select 1
          from public.contribution_reminder_delivery_attempts da
          where da.id = ticket_record.attempt_id
            and da.batch_id = p_batch_id
            and da.token = pt.token
        );
      end if;
    end if;
  end loop;

  update public.contribution_reminder_batches
  set
    status = 'awaiting_receipts'::public.contribution_reminder_batch_status_enum,
    lease_token = null,
    lease_expires_at = null,
    updated_at = clock_timestamp()
  where id = p_batch_id
    and status = 'leased'::public.contribution_reminder_batch_status_enum
    and lease_token = p_lease_token;

  perform public.refresh_contribution_reminder_batch(p_batch_id);
  return updated_count;
end;
$function$;
REVOKE ALL ON FUNCTION public.record_contribution_reminder_tickets(uuid, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.record_contribution_reminder_tickets(uuid, uuid, jsonb) FROM authenticated;
CREATE FUNCTION public.recurring_due_date_on_or_after(p_admission_date date, p_cadence public.contribution_cadence_enum, p_due_day integer, p_from_date date)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  due_date_value date;
  lower_bound date;
begin
  if p_admission_date is null
    or p_cadence is null
    or p_due_day is null
    or p_from_date is null then
    raise exception 'Recurring date inputs are required.' using errcode = '22023';
  end if;

  if p_due_day < 1 or p_due_day > 31 then
    raise exception 'Recurring due day must be between 1 and 31.'
      using errcode = '22023';
  end if;

  lower_bound := greatest(p_admission_date, p_from_date);
  due_date_value := public.first_recurring_due_date(
    p_admission_date,
    p_cadence,
    p_due_day
  );

  while due_date_value < lower_bound loop
    due_date_value := public.next_recurring_due_date(
      due_date_value,
      p_cadence,
      p_due_day
    );
  end loop;

  return due_date_value;
end;
$function$;
REVOKE ALL ON FUNCTION public.recurring_due_date_on_or_after(date, public.contribution_cadence_enum, integer, date) FROM anon;
REVOKE ALL ON FUNCTION public.recurring_due_date_on_or_after(date, public.contribution_cadence_enum, integer, date) FROM authenticated;
CREATE FUNCTION public.recurring_period_key(p_cadence public.contribution_cadence_enum, p_due_date date)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select p_cadence::text || ':' || to_char(p_due_date, 'YYYY-MM-DD');
$function$;
REVOKE ALL ON FUNCTION public.recurring_period_key(public.contribution_cadence_enum, date) FROM anon;
REVOKE ALL ON FUNCTION public.recurring_period_key(public.contribution_cadence_enum, date) FROM authenticated;
CREATE FUNCTION public.refresh_contribution_reminder_batch(p_batch_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  has_pending boolean;
  has_waiting boolean;
  has_delivered boolean;
  has_attempts boolean;
  next_retry timestamp with time zone;
begin
  select
    exists (
      select 1
      from public.contribution_reminder_delivery_attempts da
      where da.batch_id = p_batch_id
        and da.status in (
          'pending'::public.contribution_reminder_attempt_status_enum,
          'retryable'::public.contribution_reminder_attempt_status_enum
        )
    ),
    exists (
      select 1
      from public.contribution_reminder_delivery_attempts da
      where da.batch_id = p_batch_id
        and da.status in (
          'leased'::public.contribution_reminder_attempt_status_enum,
          'ticketed'::public.contribution_reminder_attempt_status_enum
        )
    ),
    exists (
      select 1
      from public.contribution_reminder_delivery_attempts da
      where da.batch_id = p_batch_id
        and da.status = 'delivered'::public.contribution_reminder_attempt_status_enum
    ),
    exists (
      select 1
      from public.contribution_reminder_delivery_attempts da
      where da.batch_id = p_batch_id
    )
  into has_pending, has_waiting, has_delivered, has_attempts;

  if has_pending and has_waiting then
    update public.contribution_reminder_batches
    set
      status = 'awaiting_receipts'::public.contribution_reminder_batch_status_enum,
      next_attempt_at = coalesce(
        (
          select min(da.next_attempt_at)
          from public.contribution_reminder_delivery_attempts da
          where da.batch_id = p_batch_id
            and da.status = 'retryable'::public.contribution_reminder_attempt_status_enum
        ),
        clock_timestamp()
      ),
      updated_at = clock_timestamp()
    where id = p_batch_id;
    return;
  end if;

  if has_waiting then
    update public.contribution_reminder_batches
    set
      status = 'awaiting_receipts'::public.contribution_reminder_batch_status_enum,
      updated_at = clock_timestamp()
    where id = p_batch_id;
    return;
  end if;

  if has_pending then
    select min(da.next_attempt_at)
    into next_retry
    from public.contribution_reminder_delivery_attempts da
    where da.batch_id = p_batch_id
      and da.status in (
        'pending'::public.contribution_reminder_attempt_status_enum,
        'retryable'::public.contribution_reminder_attempt_status_enum
      );

    update public.contribution_reminder_batches
    set
      status = 'retryable'::public.contribution_reminder_batch_status_enum,
      next_attempt_at = coalesce(next_retry, clock_timestamp()),
      updated_at = clock_timestamp()
    where id = p_batch_id;
    return;
  end if;

  if has_delivered then
    update public.contribution_reminder_batches
    set
      status = 'delivered'::public.contribution_reminder_batch_status_enum,
      delivered_at = coalesce(delivered_at, clock_timestamp()),
      updated_at = clock_timestamp()
    where id = p_batch_id;

    update public.contribution_reminder_events event_record
    set
      status = 'delivered'::public.contribution_reminder_event_status_enum,
      delivered_at = coalesce(delivered_at, clock_timestamp()),
      updated_at = clock_timestamp()
    where event_record.id in (
      select event_id
      from public.contribution_reminder_batch_events batch_event
      where batch_event.batch_id = p_batch_id
    )
      and event_record.status = 'pending'::public.contribution_reminder_event_status_enum;
    return;
  end if;

  if has_attempts then
    update public.contribution_reminder_batches
    set
      status = 'terminal'::public.contribution_reminder_batch_status_enum,
      updated_at = clock_timestamp()
    where id = p_batch_id;

    update public.contribution_reminder_events event_record
    set
      status = 'exhausted'::public.contribution_reminder_event_status_enum,
      suppression_reason = 'delivery_exhausted',
      updated_at = clock_timestamp()
    where event_record.id in (
      select event_id
      from public.contribution_reminder_batch_events batch_event
      where batch_event.batch_id = p_batch_id
    )
      and event_record.status = 'pending'::public.contribution_reminder_event_status_enum;
  end if;
end;
$function$;
REVOKE ALL ON FUNCTION public.refresh_contribution_reminder_batch(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.refresh_contribution_reminder_batch(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.refresh_contribution_reminder_batch(uuid) FROM service_role;
CREATE FUNCTION public.register_push_token(p_token text, p_language public.language DEFAULT NULL::public.language)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  normalized_token text := nullif(btrim(p_token), '');
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if normalized_token is null or char_length(normalized_token) > 512 then
    raise exception 'A valid push token is required.' using errcode = '22023';
  end if;

  insert into public.push_tokens (token, profile_id, language, created_at)
  values (normalized_token, actor_id, p_language, clock_timestamp())
  on conflict (token) do update
  set
    profile_id = excluded.profile_id,
    language = excluded.language,
    created_at = clock_timestamp();

  return 'registered';
end;
$function$;
COMMENT ON FUNCTION public.register_push_token(text,public.language) IS 'Associates one device token with the currently authenticated profile, replacing a previous owner for account switching.';
REVOKE ALL ON FUNCTION public.register_push_token(text, public.language) FROM anon;
CREATE FUNCTION public.reject_contribution_plan_assignment_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.schedule_id is distinct from new.schedule_id
    or old.effective_period_start is distinct from new.effective_period_start
    or old.plan_type is distinct from new.plan_type
    or old.amount is distinct from new.amount
    or old.currency is distinct from new.currency
    or old.due_day is distinct from new.due_day
    or old.lead_days is distinct from new.lead_days
    or old.billing_timezone is distinct from new.billing_timezone
    or old.pix_copy_paste is distinct from new.pix_copy_paste then
    raise exception 'An effective-dated contribution term is immutable; append a new term.'
      using errcode = '55000';
  end if;

  return new;
end;
$function$;
REVOKE ALL ON FUNCTION public.reject_contribution_plan_assignment_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.reject_contribution_plan_assignment_mutation() FROM authenticated;
CREATE FUNCTION public.reject_contribution_schedule_anchor_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.admission_date is distinct from new.admission_date then
    raise exception 'A contribution schedule admission anchor is immutable.'
      using errcode = '55000';
  end if;

  if old.cadence is distinct from new.cadence
    or old.due_day is distinct from new.due_day
    or old.lead_days is distinct from new.lead_days
    or old.billing_timezone is distinct from new.billing_timezone
    or old.currency is distinct from new.currency then
    raise exception 'Contribution schedule policy is immutable; append an effective-dated term.'
      using errcode = '55000';
  end if;

  return new;
end;
$function$;
REVOKE ALL ON FUNCTION public.reject_contribution_schedule_anchor_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.reject_contribution_schedule_anchor_mutation() FROM authenticated;
CREATE FUNCTION public.reject_initial_claim(p_claim_id uuid, p_reason text)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, claim_status public.payment_claim_status_enum, obligation_status public.payment_obligation_status_enum, decision_reason text, audit_event_id uuid, decision_applied_now boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := auth.uid();
  claim_record public.payment_claims%rowtype;
  organization_record public.organizations%rowtype;
  reviewer_membership public.organization_members%rowtype;
  obligation_record public.payment_obligations%rowtype;
  revision_record public.membership_application_revisions%rowtype;
  application_record public.membership_applications%rowtype;
  applicant_membership public.organization_members%rowtype;
  subscription_record public.subscriptions%rowtype;
  audit_record public.payment_claim_audit_events%rowtype;
  normalized_reason text;
  decision_timestamp timestamp with time zone := timezone('utc'::text, clock_timestamp());
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  normalized_reason = nullif(
    btrim(regexp_replace(coalesce(p_reason, ''), '\s+', ' ', 'g')),
    ''
  );

  if normalized_reason is null then
    raise exception 'A rejection reason is required.' using errcode = '22023';
  end if;

  if char_length(normalized_reason) > 500 then
    raise exception 'The rejection reason must be 500 characters or fewer.'
      using errcode = '22023';
  end if;

  select pc.*
  into claim_record
  from public.payment_claims pc
  where pc.id = p_claim_id
  for update;

  if not found then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  select o.*
  into organization_record
  from public.organizations o
  where o.id = claim_record.organization_id
  for update;

  if not found then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  if organization_record.organization_type <> 'association'::public.organization_type_enum then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  select om.*
  into reviewer_membership
  from public.organization_members om
  where om.organization_id = claim_record.organization_id
    and om.user_id = actor_id
  for update;

  if not found then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  if reviewer_membership.role <> 'admin'::public.organization_role_enum
    or claim_record.claimant_user_id = actor_id then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  select po.*
  into obligation_record
  from public.payment_obligations po
  where po.id = claim_record.obligation_id
  for update;

  if not found then
    raise exception 'This claim no longer has a valid payment obligation.'
      using errcode = '23514';
  end if;

  select mar.*
  into revision_record
  from public.membership_application_revisions mar
  where mar.id = obligation_record.application_revision_id
  for update;

  if not found then
    raise exception 'This claim no longer has a valid application revision.'
      using errcode = '23514';
  end if;

  select ma.*
  into application_record
  from public.membership_applications ma
  where ma.id = revision_record.application_id
  for update;

  if not found then
    raise exception 'This claim no longer has a valid application.'
      using errcode = '23514';
  end if;

  select om.*
  into applicant_membership
  from public.organization_members om
  where om.organization_id = obligation_record.organization_id
    and om.user_id = obligation_record.user_id
  for update;

  select s.*
  into subscription_record
  from public.subscriptions s
  where s.organization_id = obligation_record.organization_id
    and s.user_id = obligation_record.user_id
  for update;

  if claim_record.status = 'rejected'::public.payment_claim_status_enum then
    if claim_record.decision_reason is distinct from normalized_reason then
      raise exception 'This claim was already rejected with a different reason. Refresh before deciding.'
        using errcode = '40001';
    end if;

    select pcae.*
    into audit_record
    from public.payment_claim_audit_events pcae
    where pcae.claim_id = claim_record.id
      and pcae.next_state = 'payment_available'
    order by pcae.created_at asc, pcae.id asc
    limit 1;

    if not found then
      raise exception 'The rejected claim is missing its audit event.'
        using errcode = '23514';
    end if;

    return query
    select
      claim_record.id,
      obligation_record.id,
      claim_record.status,
      obligation_record.status,
      claim_record.decision_reason,
      audit_record.id,
      false;
    return;
  end if;

  if claim_record.status = 'approved'::public.payment_claim_status_enum then
    raise exception 'This claim was already approved. Refresh before deciding.'
      using errcode = '40001';
  end if;

  if claim_record.status <> 'under_review'::public.payment_claim_status_enum then
    raise exception 'This claim is no longer awaiting review. Refresh before deciding.'
      using errcode = '40001';
  end if;

  if obligation_record.purpose <> 'initial_admission'::public.payment_obligation_purpose_enum
    or obligation_record.status <> 'available'::public.payment_obligation_status_enum
    or obligation_record.payment_method <> 'manual_pix'
    or nullif(btrim(obligation_record.pix_copy_paste), '') is null
    or obligation_record.organization_id <> claim_record.organization_id
    or obligation_record.user_id <> claim_record.claimant_user_id
    or obligation_record.plan_type <> revision_record.plan_type
    or obligation_record.amount <> revision_record.plan_amount
    or obligation_record.currency <> revision_record.currency
    or obligation_record.application_revision_id <> revision_record.id
    or revision_record.organization_id <> claim_record.organization_id
    or revision_record.user_id <> claim_record.claimant_user_id
    or application_record.organization_id <> claim_record.organization_id
    or application_record.user_id <> claim_record.claimant_user_id
    or application_record.status <> 'submitted'::public.membership_application_status_enum then
    raise exception 'This claim no longer matches an actionable initial application.'
      using errcode = '40001';
  end if;

  -- A rejected claim leaves the obligation and all admission effects untouched.
  perform set_config('app.payment_claim_decision_command', 'on', true);

  update public.payment_claims pc
  set
    status = 'rejected'::public.payment_claim_status_enum,
    decided_at = decision_timestamp,
    decision_reason = normalized_reason
  where pc.id = claim_record.id;

  perform set_config('app.payment_claim_decision_command', 'off', true);

  insert into public.payment_claim_audit_events (
    organization_id,
    obligation_id,
    claim_id,
    actor_user_id,
    previous_state,
    next_state,
    reason,
    created_at
  )
  values (
    obligation_record.organization_id,
    obligation_record.id,
    claim_record.id,
    actor_id,
    'under_review',
    'payment_available',
    normalized_reason,
    decision_timestamp
  )
  returning * into audit_record;

  return query
  select
    claim_record.id,
    obligation_record.id,
    'rejected'::public.payment_claim_status_enum,
    obligation_record.status,
    normalized_reason,
    audit_record.id,
    true;
end;
$function$;
COMMENT ON FUNCTION public.reject_initial_claim(uuid,text) IS 'Atomically rejects only the current initial claim, records a normalized reason, keeps the obligation available, and appends one audit event.';
REVOKE ALL ON FUNCTION public.reject_initial_claim(uuid, text) FROM anon;
CREATE FUNCTION public.reject_membership_application_revision_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  raise exception 'Submitted application revisions are immutable.'
    using errcode = '55000';
end;
$function$;
REVOKE ALL ON FUNCTION public.reject_membership_application_revision_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.reject_membership_application_revision_mutation() FROM authenticated;
CREATE FUNCTION public.reject_payment_claim_audit_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  raise exception 'Payment claim audit events are immutable.'
    using errcode = '55000';
end;
$function$;
REVOKE ALL ON FUNCTION public.reject_payment_claim_audit_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.reject_payment_claim_audit_mutation() FROM authenticated;
CREATE FUNCTION public.reject_payment_claim_evidence_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Payment claim evidence is immutable.'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.obligation_id is distinct from new.obligation_id
    or old.organization_id is distinct from new.organization_id
    or old.claimant_user_id is distinct from new.claimant_user_id
    or old.payer_type is distinct from new.payer_type
    or old.payer_name is distinct from new.payer_name
    or old.created_at is distinct from new.created_at then
    raise exception 'Payment claim evidence is immutable.'
      using errcode = '55000';
  end if;

  if old.status is distinct from new.status
    or old.decided_at is distinct from new.decided_at
    or old.decision_reason is distinct from new.decision_reason then
    if current_setting('app.payment_claim_decision_command', true) <> 'on' then
      raise exception 'Payment claim decisions must use the decision command.'
        using errcode = '42501';
    end if;

    if old.status <> 'under_review'::public.payment_claim_status_enum
      or new.status not in (
        'approved'::public.payment_claim_status_enum,
        'rejected'::public.payment_claim_status_enum
      )
      or new.decided_at is null
      or (new.status = 'approved'::public.payment_claim_status_enum
        and new.decision_reason is not null)
      or (new.status = 'rejected'::public.payment_claim_status_enum
        and nullif(btrim(new.decision_reason), '') is null) then
      raise exception 'Invalid payment claim decision transition.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$function$;
REVOKE ALL ON FUNCTION public.reject_payment_claim_evidence_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.reject_payment_claim_evidence_mutation() FROM authenticated;
CREATE FUNCTION public.reject_payment_obligation_context_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.organization_id is distinct from new.organization_id
    or old.user_id is distinct from new.user_id
    or old.application_revision_id is distinct from new.application_revision_id
    or old.purpose is distinct from new.purpose
    or old.plan_type is distinct from new.plan_type
    or old.amount is distinct from new.amount
    or old.currency is distinct from new.currency
    or old.payment_method is distinct from new.payment_method
    or old.pix_copy_paste is distinct from new.pix_copy_paste
    or old.available_at is distinct from new.available_at
    or old.schedule_id is distinct from new.schedule_id
    or old.schedule_term_id is distinct from new.schedule_term_id
    or old.period_key is distinct from new.period_key
    or old.period_start is distinct from new.period_start
    or old.period_end is distinct from new.period_end
    or old.available_on is distinct from new.available_on
    or old.due_on is distinct from new.due_on
    or old.billing_timezone is distinct from new.billing_timezone
    or old.billing_due_day is distinct from new.billing_due_day
    or old.billing_lead_days is distinct from new.billing_lead_days
    or old.organization_name_snapshot is distinct from new.organization_name_snapshot
    or old.organization_slug_snapshot is distinct from new.organization_slug_snapshot then
    raise exception 'Payment obligation billing context is immutable.'
      using errcode = '55000';
  end if;

  return new;
end;
$function$;
REVOKE ALL ON FUNCTION public.reject_payment_obligation_context_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.reject_payment_obligation_context_mutation() FROM authenticated;
CREATE FUNCTION public.reject_recurring_payment_claim(p_claim_id uuid, p_reason text)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, claim_status public.payment_claim_status_enum, obligation_status public.payment_obligation_status_enum, decision_reason text, audit_event_id uuid, decision_applied_now boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  claim_record public.payment_claims%rowtype;
  obligation_record public.payment_obligations%rowtype;
  audit_record public.payment_claim_audit_events%rowtype;
  normalized_reason text := nullif(
    btrim(regexp_replace(coalesce(p_reason, ''), '\s+', ' ', 'g')),
    ''
  );
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if normalized_reason is null then
    raise exception 'A rejection reason is required.' using errcode = '22023';
  end if;

  if char_length(normalized_reason) > 500 then
    raise exception 'The rejection reason must be 500 characters or fewer.'
      using errcode = '22023';
  end if;

  select pc.*
  into claim_record
  from public.payment_claims pc
  where pc.id = p_claim_id
  for update;

  if not found then
    raise exception 'This claim is unavailable to the current reviewer.' using errcode = '42501';
  end if;

  if claim_record.claimant_user_id = actor_id
    or not exists (
      select 1
      from public.organization_members om
      join public.organizations o on o.id = om.organization_id
      where om.organization_id = claim_record.organization_id
        and om.user_id = actor_id
        and om.role = 'admin'::public.organization_role_enum
        and o.organization_type = 'association'::public.organization_type_enum
    ) then
    raise exception 'Association admin access is required.' using errcode = '42501';
  end if;

  select po.*
  into obligation_record
  from public.payment_obligations po
  where po.id = claim_record.obligation_id
  for update;

  if not found
    or obligation_record.purpose <> 'recurring'::public.payment_obligation_purpose_enum then
    raise exception 'This claim is not a recurring contribution claim.' using errcode = '40001';
  end if;

  if claim_record.status = 'rejected'::public.payment_claim_status_enum then
    if claim_record.decision_reason is distinct from normalized_reason then
      raise exception 'This claim was already rejected with a different reason. Refresh before deciding.'
        using errcode = '40001';
    end if;

    select pcae.*
    into audit_record
    from public.payment_claim_audit_events pcae
    where pcae.claim_id = claim_record.id
      and pcae.next_state = 'payment_available'
    order by pcae.created_at asc, pcae.id asc
    limit 1;

    return query
    select
      claim_record.id,
      obligation_record.id,
      claim_record.status,
      obligation_record.status,
      claim_record.decision_reason,
      audit_record.id,
      false;
    return;
  end if;

  if claim_record.status <> 'under_review'::public.payment_claim_status_enum
    or obligation_record.status <> 'available'::public.payment_obligation_status_enum then
    raise exception 'This claim is no longer actionable. Refresh before deciding.'
      using errcode = '40001';
  end if;

  perform set_config('app.payment_claim_decision_command', 'on', true);

  update public.payment_claims pc
  set
    status = 'rejected'::public.payment_claim_status_enum,
    decided_at = timezone('utc'::text, clock_timestamp()),
    decision_reason = normalized_reason
  where pc.id = claim_record.id;

  perform set_config('app.payment_claim_decision_command', 'off', true);

  insert into public.payment_claim_audit_events (
    organization_id,
    obligation_id,
    claim_id,
    actor_user_id,
    previous_state,
    next_state,
    reason
  )
  values (
    claim_record.organization_id,
    claim_record.obligation_id,
    claim_record.id,
    actor_id,
    'under_review',
    'payment_available',
    normalized_reason
  )
  returning * into audit_record;

  return query
  select
    claim_record.id,
    obligation_record.id,
    'rejected'::public.payment_claim_status_enum,
    obligation_record.status,
    normalized_reason,
    audit_record.id,
    true;
end;
$function$;
COMMENT ON FUNCTION public.reject_recurring_payment_claim(uuid,text) IS 'Rejects one recurring contribution claim, preserves its evidence, and leaves the obligation available for another claim.';
REVOKE ALL ON FUNCTION public.reject_recurring_payment_claim(uuid, text) FROM anon;
CREATE FUNCTION public.schedule_contribution_plan_change(p_schedule_id uuid, p_effective_period_start date, p_plan_type public.subscription_plan_type_enum)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  caller_role text := coalesce((select auth.jwt() ->> 'role'), '');
  schedule_record public.contribution_schedules%rowtype;
  organization_record public.organizations%rowtype;
  latest_assignment public.contribution_plan_assignments%rowtype;
  existing_assignment public.contribution_plan_assignments%rowtype;
  amount_value integer;
  pix_value text;
  expected_period_start date;
  local_date_value date;
begin
  if actor_id is null and caller_role <> 'service_role' then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select cs.*
  into schedule_record
  from public.contribution_schedules cs
  where cs.id = p_schedule_id
  for update;

  if not found then
    raise exception 'Contribution schedule was not found.' using errcode = 'P0002';
  end if;

  if not schedule_record.active then
    raise exception 'Only an active contribution schedule can receive a plan change.'
      using errcode = '55000';
  end if;

  select o.*
  into organization_record
  from public.organizations o
  where o.id = schedule_record.organization_id
    and o.organization_type = 'association'::public.organization_type_enum
  for update;

  if not found then
    raise exception 'Contribution organization was not found.' using errcode = 'P0002';
  end if;

  if caller_role <> 'service_role'
    and not exists (
      select 1
      from public.organization_members om
      where om.organization_id = schedule_record.organization_id
        and om.user_id = actor_id
        and om.role = 'admin'::public.organization_role_enum
    ) then
    raise exception 'Association admin access is required.' using errcode = '42501';
  end if;

  if p_effective_period_start is null or p_plan_type is null then
    raise exception 'A future effective period and plan are required.'
      using errcode = '22023';
  end if;

  local_date_value := timezone(schedule_record.billing_timezone, clock_timestamp())::date;
  if p_effective_period_start <= local_date_value then
    raise exception 'A plan change must start in a future billing period.'
      using errcode = '22023';
  end if;

  select cpa.*
  into latest_assignment
  from public.contribution_plan_assignments cpa
  where cpa.schedule_id = schedule_record.id
  order by cpa.effective_period_start desc, cpa.id desc
  limit 1;

  if not found then
    raise exception 'Contribution schedule has no billing term.' using errcode = '23514';
  end if;

  if p_effective_period_start <= latest_assignment.effective_period_start then
    raise exception 'A plan change must append a later effective billing period.'
      using errcode = '22023';
  end if;

  expected_period_start := public.recurring_due_date_on_or_after(
    schedule_record.admission_date,
    case latest_assignment.plan_type
      when 'annual'::public.subscription_plan_type_enum
        then 'annual'::public.contribution_cadence_enum
      else 'monthly'::public.contribution_cadence_enum
    end,
    coalesce(latest_assignment.due_day, schedule_record.due_day),
    p_effective_period_start
  );

  if expected_period_start <> p_effective_period_start then
    raise exception 'The effective date must be the start of an existing recurring period.'
      using errcode = '22023';
  end if;

  amount_value := case p_plan_type
    when 'annual'::public.subscription_plan_type_enum
      then organization_record.annual_price_amount
    else organization_record.monthly_price_amount
  end;
  pix_value := case p_plan_type
    when 'annual'::public.subscription_plan_type_enum
      then organization_record.annual_pix_copy_paste
    else organization_record.monthly_pix_copy_paste
  end;

  if amount_value is null or amount_value <= 0
    or nullif(btrim(pix_value), '') is null
    or organization_record.billing_currency !~ '^[A-Z]{3}$' then
    raise exception 'The future plan price or PIX configuration is incomplete.'
      using errcode = '23514';
  end if;

  select cpa.*
  into existing_assignment
  from public.contribution_plan_assignments cpa
  where cpa.schedule_id = schedule_record.id
    and cpa.effective_period_start = p_effective_period_start
  for update;

  if found then
    if existing_assignment.plan_type <> p_plan_type
      or existing_assignment.amount <> amount_value
      or existing_assignment.currency <> organization_record.billing_currency
      or existing_assignment.due_day <> schedule_record.due_day
      or existing_assignment.lead_days <> schedule_record.lead_days
      or existing_assignment.billing_timezone <> schedule_record.billing_timezone
      or existing_assignment.pix_copy_paste <> pix_value then
      raise exception 'A different plan is already scheduled for this period.'
        using errcode = '40001';
    end if;

    return existing_assignment.id;
  end if;

  insert into public.contribution_plan_assignments (
    schedule_id,
    effective_period_start,
    plan_type,
    amount,
    currency,
    due_day,
    lead_days,
    billing_timezone,
    pix_copy_paste
  )
  values (
    schedule_record.id,
    p_effective_period_start,
    p_plan_type,
    amount_value,
    organization_record.billing_currency,
    schedule_record.due_day,
    schedule_record.lead_days,
    schedule_record.billing_timezone,
    pix_value
  )
  returning id into existing_assignment.id;

  return existing_assignment.id;
end;
$function$;
COMMENT ON FUNCTION public.schedule_contribution_plan_change(uuid,date,public.subscription_plan_type_enum) IS 'Appends one idempotent future-effective billing term. Existing periods and schedule anchors are never rewritten.';
REVOKE ALL ON FUNCTION public.schedule_contribution_plan_change(uuid, date, public.subscription_plan_type_enum) FROM anon;
CREATE OR REPLACE FUNCTION public.set_membership_applications_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = timezone('utc'::text, clock_timestamp());

  if tg_op = 'UPDATE' then
    -- Submitting a draft is a state transition, not a new editable draft
    -- version. This lets a lost response retry the same command safely.
    if old.status = 'draft'::public.membership_application_status_enum
      and new.status = 'submitted'::public.membership_application_status_enum then
      new.draft_version = old.draft_version;
    else
      new.draft_version = old.draft_version + 1;
    end if;
  end if;

  return new;
end;
$function$;
CREATE FUNCTION public.snapshot_payment_obligation_context()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  organization_record public.organizations%rowtype;
  term_record public.contribution_plan_assignments%rowtype;
begin
  select o.*
  into organization_record
  from public.organizations o
  where o.id = new.organization_id;

  if not found then
    raise exception 'Payment obligation organization was not found.'
      using errcode = '23503';
  end if;

  if new.schedule_term_id is not null then
    select cpa.*
    into term_record
    from public.contribution_plan_assignments cpa
    where cpa.id = new.schedule_term_id;

    if not found then
      raise exception 'Payment obligation billing term was not found.'
        using errcode = '23503';
    end if;

    new.billing_timezone := coalesce(new.billing_timezone, term_record.billing_timezone);
    new.billing_due_day := coalesce(new.billing_due_day, term_record.due_day);
    new.billing_lead_days := coalesce(new.billing_lead_days, term_record.lead_days);
  end if;

  new.billing_timezone := coalesce(new.billing_timezone, organization_record.billing_timezone);
  new.billing_due_day := coalesce(new.billing_due_day, organization_record.billing_due_day);
  new.billing_lead_days := coalesce(new.billing_lead_days, organization_record.billing_lead_days);
  new.organization_name_snapshot := coalesce(
    new.organization_name_snapshot,
    organization_record.name
  );
  new.organization_slug_snapshot := coalesce(
    new.organization_slug_snapshot,
    organization_record.slug
  );

  return new;
end;
$function$;
REVOKE ALL ON FUNCTION public.snapshot_payment_obligation_context() FROM anon;
REVOKE ALL ON FUNCTION public.snapshot_payment_obligation_context() FROM authenticated;
CREATE FUNCTION public.submit_association_application(p_application_id uuid, p_organization_id uuid, p_plan_type public.subscription_plan_type_enum, p_terms_version text, p_draft_version bigint)
 RETURNS TABLE(application_revision_id uuid, obligation_id uuid, organization_id uuid, plan_type public.subscription_plan_type_enum, amount integer, currency text, payment_method text, obligation_status public.payment_obligation_status_enum, available_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := auth.uid();
  draft_record public.membership_applications%rowtype;
  organization_record public.organizations%rowtype;
  revision_record public.membership_application_revisions%rowtype;
  obligation_record public.payment_obligations%rowtype;
  revision_number integer;
  plan_amount integer;
  pix_payload text;
  submission_timestamp timestamp with time zone;
  terms_accepted_timestamp timestamp with time zone;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_application_id is null
    or p_organization_id is null
    or p_plan_type is null
    or p_terms_version is null
    or p_draft_version is null
    or p_draft_version <= 0 then
    raise exception 'The application submission request is incomplete.'
      using errcode = '22023';
  end if;

  select ma.*
  into draft_record
  from public.membership_applications ma
  where ma.id = p_application_id
  for update;

  if not found then
    raise exception 'Application draft not found.' using errcode = 'P0002';
  end if;

  if draft_record.user_id <> actor_id then
    raise exception 'Application draft is not owned by the current user.'
      using errcode = '42501';
  end if;

  if draft_record.organization_id <> p_organization_id then
    raise exception 'Application draft belongs to a different organization.'
      using errcode = '42501';
  end if;

  -- The revision lookup comes before current billing validation so a retry
  -- returns the original authoritative snapshot even after configuration
  -- changes. The draft row lock serializes identical and concurrent retries.
  select mar.*
  into revision_record
  from public.membership_application_revisions mar
  where mar.application_id = p_application_id
    and mar.draft_version = p_draft_version
  for update;

  if found then
    if revision_record.plan_type <> p_plan_type
      or revision_record.terms_version <> p_terms_version then
      raise exception 'The application was already submitted with different terms or plan.'
        using errcode = '40001';
    end if;

    select po.*
    into obligation_record
    from public.payment_obligations po
    where po.application_revision_id = revision_record.id
      and po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
    for update;

    if not found then
      insert into public.payment_obligations (
        organization_id,
        user_id,
        application_revision_id,
        purpose,
        status,
        plan_type,
        amount,
        currency,
        payment_method,
        pix_copy_paste,
        available_at
      )
      values (
        revision_record.organization_id,
        revision_record.user_id,
        revision_record.id,
        'initial_admission'::public.payment_obligation_purpose_enum,
        'available'::public.payment_obligation_status_enum,
        revision_record.plan_type,
        revision_record.plan_amount,
        revision_record.currency,
        'manual_pix',
        revision_record.pix_copy_paste,
        revision_record.submitted_at
      )
      returning * into obligation_record;
    end if;

    return query
    select
      revision_record.id,
      obligation_record.id,
      obligation_record.organization_id,
      obligation_record.plan_type,
      obligation_record.amount,
      obligation_record.currency,
      obligation_record.payment_method,
      obligation_record.status,
      obligation_record.available_at;
    return;
  end if;

  select o.*
  into organization_record
  from public.organizations o
  where o.id = p_organization_id
  for update;

  if not found then
    raise exception 'Association not found.' using errcode = 'P0002';
  end if;

  if organization_record.organization_type <> 'association'::public.organization_type_enum then
    raise exception 'Applications can only be submitted to associations.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.organization_members om
    where om.organization_id = organization_record.id
      and om.user_id = actor_id
  ) then
    raise exception 'The current person is already associated with this organization.'
      using errcode = '23505';
  end if;

  if p_terms_version <> organization_record.membership_terms_version then
    raise exception 'The association terms have changed. Review and accept the current terms.'
      using errcode = '40001';
  end if;

  if draft_record.draft_version <> p_draft_version then
    raise exception 'The application draft changed. Refresh and try again.'
      using errcode = '40001';
  end if;

  if draft_record.status <> 'draft'::public.membership_application_status_enum
    and draft_record.status <> 'submitted'::public.membership_application_status_enum then
    raise exception 'The application draft is not submittable.' using errcode = '23514';
  end if;

  if nullif(btrim(draft_record.full_name), '') is null
    or draft_record.birth_date is null
    or nullif(btrim(draft_record.nationality), '') is null
    or draft_record.marital_status is null
    or nullif(btrim(draft_record.profession), '') is null
    or nullif(btrim(draft_record.birthplace), '') is null
    or nullif(btrim(draft_record.cpf), '') is null
    or btrim(draft_record.cpf) !~ '^[0-9]{11}$'
    or nullif(btrim(draft_record.id_document_number), '') is null
    or nullif(btrim(draft_record.id_document_issuer), '') is null
    or nullif(btrim(draft_record.postal_code), '') is null
    or btrim(draft_record.postal_code) !~ '^[0-9]{8}$'
    or nullif(btrim(draft_record.address_line), '') is null
    or nullif(btrim(draft_record.city), '') is null
    or nullif(btrim(draft_record.state), '') is null
    or nullif(btrim(draft_record.email), '') is null
    or btrim(draft_record.email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or nullif(btrim(draft_record.phone), '') is null
    or btrim(draft_record.phone) !~ '^[0-9]{10,11}$'
    or draft_record.accepted_terms_at is null
    or draft_record.has_allergies is null
    or (draft_record.has_allergies
      and nullif(btrim(draft_record.allergies), '') is null)
    or draft_record.has_dietary_restrictions is null
    or (draft_record.has_dietary_restrictions
      and nullif(btrim(draft_record.dietary_restrictions), '') is null)
    or draft_record.highline_experience is null
    or draft_record.has_rescue_course is null
    or draft_record.first_aid_course is null
    or nullif(btrim(draft_record.emergency_contact_name), '') is null
    or nullif(btrim(draft_record.emergency_contact_relationship), '') is null
    or nullif(btrim(draft_record.emergency_contact_phone), '') is null
    or btrim(draft_record.emergency_contact_phone) !~ '^[0-9]{10,11}$' then
    raise exception 'Complete all required application fields before submitting.'
      using errcode = '23514';
  end if;

  plan_amount = case p_plan_type
    when 'annual'::public.subscription_plan_type_enum then organization_record.annual_price_amount
    else organization_record.monthly_price_amount
  end;

  pix_payload = case p_plan_type
    when 'annual'::public.subscription_plan_type_enum then organization_record.annual_pix_copy_paste
    else organization_record.monthly_pix_copy_paste
  end;

  if plan_amount is null or plan_amount <= 0
    or nullif(btrim(organization_record.billing_currency), '') is null
    or organization_record.billing_currency !~ '^[A-Z]{3}$'
    or nullif(btrim(pix_payload), '') is null then
    raise exception 'The association payment configuration is incomplete.'
      using errcode = '23514';
  end if;

  terms_accepted_timestamp = timezone('utc'::text, clock_timestamp());
  submission_timestamp = timezone('utc'::text, clock_timestamp());

  select coalesce(max(mar.revision_number), 0) + 1
  into revision_number
  from public.membership_application_revisions mar
  where mar.application_id = p_application_id;

  insert into public.membership_application_revisions (
    application_id,
    organization_id,
    user_id,
    revision_number,
    draft_version,
    plan_type,
    terms_version,
    accepted_terms_at,
    submitted_at,
    full_name,
    birth_date,
    nationality,
    marital_status,
    profession,
    birthplace,
    cpf,
    id_document_number,
    id_document_issuer,
    postal_code,
    address_line,
    city,
    state,
    email,
    phone,
    blood_type,
    has_allergies,
    allergies,
    has_dietary_restrictions,
    dietary_restrictions,
    highline_experience,
    has_rescue_course,
    first_aid_course,
    emergency_contact_name,
    emergency_contact_relationship,
    emergency_contact_phone,
    plan_amount,
    currency,
    pix_copy_paste
  )
  values (
    p_application_id,
    p_organization_id,
    actor_id,
    revision_number,
    p_draft_version,
    p_plan_type,
    p_terms_version,
    terms_accepted_timestamp,
    submission_timestamp,
    draft_record.full_name,
    draft_record.birth_date,
    draft_record.nationality,
    draft_record.marital_status,
    draft_record.profession,
    draft_record.birthplace,
    draft_record.cpf,
    draft_record.id_document_number,
    draft_record.id_document_issuer,
    draft_record.postal_code,
    draft_record.address_line,
    draft_record.city,
    draft_record.state,
    draft_record.email,
    draft_record.phone,
    draft_record.blood_type,
    draft_record.has_allergies,
    draft_record.allergies,
    draft_record.has_dietary_restrictions,
    draft_record.dietary_restrictions,
    draft_record.highline_experience,
    draft_record.has_rescue_course,
    draft_record.first_aid_course,
    draft_record.emergency_contact_name,
    draft_record.emergency_contact_relationship,
    draft_record.emergency_contact_phone,
    plan_amount,
    organization_record.billing_currency,
    pix_payload
  )
  returning * into revision_record;

  insert into public.payment_obligations (
    organization_id,
    user_id,
    application_revision_id,
    purpose,
    status,
    plan_type,
    amount,
    currency,
    payment_method,
    pix_copy_paste,
    available_at
  )
  values (
    p_organization_id,
    actor_id,
    revision_record.id,
    'initial_admission'::public.payment_obligation_purpose_enum,
    'available'::public.payment_obligation_status_enum,
    p_plan_type,
    plan_amount,
    organization_record.billing_currency,
    'manual_pix',
    pix_payload,
    submission_timestamp
  )
  returning * into obligation_record;

  if draft_record.status = 'draft'::public.membership_application_status_enum then
    update public.membership_applications ma
    set
      status = 'submitted'::public.membership_application_status_enum,
      submitted_at = submission_timestamp
    where ma.id = p_application_id;
  end if;

  return query
  select
    revision_record.id,
    obligation_record.id,
    obligation_record.organization_id,
    obligation_record.plan_type,
    obligation_record.amount,
    obligation_record.currency,
    obligation_record.payment_method,
    obligation_record.status,
    obligation_record.available_at;
end;
$function$;
COMMENT ON FUNCTION public.submit_association_application(uuid,uuid,public.subscription_plan_type_enum,text,bigint) IS 'Atomically snapshots an authenticated association application and creates exactly one initial manual-PIX obligation. Returns no personal application fields.';
REVOKE ALL ON FUNCTION public.submit_association_application(uuid, uuid, public.subscription_plan_type_enum, text, bigint) FROM anon;
REVOKE ALL ON FUNCTION public.submit_membership_application(uuid) FROM authenticated;
CREATE FUNCTION public.sync_contribution_schedule_on_membership()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.role in (
    'admin'::public.organization_role_enum,
    'member'::public.organization_role_enum
  ) then
    perform public.ensure_contribution_schedule(new.organization_id, new.user_id, null);
  end if;

  return new;
end;
$function$;
REVOKE ALL ON FUNCTION public.sync_contribution_schedule_on_membership() FROM anon;
REVOKE ALL ON FUNCTION public.sync_contribution_schedule_on_membership() FROM authenticated;
CREATE FUNCTION public.sync_contribution_schedule_on_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status = 'active'::public.subscription_status_enum then
    if exists (
      select 1
      from public.organization_members om
      where om.organization_id = new.organization_id
        and om.user_id = new.user_id
        and om.role in (
          'admin'::public.organization_role_enum,
          'member'::public.organization_role_enum
        )
    ) then
      perform public.ensure_contribution_schedule(new.organization_id, new.user_id, null);
    end if;
  else
    update public.contribution_schedules
    set active = false
    where organization_id = new.organization_id
      and user_id = new.user_id;
  end if;

  return new;
end;
$function$;
REVOKE ALL ON FUNCTION public.sync_contribution_schedule_on_subscription() FROM anon;
REVOKE ALL ON FUNCTION public.sync_contribution_schedule_on_subscription() FROM authenticated;
CREATE FUNCTION public.unregister_push_token(p_token text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  removed_id bigint;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  delete from public.push_tokens
  where token = nullif(btrim(p_token), '')
    and profile_id = actor_id
  returning id into removed_id;

  return removed_id is not null;
end;
$function$;
COMMENT ON FUNCTION public.unregister_push_token(text) IS 'Removes one device token only when it is owned by the currently authenticated profile.';
REVOKE ALL ON FUNCTION public.unregister_push_token(text) FROM anon;
CREATE FUNCTION public.validate_billing_policy_timezone()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_valid_billing_timezone(new.billing_timezone) then
    raise exception 'Billing timezone must be a valid IANA timezone name.'
      using errcode = '22023';
  end if;

  return new;
end;
$function$;
REVOKE ALL ON FUNCTION public.validate_billing_policy_timezone() FROM anon;
REVOKE ALL ON FUNCTION public.validate_billing_policy_timezone() FROM authenticated;
CREATE TABLE public.contribution_plan_assignments (id uuid DEFAULT gen_random_uuid() NOT NULL, schedule_id uuid NOT NULL, effective_period_start date NOT NULL, plan_type public.subscription_plan_type_enum NOT NULL, amount integer NOT NULL, currency text NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL, due_day smallint, lead_days smallint, billing_timezone text, pix_copy_paste text);
ALTER TABLE public.contribution_plan_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_plan_assignments ADD CONSTRAINT contribution_plan_assignments_amount_check CHECK (amount > 0);
ALTER TABLE public.contribution_plan_assignments ADD CONSTRAINT contribution_plan_assignments_currency_check CHECK (currency ~ '^[A-Z]{3}$'::text);
ALTER TABLE public.contribution_plan_assignments ADD CONSTRAINT contribution_plan_assignments_due_day_check CHECK (due_day IS NULL OR due_day >= 1 AND due_day <= 31);
ALTER TABLE public.contribution_plan_assignments ADD CONSTRAINT contribution_plan_assignments_lead_days_check CHECK (lead_days IS NULL OR lead_days >= 0 AND lead_days <= 31);
ALTER TABLE public.contribution_plan_assignments ADD CONSTRAINT contribution_plan_assignments_pix_check CHECK (pix_copy_paste IS NULL OR NULLIF(btrim(pix_copy_paste), ''::text) IS NOT NULL);
ALTER TABLE public.contribution_plan_assignments ADD CONSTRAINT contribution_plan_assignments_pkey PRIMARY KEY (id);
ALTER TABLE public.contribution_plan_assignments ADD CONSTRAINT contribution_plan_assignments_schedule_id_effective_period__key UNIQUE (schedule_id, effective_period_start);
ALTER TABLE public.contribution_plan_assignments ADD CONSTRAINT contribution_plan_assignments_timezone_check CHECK (billing_timezone IS NULL OR NULLIF(btrim(billing_timezone), ''::text) IS NOT NULL);
REVOKE ALL ON public.contribution_plan_assignments FROM anon;
REVOKE DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.contribution_plan_assignments FROM authenticated;
CREATE INDEX contribution_plan_assignments_schedule_period_idx ON public.contribution_plan_assignments (schedule_id, effective_period_start, id);
CREATE INDEX contribution_plan_assignments_schedule_effective_idx ON public.contribution_plan_assignments (schedule_id, effective_period_start DESC);
CREATE TRIGGER contribution_plan_assignments_immutable BEFORE UPDATE ON public.contribution_plan_assignments FOR EACH ROW EXECUTE FUNCTION public.reject_contribution_plan_assignment_mutation();
CREATE TRIGGER contribution_plan_assignments_validate_timezone BEFORE INSERT OR UPDATE OF billing_timezone ON public.contribution_plan_assignments FOR EACH ROW WHEN (new.billing_timezone IS NOT NULL) EXECUTE FUNCTION public.validate_billing_policy_timezone();
CREATE TABLE public.contribution_reminder_batch_events (batch_id uuid NOT NULL, event_id uuid NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL);
ALTER TABLE public.contribution_reminder_batch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_reminder_batch_events ADD CONSTRAINT contribution_reminder_batch_events_event_id_key UNIQUE (event_id);
ALTER TABLE public.contribution_reminder_batch_events ADD CONSTRAINT contribution_reminder_batch_events_pkey PRIMARY KEY (batch_id, event_id);
REVOKE ALL ON public.contribution_reminder_batch_events FROM anon;
REVOKE ALL ON public.contribution_reminder_batch_events FROM authenticated;
CREATE INDEX contribution_reminder_batch_events_event_idx ON public.contribution_reminder_batch_events (event_id, batch_id);
CREATE TABLE public.contribution_reminder_batches (id uuid DEFAULT gen_random_uuid() NOT NULL, organization_id uuid NOT NULL, recipient_user_id uuid NOT NULL, delivery_window_on date NOT NULL, status public.contribution_reminder_batch_status_enum DEFAULT 'pending'::public.contribution_reminder_batch_status_enum NOT NULL, lease_token uuid, lease_expires_at timestamp with time zone, attempt_count integer DEFAULT 0 NOT NULL, next_attempt_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL, last_failure_code text, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL, updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL, delivered_at timestamp with time zone);
COMMENT ON TABLE public.contribution_reminder_batches IS 'Private physical delivery windows. Several logical events share at most one batch per member and association window.';
ALTER TABLE public.contribution_reminder_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_reminder_batches ADD CONSTRAINT contribution_reminder_batches_attempt_count_check CHECK (attempt_count >= 0);
ALTER TABLE public.contribution_reminder_batches ADD CONSTRAINT contribution_reminder_batches_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.contribution_reminder_batches ADD CONSTRAINT contribution_reminder_batches_organization_id_recipient_use_key UNIQUE (organization_id, recipient_user_id, delivery_window_on);
ALTER TABLE public.contribution_reminder_batches ADD CONSTRAINT contribution_reminder_batches_pkey PRIMARY KEY (id);
ALTER TABLE public.contribution_reminder_batch_events ADD CONSTRAINT contribution_reminder_batch_events_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.contribution_reminder_batches(id) ON DELETE CASCADE;
ALTER TABLE public.contribution_reminder_batches ADD CONSTRAINT contribution_reminder_batches_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
REVOKE ALL ON public.contribution_reminder_batches FROM anon;
REVOKE ALL ON public.contribution_reminder_batches FROM authenticated;
CREATE INDEX contribution_reminder_batches_due_idx ON public.contribution_reminder_batches (next_attempt_at, delivery_window_on, organization_id, recipient_user_id, id) WHERE status = ANY (ARRAY['pending'::public.contribution_reminder_batch_status_enum, 'retryable'::public.contribution_reminder_batch_status_enum]);
CREATE TABLE public.contribution_reminder_delivery_attempts (id uuid DEFAULT gen_random_uuid() NOT NULL, batch_id uuid NOT NULL, push_token_id bigint, token text NOT NULL, language public.language, status public.contribution_reminder_attempt_status_enum DEFAULT 'pending'::public.contribution_reminder_attempt_status_enum NOT NULL, attempt_count integer DEFAULT 0 NOT NULL, lease_token uuid, lease_expires_at timestamp with time zone, next_attempt_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL, expo_ticket_id text, expo_receipt_status text, expo_receipt_error_code text, terminal_outcome text, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL, updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL, next_receipt_check_at timestamp with time zone);
COMMENT ON TABLE public.contribution_reminder_delivery_attempts IS 'Private at-least-once delivery state for one reminder batch and one device token.';
ALTER TABLE public.contribution_reminder_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_reminder_delivery_attempts ADD CONSTRAINT contribution_reminder_delivery_attempts_attempt_count_check CHECK (attempt_count >= 0);
ALTER TABLE public.contribution_reminder_delivery_attempts ADD CONSTRAINT contribution_reminder_delivery_attempts_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.contribution_reminder_batches(id) ON DELETE CASCADE;
ALTER TABLE public.contribution_reminder_delivery_attempts ADD CONSTRAINT contribution_reminder_delivery_attempts_batch_id_token_key UNIQUE (batch_id, token);
ALTER TABLE public.contribution_reminder_delivery_attempts ADD CONSTRAINT contribution_reminder_delivery_attempts_pkey PRIMARY KEY (id);
ALTER TABLE public.contribution_reminder_delivery_attempts ADD CONSTRAINT contribution_reminder_delivery_attempts_push_token_id_fkey FOREIGN KEY (push_token_id) REFERENCES public.push_tokens(id) ON DELETE SET NULL;
REVOKE ALL ON public.contribution_reminder_delivery_attempts FROM anon;
REVOKE ALL ON public.contribution_reminder_delivery_attempts FROM authenticated;
CREATE INDEX contribution_reminder_attempts_due_idx ON public.contribution_reminder_delivery_attempts (next_attempt_at, batch_id, status, id);
CREATE INDEX contribution_reminder_attempts_receipts_idx ON public.contribution_reminder_delivery_attempts (next_receipt_check_at, status, id) WHERE status = 'ticketed'::public.contribution_reminder_attempt_status_enum;
CREATE INDEX contribution_reminder_attempts_expired_receipt_leases_idx ON public.contribution_reminder_delivery_attempts (lease_expires_at, id) WHERE status = 'leased'::public.contribution_reminder_attempt_status_enum AND expo_ticket_id IS NOT NULL;
CREATE TABLE public.contribution_reminder_events (id uuid DEFAULT gen_random_uuid() NOT NULL, organization_id uuid NOT NULL, obligation_id uuid NOT NULL, recipient_user_id uuid NOT NULL, stage public.contribution_reminder_stage_enum NOT NULL, stage_on date NOT NULL, delivery_window_on date NOT NULL, status public.contribution_reminder_event_status_enum DEFAULT 'pending'::public.contribution_reminder_event_status_enum NOT NULL, suppression_reason text, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL, updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL, delivered_at timestamp with time zone);
COMMENT ON TABLE public.contribution_reminder_events IS 'Private logical contribution reminder events. One row exists per obligation, recipient, and stage.';
ALTER TABLE public.contribution_reminder_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_reminder_events ADD CONSTRAINT contribution_reminder_events_obligation_id_recipient_user_i_key UNIQUE (obligation_id, recipient_user_id, stage);
ALTER TABLE public.contribution_reminder_events ADD CONSTRAINT contribution_reminder_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.contribution_reminder_events ADD CONSTRAINT contribution_reminder_events_pkey PRIMARY KEY (id);
ALTER TABLE public.contribution_reminder_batch_events ADD CONSTRAINT contribution_reminder_batch_events_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.contribution_reminder_events(id) ON DELETE CASCADE;
ALTER TABLE public.contribution_reminder_events ADD CONSTRAINT contribution_reminder_events_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
REVOKE ALL ON public.contribution_reminder_events FROM anon;
REVOKE ALL ON public.contribution_reminder_events FROM authenticated;
CREATE INDEX contribution_reminder_events_obligation_idx ON public.contribution_reminder_events (obligation_id, status, stage);
CREATE INDEX contribution_reminder_events_pending_idx ON public.contribution_reminder_events (delivery_window_on, organization_id, recipient_user_id, created_at, id) WHERE status = 'pending'::public.contribution_reminder_event_status_enum;
CREATE TABLE public.contribution_schedules (id uuid DEFAULT gen_random_uuid() NOT NULL, organization_id uuid NOT NULL, user_id uuid NOT NULL, cadence public.contribution_cadence_enum NOT NULL, admission_date date NOT NULL, due_day smallint NOT NULL, lead_days smallint NOT NULL, billing_timezone text NOT NULL, currency text NOT NULL, active boolean DEFAULT true NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL);
ALTER TABLE public.contribution_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_schedules ADD CONSTRAINT contribution_schedules_currency_check CHECK (currency ~ '^[A-Z]{3}$'::text);
ALTER TABLE public.contribution_schedules ADD CONSTRAINT contribution_schedules_due_day_check CHECK (due_day >= 1 AND due_day <= 31);
ALTER TABLE public.contribution_schedules ADD CONSTRAINT contribution_schedules_lead_days_check CHECK (lead_days >= 0 AND lead_days <= 31);
ALTER TABLE public.contribution_schedules ADD CONSTRAINT contribution_schedules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.contribution_schedules ADD CONSTRAINT contribution_schedules_organization_id_user_id_key UNIQUE (organization_id, user_id);
ALTER TABLE public.contribution_schedules ADD CONSTRAINT contribution_schedules_pkey PRIMARY KEY (id);
ALTER TABLE public.contribution_plan_assignments ADD CONSTRAINT contribution_plan_assignments_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.contribution_schedules(id) ON DELETE CASCADE;
ALTER TABLE public.contribution_schedules ADD CONSTRAINT contribution_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
REVOKE ALL ON public.contribution_schedules FROM anon;
REVOKE DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.contribution_schedules FROM authenticated;
CREATE INDEX contribution_schedules_org_user_idx ON public.contribution_schedules (organization_id, user_id) WHERE active;
CREATE TRIGGER contribution_schedules_immutable_anchor BEFORE UPDATE ON public.contribution_schedules FOR EACH ROW EXECUTE FUNCTION public.reject_contribution_schedule_anchor_mutation();
CREATE TRIGGER contribution_schedules_validate_timezone BEFORE INSERT OR UPDATE OF billing_timezone ON public.contribution_schedules FOR EACH ROW EXECUTE FUNCTION public.validate_billing_policy_timezone();
CREATE TABLE public.membership_application_revisions (id uuid DEFAULT gen_random_uuid() NOT NULL, application_id uuid NOT NULL, organization_id uuid NOT NULL, user_id uuid NOT NULL, revision_number integer NOT NULL, draft_version bigint NOT NULL, plan_type public.subscription_plan_type_enum NOT NULL, terms_version text NOT NULL, accepted_terms_at timestamp with time zone NOT NULL, submitted_at timestamp with time zone NOT NULL, full_name text, birth_date date, nationality text, marital_status public.marital_status_enum, profession text, birthplace text, cpf text, id_document_number text, id_document_issuer text, postal_code text, address_line text, city text, state text, email text, phone text, blood_type public.blood_type_enum, has_allergies boolean NOT NULL, allergies text, has_dietary_restrictions boolean NOT NULL, dietary_restrictions text, highline_experience public.highline_experience_enum, has_rescue_course boolean, first_aid_course public.first_aid_course_enum, emergency_contact_name text, emergency_contact_relationship text, emergency_contact_phone text, plan_amount integer NOT NULL, currency text NOT NULL, pix_copy_paste text NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL);
COMMENT ON TABLE public.membership_application_revisions IS 'Immutable, revisionable snapshots of submitted association applications. Never use live profile data for admission review.';
COMMENT ON COLUMN public.membership_application_revisions.plan_amount IS 'Server-snapshotted price in the smallest currency unit at submission time.';
COMMENT ON COLUMN public.membership_application_revisions.pix_copy_paste IS 'Server-snapshotted static manual-PIX payload for the selected association plan.';
ALTER TABLE public.membership_application_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisi_application_id_revision_numbe_key UNIQUE (application_id, revision_number);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisio_application_id_draft_version_key UNIQUE (application_id, draft_version);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisions_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.membership_applications(id);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisions_currency_check CHECK (currency ~ '^[A-Z]{3}$'::text);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisions_draft_version_check CHECK (draft_version > 0);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisions_pix_copy_paste_check CHECK (NULLIF(btrim(pix_copy_paste), ''::text) IS NOT NULL);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisions_pkey PRIMARY KEY (id);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisions_plan_amount_check CHECK (plan_amount > 0);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisions_terms_version_check CHECK (NULLIF(btrim(terms_version), ''::text) IS NOT NULL);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
REVOKE ALL ON public.membership_application_revisions FROM anon;
REVOKE DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.membership_application_revisions FROM authenticated;
CREATE TRIGGER membership_application_revisions_immutable BEFORE DELETE OR UPDATE ON public.membership_application_revisions FOR EACH ROW EXECUTE FUNCTION public.reject_membership_application_revision_mutation();
CREATE POLICY "Application owners can read their submitted revisions" ON public.membership_application_revisions FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
ALTER TABLE public.membership_applications ADD COLUMN draft_version bigint DEFAULT 1 NOT NULL;
ALTER TABLE public.membership_applications ADD CONSTRAINT membership_applications_draft_version_check CHECK (draft_version > 0);
ALTER TABLE public.membership_applications ADD COLUMN has_allergies boolean DEFAULT false NOT NULL;
ALTER TABLE public.membership_applications ADD COLUMN has_dietary_restrictions boolean DEFAULT false NOT NULL;
CREATE INDEX organization_members_billing_workspace_idx ON public.organization_members (organization_id, role, user_id);
CREATE TRIGGER organization_members_sync_contribution_schedule AFTER INSERT OR UPDATE OF role ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.sync_contribution_schedule_on_membership();
ALTER TABLE public.organizations ADD COLUMN organization_type public.organization_type_enum DEFAULT 'association'::public.organization_type_enum NOT NULL;
CREATE POLICY "Members and association admins can read plan snapshots" ON public.contribution_plan_assignments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.contribution_schedules cs
  WHERE ((cs.id = contribution_plan_assignments.schedule_id) AND ((cs.user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM (public.organization_members om
             JOIN public.organizations o ON ((o.id = om.organization_id)))
          WHERE ((om.organization_id = cs.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::public.organization_role_enum) AND (o.organization_type = 'association'::public.organization_type_enum)))))))));
CREATE POLICY "Members and association admins can read schedules" ON public.contribution_schedules FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM (public.organization_members om
     JOIN public.organizations o ON ((o.id = om.organization_id)))
  WHERE ((om.organization_id = contribution_schedules.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::public.organization_role_enum) AND (o.organization_type = 'association'::public.organization_type_enum))))));
COMMENT ON COLUMN public.organizations.organization_type IS 'Immutable organization classification. Formal membership applications are allowed only for associations.';
ALTER TABLE public.organizations ADD COLUMN billing_currency text DEFAULT 'BRL'::text NOT NULL;
COMMENT ON COLUMN public.organizations.billing_currency IS 'ISO 4217 currency used for new association obligations.';
ALTER TABLE public.organizations ADD CONSTRAINT organizations_billing_currency_format_check CHECK (billing_currency ~ '^[A-Z]{3}$'::text);
ALTER TABLE public.organizations ADD COLUMN membership_terms_version text DEFAULT 'estatuto-v1'::text NOT NULL;
COMMENT ON COLUMN public.organizations.membership_terms_version IS 'Exact terms version accepted by new association applicants.';
ALTER TABLE public.organizations ADD CONSTRAINT organizations_membership_terms_version_check CHECK (NULLIF(btrim(membership_terms_version), ''::text) IS NOT NULL);
ALTER TABLE public.organizations ADD COLUMN billing_timezone text DEFAULT 'America/Sao_Paulo'::text NOT NULL;
COMMENT ON COLUMN public.organizations.billing_timezone IS 'IANA timezone used when evaluating contribution calendar dates.';
ALTER TABLE public.organizations ADD CONSTRAINT organizations_billing_timezone_check CHECK (NULLIF(btrim(billing_timezone), ''::text) IS NOT NULL);
ALTER TABLE public.organizations ADD COLUMN billing_due_day smallint DEFAULT 10 NOT NULL;
COMMENT ON COLUMN public.organizations.billing_due_day IS 'Calendar day used for recurring contributions; initially 10 for SL.A.C.';
ALTER TABLE public.organizations ADD CONSTRAINT organizations_billing_due_day_check CHECK (billing_due_day >= 1 AND billing_due_day <= 31);
ALTER TABLE public.organizations ADD COLUMN billing_lead_days smallint DEFAULT 7 NOT NULL;
COMMENT ON COLUMN public.organizations.billing_lead_days IS 'Number of calendar days before due_on when a recurring obligation becomes available.';
ALTER TABLE public.organizations ADD CONSTRAINT organizations_billing_lead_days_check CHECK (billing_lead_days >= 0 AND billing_lead_days <= 31);
ALTER TABLE public.organizations ADD COLUMN contribution_reminder_local_time time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL;
COMMENT ON COLUMN public.organizations.contribution_reminder_local_time IS 'Local delivery time for private contribution reminders. The initial default is 09:00.';
CREATE TRIGGER organizations_validate_billing_policy_timezone BEFORE INSERT OR UPDATE OF billing_timezone ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.validate_billing_policy_timezone();
CREATE TABLE public.payment_claim_audit_events (id uuid DEFAULT gen_random_uuid() NOT NULL, organization_id uuid NOT NULL, obligation_id uuid NOT NULL, claim_id uuid NOT NULL, actor_user_id uuid NOT NULL, previous_state text NOT NULL, next_state text NOT NULL, reason text, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL);
COMMENT ON TABLE public.payment_claim_audit_events IS 'Append-only claim transition evidence containing server-derived actor, obligation, claim, state change, time, and optional reason.';
ALTER TABLE public.payment_claim_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.profiles(id);
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_claim_id_next_state_key UNIQUE (claim_id, next_state);
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_next_state_check CHECK (next_state = ANY (ARRAY['payment_available'::text, 'under_review'::text, 'payment_settled'::text]));
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_pkey PRIMARY KEY (id);
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_previous_state_check CHECK (previous_state = ANY (ARRAY['payment_available'::text, 'under_review'::text, 'payment_settled'::text]));
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_reason_check CHECK (reason IS NULL OR char_length(reason) <= 500);
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_transition_check CHECK (previous_state = 'payment_available'::text AND next_state = 'under_review'::text OR previous_state = 'under_review'::text AND (next_state = ANY (ARRAY['payment_available'::text, 'payment_settled'::text])));
REVOKE ALL ON public.payment_claim_audit_events FROM anon;
REVOKE DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.payment_claim_audit_events FROM authenticated;
CREATE INDEX payment_claim_audit_events_obligation_created_at_idx ON public.payment_claim_audit_events (obligation_id, created_at DESC);
CREATE INDEX payment_claim_audit_events_organization_created_at_idx ON public.payment_claim_audit_events (organization_id, created_at DESC);
CREATE INDEX payment_claim_audit_events_actor_created_at_idx ON public.payment_claim_audit_events (actor_user_id, created_at DESC);
CREATE INDEX payment_claim_audit_events_claim_history_idx ON public.payment_claim_audit_events (claim_id, created_at, id);
CREATE TRIGGER payment_claim_audit_events_immutable BEFORE DELETE OR UPDATE ON public.payment_claim_audit_events FOR EACH ROW EXECUTE FUNCTION public.reject_payment_claim_audit_mutation();
CREATE POLICY "Organization admins can read payment claim audit events" ON public.payment_claim_audit_events FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = payment_claim_audit_events.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::public.organization_role_enum)))));
CREATE TABLE public.payment_claims (id uuid DEFAULT gen_random_uuid() NOT NULL, obligation_id uuid NOT NULL, organization_id uuid NOT NULL, claimant_user_id uuid NOT NULL, payer_type public.payment_claim_payer_type_enum NOT NULL, payer_name text, status public.payment_claim_status_enum DEFAULT 'under_review'::public.payment_claim_status_enum NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL, decided_at timestamp with time zone, decision_reason text);
CREATE POLICY "Claimants can read their own payment claim audit events" ON public.payment_claim_audit_events FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.payment_claims pc
  WHERE ((pc.id = payment_claim_audit_events.claim_id) AND (pc.claimant_user_id = ( SELECT auth.uid() AS uid))))));
COMMENT ON TABLE public.payment_claims IS 'Immutable payment-claim submissions. Claim decisions are server-controlled and never settle the obligation by themselves.';
COMMENT ON COLUMN public.payment_claims.payer_name IS 'Normalized payer name when another person made the deposit. No receipt or banking metadata is stored.';
COMMENT ON COLUMN public.payment_claims.status IS 'Current server-controlled decision state. Submission evidence remains immutable; transitions are appended to payment_claim_audit_events.';
ALTER TABLE public.payment_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_claims ADD CONSTRAINT payment_claims_check CHECK (payer_type = 'applicant'::public.payment_claim_payer_type_enum AND payer_name IS NULL OR payer_type = 'other'::public.payment_claim_payer_type_enum AND NULLIF(btrim(payer_name), ''::text) IS NOT NULL AND char_length(payer_name) <= 120);
ALTER TABLE public.payment_claims ADD CONSTRAINT payment_claims_check1 CHECK (status <> 'under_review'::public.payment_claim_status_enum OR decided_at IS NULL AND decision_reason IS NULL);
ALTER TABLE public.payment_claims ADD CONSTRAINT payment_claims_claimant_user_id_fkey FOREIGN KEY (claimant_user_id) REFERENCES public.profiles(id);
ALTER TABLE public.payment_claims ADD CONSTRAINT payment_claims_decision_reason_check CHECK (decision_reason IS NULL OR char_length(decision_reason) <= 500);
ALTER TABLE public.payment_claims ADD CONSTRAINT payment_claims_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.payment_claims ADD CONSTRAINT payment_claims_pkey PRIMARY KEY (id);
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.payment_claims(id);
ALTER TABLE public.payment_claims ADD CONSTRAINT payment_claims_terminal_decided_at_check CHECK (status = 'under_review'::public.payment_claim_status_enum OR decided_at IS NOT NULL);
REVOKE ALL ON public.payment_claims FROM anon;
REVOKE DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.payment_claims FROM authenticated;
CREATE INDEX payment_claims_current_queue_idx ON public.payment_claims (organization_id, created_at, id) WHERE status = 'under_review'::public.payment_claim_status_enum;
CREATE UNIQUE INDEX payment_claims_one_under_review_per_obligation_idx ON public.payment_claims (obligation_id) WHERE status = 'under_review'::public.payment_claim_status_enum;
CREATE INDEX payment_claims_obligation_claimant_created_at_idx ON public.payment_claims (obligation_id, claimant_user_id, created_at DESC, id DESC);
CREATE INDEX payment_claims_billing_workspace_queue_idx ON public.payment_claims (organization_id, created_at, id, obligation_id) WHERE status = 'under_review'::public.payment_claim_status_enum;
CREATE INDEX payment_claims_obligation_status_idx ON public.payment_claims (obligation_id, status, created_at DESC, id DESC);
CREATE INDEX payment_claims_organization_status_idx ON public.payment_claims (organization_id, status, created_at DESC);
CREATE INDEX payment_claims_claimant_created_at_idx ON public.payment_claims (claimant_user_id, created_at DESC);
CREATE TRIGGER payment_claims_evidence_immutable BEFORE DELETE OR UPDATE ON public.payment_claims FOR EACH ROW EXECUTE FUNCTION public.reject_payment_claim_evidence_mutation();
CREATE POLICY "Claimants can read their own payment claims" ON public.payment_claims FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = claimant_user_id));
CREATE POLICY "Organization admins can read payment claims" ON public.payment_claims FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = payment_claims.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::public.organization_role_enum)))));
CREATE TABLE public.payment_obligations (id uuid DEFAULT gen_random_uuid() NOT NULL, organization_id uuid NOT NULL, user_id uuid NOT NULL, application_revision_id uuid, purpose public.payment_obligation_purpose_enum DEFAULT 'initial_admission'::public.payment_obligation_purpose_enum NOT NULL, status public.payment_obligation_status_enum DEFAULT 'available'::public.payment_obligation_status_enum NOT NULL, plan_type public.subscription_plan_type_enum NOT NULL, amount integer NOT NULL, currency text NOT NULL, payment_method text DEFAULT 'manual_pix'::text NOT NULL, pix_copy_paste text NOT NULL, available_at timestamp with time zone NOT NULL, settled_at timestamp with time zone, legacy_payment_id uuid, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL, schedule_id uuid, period_key text DEFAULT 'initial'::text NOT NULL, period_start date DEFAULT CURRENT_DATE NOT NULL, period_end date DEFAULT CURRENT_DATE NOT NULL, available_on date DEFAULT CURRENT_DATE NOT NULL, due_on date DEFAULT CURRENT_DATE NOT NULL, schedule_term_id uuid, billing_timezone text, billing_due_day smallint, billing_lead_days smallint, organization_name_snapshot text, organization_slug_snapshot text);
COMMENT ON TABLE public.payment_obligations IS 'Server-authoritative, independently payable billing obligations. Claims and admission decisions are separate workflows.';
COMMENT ON COLUMN public.payment_obligations.legacy_payment_id IS 'Optional migration link to an existing legacy payment; new submissions never create a legacy payment row.';
COMMENT ON COLUMN public.payment_obligations.schedule_term_id IS 'Immutable effective-dated contribution term that produced this obligation.';
COMMENT ON COLUMN public.payment_obligations.billing_timezone IS 'Timezone snapshot used to evaluate this obligation; never read from live policy for history.';
COMMENT ON COLUMN public.payment_obligations.billing_due_day IS 'Due-day policy snapshot used to produce this obligation.';
COMMENT ON COLUMN public.payment_obligations.billing_lead_days IS 'Lead-day policy snapshot used to produce this obligation.';
ALTER TABLE public.payment_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_amount_check CHECK (amount > 0);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_application_revision_id_fkey FOREIGN KEY (application_revision_id) REFERENCES public.membership_application_revisions(id);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_application_revision_id_purpose_key UNIQUE (application_revision_id, purpose);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_currency_check CHECK (currency ~ '^[A-Z]{3}$'::text);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_legacy_payment_id_fkey FOREIGN KEY (legacy_payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_legacy_payment_id_key UNIQUE (legacy_payment_id);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_payment_method_check CHECK (payment_method = 'manual_pix'::text);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_pix_copy_paste_check CHECK (NULLIF(btrim(pix_copy_paste), ''::text) IS NOT NULL);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_pkey PRIMARY KEY (id);
ALTER TABLE public.contribution_reminder_events ADD CONSTRAINT contribution_reminder_events_obligation_id_fkey FOREIGN KEY (obligation_id) REFERENCES public.payment_obligations(id) ON DELETE CASCADE;
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_obligation_id_fkey FOREIGN KEY (obligation_id) REFERENCES public.payment_obligations(id);
ALTER TABLE public.payment_claims ADD CONSTRAINT payment_claims_obligation_id_fkey FOREIGN KEY (obligation_id) REFERENCES public.payment_obligations(id);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.contribution_schedules(id);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_schedule_period_key UNIQUE (schedule_id, period_key);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_schedule_term_id_fkey FOREIGN KEY (schedule_term_id) REFERENCES public.contribution_plan_assignments(id);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_scope_check CHECK (purpose = 'initial_admission'::public.payment_obligation_purpose_enum AND application_revision_id IS NOT NULL AND schedule_id IS NULL OR purpose = 'recurring'::public.payment_obligation_purpose_enum AND application_revision_id IS NULL AND schedule_id IS NOT NULL);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
REVOKE ALL ON public.payment_obligations FROM anon;
REVOKE DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.payment_obligations FROM authenticated;
CREATE INDEX payment_obligations_billing_workspace_idx ON public.payment_obligations (organization_id, purpose, status, due_on, available_on, created_at, id);
CREATE INDEX payment_obligations_recurring_term_idx ON public.payment_obligations (schedule_term_id, due_on, id) WHERE purpose = 'recurring'::public.payment_obligation_purpose_enum;
CREATE INDEX payment_obligations_member_due_idx ON public.payment_obligations (organization_id, user_id, due_on DESC, created_at DESC, id DESC);
CREATE INDEX payment_obligations_initial_queue_idx ON public.payment_obligations (organization_id, status, application_revision_id) WHERE purpose = 'initial_admission'::public.payment_obligation_purpose_enum;
CREATE INDEX payment_obligations_actionable_idx ON public.payment_obligations (organization_id, user_id, available_on, due_on, created_at, id) WHERE status <> ALL (ARRAY['settled'::public.payment_obligation_status_enum, 'void'::public.payment_obligation_status_enum]);
CREATE INDEX payment_obligations_user_organization_idx ON public.payment_obligations (user_id, organization_id, status);
CREATE TRIGGER payment_obligations_immutable_context BEFORE UPDATE ON public.payment_obligations FOR EACH ROW EXECUTE FUNCTION public.reject_payment_obligation_context_mutation();
CREATE TRIGGER payment_obligations_snapshot_context BEFORE INSERT ON public.payment_obligations FOR EACH ROW EXECUTE FUNCTION public.snapshot_payment_obligation_context();
CREATE POLICY "Association admins can read payment obligations" ON public.payment_obligations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.organization_members om
     JOIN public.organizations o ON ((o.id = om.organization_id)))
  WHERE ((om.organization_id = payment_obligations.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::public.organization_role_enum) AND (o.organization_type = 'association'::public.organization_type_enum)))));
CREATE POLICY "Obligation owners can read their obligations" ON public.payment_obligations FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
REVOKE ALL ON public.push_tokens FROM anon;
REVOKE ALL ON public.push_tokens FROM authenticated;
REVOKE DELETE, INSERT, UPDATE ON public.subscriptions FROM anon;
REVOKE DELETE, INSERT, UPDATE ON public.subscriptions FROM authenticated;
CREATE TRIGGER subscriptions_sync_contribution_schedule AFTER INSERT OR UPDATE OF status ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.sync_contribution_schedule_on_subscription();

-- Normalize legacy drafts before snapshotting submitted applications.
update public.membership_applications
set has_allergies = true
where nullif(btrim(allergies), '') is not null;

update public.membership_applications
set has_dietary_restrictions = true
where nullif(btrim(dietary_restrictions), '') is not null;

-- Preserve each existing submitted application as one immutable revision.
insert into public.membership_application_revisions (
  application_id,
  organization_id,
  user_id,
  revision_number,
  draft_version,
  plan_type,
  terms_version,
  accepted_terms_at,
  submitted_at,
  full_name,
  birth_date,
  nationality,
  marital_status,
  profession,
  birthplace,
  cpf,
  id_document_number,
  id_document_issuer,
  postal_code,
  address_line,
  city,
  state,
  email,
  phone,
  blood_type,
  has_allergies,
  allergies,
  has_dietary_restrictions,
  dietary_restrictions,
  highline_experience,
  has_rescue_course,
  first_aid_course,
  emergency_contact_name,
  emergency_contact_relationship,
  emergency_contact_phone,
  plan_amount,
  currency,
  pix_copy_paste
)
select
  ma.id,
  ma.organization_id,
  ma.user_id,
  1,
  ma.draft_version,
  s.plan_type,
  o.membership_terms_version,
  coalesce(ma.accepted_terms_at, ma.submitted_at, timezone('utc'::text, now())),
  coalesce(ma.submitted_at, timezone('utc'::text, now())),
  ma.full_name,
  ma.birth_date,
  ma.nationality,
  ma.marital_status,
  ma.profession,
  ma.birthplace,
  ma.cpf,
  ma.id_document_number,
  ma.id_document_issuer,
  ma.postal_code,
  ma.address_line,
  ma.city,
  ma.state,
  ma.email,
  ma.phone,
  ma.blood_type,
  ma.has_allergies,
  ma.allergies,
  ma.has_dietary_restrictions,
  ma.dietary_restrictions,
  ma.highline_experience,
  ma.has_rescue_course,
  ma.first_aid_course,
  ma.emergency_contact_name,
  ma.emergency_contact_relationship,
  ma.emergency_contact_phone,
  case s.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_price_amount
    else o.monthly_price_amount
  end,
  o.billing_currency,
  case s.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_pix_copy_paste
    else o.monthly_pix_copy_paste
  end
from public.membership_applications ma
join public.organizations o on o.id = ma.organization_id
join public.subscriptions s
  on s.organization_id = ma.organization_id
  and s.user_id = ma.user_id
where ma.status = 'submitted'::public.membership_application_status_enum
  and o.organization_type = 'association'::public.organization_type_enum
  and case s.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_price_amount
    else o.monthly_price_amount
  end > 0
  and nullif(btrim(case s.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_pix_copy_paste
    else o.monthly_pix_copy_paste
  end), '') is not null
on conflict (application_id, draft_version) do nothing;

-- Convert the historical admission payment into one final-shape obligation.
insert into public.payment_obligations (
  organization_id,
  user_id,
  application_revision_id,
  purpose,
  status,
  plan_type,
  amount,
  currency,
  payment_method,
  pix_copy_paste,
  available_at,
  settled_at,
  legacy_payment_id,
  period_key,
  period_start,
  period_end,
  available_on,
  due_on,
  billing_timezone,
  billing_due_day,
  billing_lead_days,
  organization_name_snapshot,
  organization_slug_snapshot
)
select
  mar.organization_id,
  mar.user_id,
  mar.id,
  'initial_admission'::public.payment_obligation_purpose_enum,
  case
    when legacy_payment.status = 'succeeded'::public.payment_status_enum
      then 'settled'::public.payment_obligation_status_enum
    else 'available'::public.payment_obligation_status_enum
  end,
  mar.plan_type,
  coalesce(legacy_payment.amount, mar.plan_amount),
  mar.currency,
  'manual_pix',
  mar.pix_copy_paste,
  coalesce(legacy_payment.created_at, mar.submitted_at),
  case
    when legacy_payment.status = 'succeeded'::public.payment_status_enum
      then coalesce(
        legacy_payment.paid_at,
        legacy_payment.settlement_applied_at,
        legacy_payment.created_at
      )
    else null
  end,
  legacy_payment.id,
  'initial:' || mar.id::text,
  timezone(
    o.billing_timezone,
    coalesce(legacy_payment.created_at, mar.submitted_at)
  )::date,
  timezone(
    o.billing_timezone,
    coalesce(legacy_payment.created_at, mar.submitted_at)
  )::date,
  timezone(
    o.billing_timezone,
    coalesce(legacy_payment.created_at, mar.submitted_at)
  )::date,
  timezone(
    o.billing_timezone,
    coalesce(legacy_payment.created_at, mar.submitted_at)
  )::date,
  o.billing_timezone,
  o.billing_due_day,
  o.billing_lead_days,
  o.name,
  o.slug
from public.membership_application_revisions mar
join public.organizations o on o.id = mar.organization_id
left join public.subscriptions s
  on s.organization_id = mar.organization_id
  and s.user_id = mar.user_id
  and s.plan_type = mar.plan_type
left join lateral (
  select
    p.id,
    p.amount,
    p.status,
    p.created_at,
    p.paid_at,
    p.settlement_applied_at
  from public.payments p
  where p.organization_id = mar.organization_id
    and p.user_id = mar.user_id
    and p.subscription_id = s.id
    and p.payment_provider is null
    and p.provider_payment_id is null
  order by
    case when p.status = 'succeeded'::public.payment_status_enum then 0 else 1 end,
    p.created_at asc
  limit 1
) legacy_payment on true
where mar.plan_amount > 0
  and nullif(btrim(mar.pix_copy_paste), '') is not null
on conflict (application_revision_id, purpose) do nothing;

-- An admission date must come from verified payment evidence. Abort the
-- cutover instead of silently inventing anchors for existing active members.
do $$
begin
  if exists (
    select 1
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    join public.subscriptions s
      on s.organization_id = om.organization_id
      and s.user_id = om.user_id
      and s.status = 'active'::public.subscription_status_enum
    where o.organization_type = 'association'::public.organization_type_enum
      and om.role in (
        'admin'::public.organization_role_enum,
        'member'::public.organization_role_enum
      )
      and not exists (
        select 1
        from public.payments p
        where p.organization_id = om.organization_id
          and p.user_id = om.user_id
          and p.subscription_id = s.id
          and p.status = 'succeeded'::public.payment_status_enum
      )
  ) then
    raise exception
      'Billing cutover stopped: an active association member has no succeeded admission payment.';
  end if;
end;
$$;

insert into public.contribution_schedules (
  organization_id,
  user_id,
  cadence,
  admission_date,
  due_day,
  lead_days,
  billing_timezone,
  currency,
  active
)
select
  om.organization_id,
  om.user_id,
  case
    when s.plan_type = 'annual'::public.subscription_plan_type_enum
      then 'annual'::public.contribution_cadence_enum
    else 'monthly'::public.contribution_cadence_enum
  end,
  timezone(
    o.billing_timezone,
    admission_payment.admission_at
  )::date,
  o.billing_due_day,
  o.billing_lead_days,
  o.billing_timezone,
  o.billing_currency,
  true
from public.organization_members om
join public.organizations o on o.id = om.organization_id
join public.subscriptions s
  on s.organization_id = om.organization_id
  and s.user_id = om.user_id
  and s.status = 'active'::public.subscription_status_enum
join lateral (
  select min(coalesce(p.paid_at, p.settlement_applied_at, p.created_at)) as admission_at
  from public.payments p
  where p.organization_id = om.organization_id
    and p.user_id = om.user_id
    and p.subscription_id = s.id
    and p.status = 'succeeded'::public.payment_status_enum
) admission_payment on admission_payment.admission_at is not null
where o.organization_type = 'association'::public.organization_type_enum
  and om.role in (
    'admin'::public.organization_role_enum,
    'member'::public.organization_role_enum
  )
on conflict (organization_id, user_id) do nothing;

insert into public.contribution_plan_assignments (
  schedule_id,
  effective_period_start,
  plan_type,
  amount,
  currency,
  due_day,
  lead_days,
  billing_timezone,
  pix_copy_paste
)
select
  cs.id,
  cs.admission_date,
  s.plan_type,
  case s.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_price_amount
    else o.monthly_price_amount
  end,
  o.billing_currency,
  o.billing_due_day,
  o.billing_lead_days,
  o.billing_timezone,
  case s.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_pix_copy_paste
    else o.monthly_pix_copy_paste
  end
from public.contribution_schedules cs
join public.organizations o on o.id = cs.organization_id
join public.subscriptions s
  on s.organization_id = cs.organization_id
  and s.user_id = cs.user_id
where cs.active
  and case s.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_price_amount
    else o.monthly_price_amount
  end > 0
  and nullif(btrim(case s.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_pix_copy_paste
    else o.monthly_pix_copy_paste
  end), '') is not null
on conflict (schedule_id, effective_period_start) do nothing;

-- Foreign-key and membership lookup indexes missing from the generated delta.
create index membership_application_revisions_user_idx
  on public.membership_application_revisions (user_id);
create index membership_application_revisions_organization_idx
  on public.membership_application_revisions (organization_id);
create index contribution_schedules_active_user_idx
  on public.contribution_schedules (user_id)
  where active;
create index push_tokens_profile_id_idx
  on public.push_tokens (profile_id)
  where profile_id is not null;
create index contribution_reminder_delivery_attempts_push_token_idx
  on public.contribution_reminder_delivery_attempts (push_token_id)
  where push_token_id is not null;
create index contribution_reminder_events_recipient_organization_idx
  on public.contribution_reminder_events (recipient_user_id, organization_id);
create index contribution_reminder_batches_recipient_organization_idx
  on public.contribution_reminder_batches (recipient_user_id, organization_id);

alter function public.set_membership_applications_updated_at()
  set search_path = '';
alter function public.reject_membership_application_revision_mutation()
  set search_path = '';
alter function public.reject_payment_claim_audit_mutation()
  set search_path = '';

-- One permissive read policy per table keeps owner/admin access without the
-- extra policy evaluation flagged by the database advisor.
drop policy "Organization admins can read payment claim audit events"
  on public.payment_claim_audit_events;
drop policy "Claimants can read their own payment claim audit events"
  on public.payment_claim_audit_events;
create policy "Claimants and admins can read claim audit"
  on public.payment_claim_audit_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.payment_claims pc
      where pc.id = payment_claim_audit_events.claim_id
        and (
          pc.claimant_user_id = (select auth.uid())
          or exists (
            select 1
            from public.organization_members om
            where om.organization_id = payment_claim_audit_events.organization_id
              and om.user_id = (select auth.uid())
              and om.role = 'admin'::public.organization_role_enum
          )
        )
    )
  );

drop policy "Claimants can read their own payment claims"
  on public.payment_claims;
drop policy "Organization admins can read payment claims"
  on public.payment_claims;
create policy "Claimants and organization admins can read payment claims"
  on public.payment_claims
  for select
  to authenticated
  using (
    claimant_user_id = (select auth.uid())
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = payment_claims.organization_id
        and om.user_id = (select auth.uid())
        and om.role = 'admin'::public.organization_role_enum
    )
  );

drop policy "Association admins can read payment obligations"
  on public.payment_obligations;
drop policy "Obligation owners can read their obligations"
  on public.payment_obligations;
create policy "Owners and association admins can read payment obligations"
  on public.payment_obligations
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.organization_members om
      join public.organizations o on o.id = om.organization_id
      where om.organization_id = payment_obligations.organization_id
        and om.user_id = (select auth.uid())
        and om.role = 'admin'::public.organization_role_enum
        and o.organization_type = 'association'::public.organization_type_enum
    )
  );

-- Default privileges are intentionally narrowed. Clients read through RLS;
-- mutations and scheduler workflows go through the reviewed RPC surface.
revoke all on table
  public.membership_application_revisions,
  public.payment_obligations,
  public.payment_claims,
  public.payment_claim_audit_events,
  public.contribution_schedules,
  public.contribution_plan_assignments,
  public.contribution_reminder_events,
  public.contribution_reminder_batches,
  public.contribution_reminder_batch_events,
  public.contribution_reminder_delivery_attempts
from public, anon, authenticated;

grant select on table
  public.membership_application_revisions,
  public.payment_obligations,
  public.payment_claims,
  public.payment_claim_audit_events,
  public.contribution_schedules,
  public.contribution_plan_assignments
to authenticated;

revoke all on table public.push_tokens from public, anon, authenticated;
grant select, delete on table public.push_tokens to service_role;

do $$
declare
  function_record record;
begin
  for function_record in
    select
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'apply_payment_settlement_effects',
        'apply_succeeded_payment_effects',
        'approve_initial_claim',
        'approve_recurring_payment_claim',
        'claim_contribution_reminder_batches',
        'claim_contribution_reminder_receipts',
        'claim_initial_payment',
        'claim_recurring_payment',
        'clamped_billing_date',
        'contribution_reminder_backoff',
        'contribution_reminder_delivery_at',
        'contribution_reminder_stage_for_date',
        'enqueue_contribution_reminder_events_at',
        'enqueue_contribution_reminder_events',
        'ensure_contribution_schedule',
        'first_recurring_due_date',
        'generate_membership_billing_obligations_at',
        'generate_membership_billing_obligations',
        'get_billing_workspace_claim_detail',
        'get_billing_workspace_members',
        'get_billing_workspace_organizations',
        'get_billing_workspace_payments',
        'get_billing_workspace_queue',
        'get_initial_payment_claim_detail',
        'get_initial_payment_claim_queue',
        'get_membership_billing_ledger',
        'get_payment_obligation_instructions',
        'is_valid_billing_timezone',
        'next_recurring_due_date',
        'prepare_contribution_reminder_batch',
        'reconcile_legacy_payment_obligations',
        'record_contribution_reminder_receipts',
        'record_contribution_reminder_send_failure',
        'record_contribution_reminder_tickets',
        'recurring_due_date_on_or_after',
        'recurring_period_key',
        'refresh_contribution_reminder_batch',
        'register_push_token',
        'reject_contribution_plan_assignment_mutation',
        'reject_contribution_schedule_anchor_mutation',
        'reject_initial_claim',
        'reject_membership_application_revision_mutation',
        'reject_payment_claim_audit_mutation',
        'reject_payment_claim_evidence_mutation',
        'reject_payment_obligation_context_mutation',
        'reject_recurring_payment_claim',
        'schedule_contribution_plan_change',
        'set_membership_applications_updated_at',
        'snapshot_payment_obligation_context',
        'submit_association_application',
        'sync_contribution_schedule_on_membership',
        'sync_contribution_schedule_on_subscription',
        'unregister_push_token',
        'validate_billing_policy_timezone'
      ])
  loop
    execute format(
      'revoke all on function %I.%I(%s) from public, anon, authenticated, service_role',
      function_record.nspname,
      function_record.proname,
      function_record.identity_arguments
    );
  end loop;
end;
$$;

grant execute on function
  public.approve_initial_claim(uuid),
  public.approve_recurring_payment_claim(uuid),
  public.claim_initial_payment(uuid, boolean, text),
  public.claim_recurring_payment(uuid, boolean, text),
  public.get_billing_workspace_claim_detail(uuid),
  public.get_billing_workspace_members(uuid),
  public.get_billing_workspace_organizations(),
  public.get_billing_workspace_payments(uuid),
  public.get_billing_workspace_queue(uuid),
  public.get_initial_payment_claim_detail(uuid),
  public.get_initial_payment_claim_queue(),
  public.get_membership_billing_ledger(uuid, text, integer),
  public.get_payment_obligation_instructions(uuid),
  public.register_push_token(text, public.language),
  public.reject_initial_claim(uuid, text),
  public.reject_recurring_payment_claim(uuid, text),
  public.schedule_contribution_plan_change(
    uuid,
    date,
    public.subscription_plan_type_enum
  ),
  public.submit_association_application(
    uuid,
    uuid,
    public.subscription_plan_type_enum,
    text,
    bigint
  ),
  public.unregister_push_token(text)
to authenticated;

grant execute on function
  public.claim_contribution_reminder_batches(integer, integer),
  public.claim_contribution_reminder_receipts(integer, integer),
  public.enqueue_contribution_reminder_events(),
  public.generate_membership_billing_obligations(),
  public.prepare_contribution_reminder_batch(uuid, uuid, integer),
  public.reconcile_legacy_payment_obligations(boolean),
  public.record_contribution_reminder_receipts(jsonb),
  public.record_contribution_reminder_send_failure(uuid, uuid, text),
  public.record_contribution_reminder_tickets(uuid, uuid, jsonb),
  public.schedule_contribution_plan_change(
    uuid,
    date,
    public.subscription_plan_type_enum
  )
to service_role;

-- Install the staging/production scheduler contract in a paused state.
-- Deployment activates these jobs only after Edge Functions, Vault secrets,
-- generator dry-run output, and reconciliation dry-run output are reviewed.
do $migration$
declare
  job_record record;
  job_id bigint;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;

  if exists (
    select 1
    from cron.job
    where jobname = 'daily-renewal-check'
  ) then
    perform cron.unschedule('daily-renewal-check');
  end if;

  for job_record in
    select *
    from (
      values
        (
          'membership-billing-obligation-generator',
          '*/15 * * * *',
          $command$
          select net.http_post(
            url := (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'project_url'
            ) || '/functions/v1/generate-renewal-payments',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || (
                select decrypted_secret
                from vault.decrypted_secrets
                where name = 'secret_key'
              )
            ),
            body := '{}'::jsonb
          ) as request_id;
          $command$
        ),
        (
          'contribution-reminder-enqueuer',
          '*/15 * * * *',
          $command$
          select net.http_post(
            url := (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'project_url'
            ) || '/functions/v1/contribution-reminder-enqueuer',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || (
                select decrypted_secret
                from vault.decrypted_secrets
                where name = 'secret_key'
              )
            ),
            body := '{}'::jsonb
          ) as request_id;
          $command$
        ),
        (
          'contribution-reminder-dispatcher',
          '* * * * *',
          $command$
          select net.http_post(
            url := (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'project_url'
            ) || '/functions/v1/contribution-reminder-dispatcher',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || (
                select decrypted_secret
                from vault.decrypted_secrets
                where name = 'secret_key'
              )
            ),
            body := '{}'::jsonb
          ) as request_id;
          $command$
        ),
        (
          'contribution-reminder-receipts',
          '* * * * *',
          $command$
          select net.http_post(
            url := (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'project_url'
            ) || '/functions/v1/contribution-reminder-receipts',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || (
                select decrypted_secret
                from vault.decrypted_secrets
                where name = 'secret_key'
              )
            ),
            body := '{}'::jsonb
          ) as request_id;
          $command$
        )
    ) as jobs(job_name, job_schedule, job_command)
  loop
    select jobid
    into job_id
    from cron.job
    where jobname = job_record.job_name;

    if job_id is null then
      job_id := cron.schedule(
        job_record.job_name,
        job_record.job_schedule,
        job_record.job_command
      );
    end if;

    perform cron.alter_job(
      job_id,
      schedule => job_record.job_schedule,
      command => job_record.job_command,
      active => false
    );

    job_id := null;
  end loop;
end;
$migration$;
