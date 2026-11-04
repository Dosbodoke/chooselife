CREATE OR REPLACE FUNCTION public.waive_recurring_contributions (
  p_organization_id uuid,
  p_user_id         uuid,
  p_obligation_ids  uuid[],
  p_reason          text
)
  RETURNS TABLE (
    obligation_id     uuid,
    waiver_id         uuid,
    period_key        text,
    due_on            date,
    amount            integer,
    currency          text,
    reason            text,
    waived_at         timestamp with time zone,
    waived_by_user_id uuid,
    waived_now        boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor_id uuid := (select auth.uid());
  organization_timezone text;
  selected_ids uuid[];
  normalized_reason text := nullif(
    btrim(regexp_replace(coalesce(p_reason, ''), '\s+', ' ', 'g')),
    ''
  );
  locked_count integer;
  obligation_record record;
  to_waive uuid[] := '{}';
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_organization_id is null or p_user_id is null then
    raise exception 'Organization and person are required.' using errcode = '22023';
  end if;

  if p_obligation_ids is null or array_position(p_obligation_ids, null) is not null then
    raise exception 'Select the contributions to waive.'
      using errcode = '22023', hint = 'invalid_selection';
  end if;

  -- The same month sent twice is still one month.
  select coalesce(array_agg(distinct selected.id order by selected.id), '{}')
  into selected_ids
  from unnest(p_obligation_ids) as selected(id);

  if cardinality(selected_ids) = 0 then
    raise exception 'Select the contributions to waive.'
      using errcode = '22023', hint = 'invalid_selection';
  end if;

  -- Five years of monthly charges. Anything larger is a mistake, not arrears.
  if cardinality(selected_ids) > 60 then
    raise exception 'Waive at most 60 contributions at a time.'
      using errcode = '22023', hint = 'invalid_selection';
  end if;

  if normalized_reason is null then
    raise exception 'A reason is required to waive contributions.'
      using errcode = '22023', hint = 'reason_required';
  end if;

  if char_length(normalized_reason) > 500 then
    raise exception 'The reason must be 500 characters or fewer.'
      using errcode = '22023', hint = 'reason_too_long';
  end if;

  select o.billing_timezone
  into organization_timezone
  from public.organizations o
  where o.id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum;

  if not found then
    raise exception 'Association was not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = actor_id
      and om.role = 'admin'::public.organization_role_enum
  ) then
    raise exception 'You are not authorized to waive contributions of this association.'
      using errcode = '42501';
  end if;

  -- Lock in id order, and only rows of this person in this association, so
  -- two admins waiving overlapping months queue rather than deadlock.
  perform 1
  from public.payment_obligations po
  where po.id = any(selected_ids)
    and po.organization_id = p_organization_id
    and po.user_id = p_user_id
  order by po.id
  for update;

  get diagnostics locked_count = row_count;

  if locked_count <> cardinality(selected_ids) then
    raise exception 'Some selected contributions do not belong to this person.'
      using errcode = '22023', hint = 'invalid_selection';
  end if;

  for obligation_record in
    select
      po.id,
      po.purpose,
      po.status,
      po.due_on,
      timezone(
        coalesce(po.billing_timezone, organization_timezone),
        clock_timestamp()
      )::date as local_today,
      exists (
        select 1
        from public.payment_obligation_waivers w
        where w.obligation_id = po.id
      ) as already_waived,
      -- Read, not locked: claim and decision commands take the obligation
      -- lock before committing a claim change, and this transaction holds it.
      exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      ) as has_claim_under_review
    from public.payment_obligations po
    where po.id = any(selected_ids)
    order by po.id
  loop
    if obligation_record.already_waived then
      continue;
    end if;

    if obligation_record.has_claim_under_review then
      raise exception 'A selected contribution has a payment under review. Decide it first.'
        using errcode = '40001', hint = 'under_review';
    end if;

    if obligation_record.purpose <> 'recurring'::public.payment_obligation_purpose_enum
      or obligation_record.status <> 'available'::public.payment_obligation_status_enum
      or obligation_record.due_on is null
      or obligation_record.due_on >= obligation_record.local_today then
      raise exception 'A selected contribution can no longer be waived. Refresh and review again.'
        using errcode = '40001', hint = 'not_waivable';
    end if;

    to_waive := to_waive || obligation_record.id;
  end loop;

  if cardinality(to_waive) > 0 then
    update public.payment_obligations po
    set status = 'void'::public.payment_obligation_status_enum
    where po.id = any(to_waive);

    insert into public.payment_obligation_waivers (
      obligation_id,
      organization_id,
      actor_user_id,
      reason
    )
    select waived.id, p_organization_id, actor_id, normalized_reason
    from unnest(to_waive) as waived(id);
  end if;

  return query
  select
    po.id,
    w.id,
    po.period_key,
    po.due_on,
    po.amount,
    po.currency,
    w.reason,
    w.created_at,
    w.actor_user_id,
    po.id = any(to_waive)
  from public.payment_obligations po
  join public.payment_obligation_waivers w on w.obligation_id = po.id
  where po.id = any(selected_ids)
  order by po.due_on asc, po.id asc;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."waive_recurring_contributions"(uuid, uuid, uuid[], text) TO "authenticated";

COMMENT ON FUNCTION "public"."waive_recurring_contributions"(uuid, uuid, uuid[], text) IS 'Association admins only. Waives selected overdue recurring contributions of one person with a reason: the obligations become void, are never marked paid, and are not regenerated. All or nothing; a repeat returns the existing waiver.';

REVOKE ALL ON FUNCTION "public"."waive_recurring_contributions"(uuid, uuid, uuid[], text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."waive_recurring_contributions"(uuid, uuid, uuid[], text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."waive_recurring_contributions"(uuid, uuid, uuid[], text) FROM PUBLIC, "anon", "service_role";
