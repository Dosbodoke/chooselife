CREATE OR REPLACE FUNCTION public.reject_payment_claim_evidence_mutation()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Payment claim evidence is immutable.'
      using errcode = '55000';
  end if;

  if public.is_person_link_maintenance(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

  if old.id is distinct from new.id
    or old.obligation_id is distinct from new.obligation_id
    or old.organization_id is distinct from new.organization_id
    or old.association_person_id is distinct from new.association_person_id
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

REVOKE ALL ON FUNCTION "public"."reject_payment_claim_evidence_mutation"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."reject_payment_claim_evidence_mutation"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."reject_payment_claim_evidence_mutation"() FROM PUBLIC, "anon", "authenticated", "service_role";
