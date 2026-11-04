CREATE OR REPLACE FUNCTION public.get_billing_workspace_waivers (
  p_organization_id uuid
)
  RETURNS TABLE (
    obligation_id     uuid,
    member_user_id    uuid,
    reason            text,
    waived_at         timestamp with time zone,
    waived_by_user_id uuid,
    waived_by_name    text,
    waived_by_handle  text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    w.obligation_id,
    po.user_id,
    w.reason,
    w.created_at,
    w.actor_user_id,
    actor_profile.name::text,
    actor_profile.username::text
  from public.payment_obligation_waivers w
  join public.payment_obligations po on po.id = w.obligation_id
  join public.organizations o on o.id = w.organization_id
  left join public.profiles actor_profile on actor_profile.id = w.actor_user_id
  where p_organization_id is not null
    and w.organization_id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = w.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    )
  order by w.created_at desc, w.id desc;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_billing_workspace_waivers"(uuid) TO "authenticated";

COMMENT ON FUNCTION "public"."get_billing_workspace_waivers"(uuid) IS 'Association admins only. Lists waived recurring contributions with reason, time and actor. Returns nothing to anybody else.';

REVOKE ALL ON FUNCTION "public"."get_billing_workspace_waivers"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_billing_workspace_waivers"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_billing_workspace_waivers"(uuid) FROM PUBLIC, "anon", "service_role";
