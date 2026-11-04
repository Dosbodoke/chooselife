CREATE OR REPLACE FUNCTION public.set_association_person_from_subject()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  subject uuid;
begin
  subject := nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid;
  new.association_person_id := public.resolve_association_person(
    new.organization_id,
    subject
  );

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."set_association_person_from_subject"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_association_person_from_subject"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."set_association_person_from_subject"() FROM PUBLIC, "anon", "authenticated", "service_role";
