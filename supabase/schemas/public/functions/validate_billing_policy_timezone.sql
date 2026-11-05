CREATE OR REPLACE FUNCTION public.validate_billing_policy_timezone()
  RETURNS TRIGGER
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

REVOKE ALL ON FUNCTION "public"."validate_billing_policy_timezone"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_billing_policy_timezone"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."validate_billing_policy_timezone"() FROM PUBLIC, "anon", "authenticated", "service_role";
