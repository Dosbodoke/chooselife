CREATE OR REPLACE FUNCTION public.set_association_person_from_obligation()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if new.association_person_id is not null then
    return new;
  end if;

  select po.association_person_id
  into new.association_person_id
  from public.payment_obligations po
  where po.id = new.obligation_id;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."set_association_person_from_obligation"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_association_person_from_obligation"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."set_association_person_from_obligation"() FROM PUBLIC, "anon", "authenticated", "service_role";
