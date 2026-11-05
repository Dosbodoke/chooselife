CREATE OR REPLACE FUNCTION public.get_billing_workspace_organizations()
  RETURNS TABLE (
    organization_id   uuid,
    organization_name text,
    organization_slug text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION "public"."get_billing_workspace_organizations"() TO "authenticated";

COMMENT ON FUNCTION "public"."get_billing_workspace_organizations"() IS 'Returns the associations where the signed-in person may open the billing workspace.';

REVOKE ALL ON FUNCTION "public"."get_billing_workspace_organizations"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_billing_workspace_organizations"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_billing_workspace_organizations"() FROM PUBLIC, "anon", "service_role";
