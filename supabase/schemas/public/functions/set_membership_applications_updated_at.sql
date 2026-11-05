CREATE OR REPLACE FUNCTION public.set_membership_applications_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
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

REVOKE ALL ON FUNCTION "public"."set_membership_applications_updated_at"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_membership_applications_updated_at"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."set_membership_applications_updated_at"() FROM PUBLIC, "anon", "authenticated", "service_role";
