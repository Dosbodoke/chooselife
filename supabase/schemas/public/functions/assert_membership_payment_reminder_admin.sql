CREATE OR REPLACE FUNCTION public.assert_membership_payment_reminder_admin (
  p_organization_id uuid,
  p_user_id         uuid
)
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if p_organization_id is null or p_user_id is null then
    raise exception 'Organization and person are required.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organizations o
    where o.id = p_organization_id
      and o.organization_type = 'association'::public.organization_type_enum
  ) then
    raise exception 'Association was not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = (select auth.uid())
      and om.role = 'admin'::public.organization_role_enum
  ) then
    raise exception 'You are not authorized to remind people of this association.'
      using errcode = '42501';
  end if;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."assert_membership_payment_reminder_admin"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."assert_membership_payment_reminder_admin"(uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."assert_membership_payment_reminder_admin"(uuid, uuid) FROM PUBLIC, "anon", "authenticated", "service_role";
