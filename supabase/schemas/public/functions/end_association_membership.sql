CREATE OR REPLACE FUNCTION public.end_association_membership (
  p_organization_id uuid,
  p_user_id         uuid DEFAULT NULL::uuid,
  p_reason          text DEFAULT NULL::text
)
  RETURNS TABLE (
    departure_id    uuid,
    organization_id uuid,
    user_id         uuid,
    departed_role   public.organization_role_enum,
    departed_at     timestamp with time zone
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor_id uuid := (select auth.uid());
  target_id uuid := coalesce(p_user_id, (select auth.uid()));
  membership public.organization_members%rowtype;
  inserted public.organization_membership_departures%rowtype;
  normalized_reason text;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_organization_id is null then
    raise exception 'Organization is required.' using errcode = '22023';
  end if;

  normalized_reason := nullif(
    btrim(regexp_replace(coalesce(p_reason, ''), '\s+', ' ', 'g')),
    ''
  );

  if normalized_reason is not null and char_length(normalized_reason) > 500 then
    raise exception 'The reason is too long.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organizations o
    where o.id = p_organization_id
      and o.organization_type = 'association'::public.organization_type_enum
  ) then
    raise exception 'Association was not found.' using errcode = 'P0002';
  end if;

  -- Ending a membership is an admin action, whoever the member is. A member
  -- cannot end their own membership from the app.
  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = actor_id
      and om.role = 'admin'::public.organization_role_enum
  ) then
    raise exception 'You are not authorized to end this membership.'
      using errcode = '42501';
  end if;

  select * into membership
  from public.organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = target_id
  for update;

  if not found then
    raise exception 'This person is not a current member of the association.'
      using errcode = 'P0002';
  end if;

  insert into public.organization_membership_departures (
    organization_id,
    user_id,
    departed_role,
    joined_at,
    actor_user_id,
    reason
  )
  values (
    p_organization_id,
    target_id,
    membership.role,
    membership.joined_at,
    actor_id,
    normalized_reason
  )
  returning * into inserted;

  delete from public.organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = target_id;

  -- Stops generate_membership_billing_obligations from minting new periods.
  -- The schedule is kept, deactivated, so its obligations stay readable and so
  -- a rejoin opens a fresh schedule instead of reviving this anchor.
  update public.contribution_schedules cs
  set active = false
  where cs.organization_id = p_organization_id
    and cs.user_id = target_id
    and cs.active;

  return query
  select
    inserted.id,
    inserted.organization_id,
    inserted.user_id,
    inserted.departed_role,
    inserted.departed_at;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."end_association_membership"(uuid, uuid, text) TO "authenticated";

COMMENT ON FUNCTION "public"."end_association_membership"(uuid, uuid, text) IS 'Ends one current association membership, journalling it as an immutable membership period and deactivating the contribution schedule. Callable only by an association admin, who may end their own membership. Existing obligations stay owed.';

REVOKE ALL ON FUNCTION "public"."end_association_membership"(uuid, uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."end_association_membership"(uuid, uuid, text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."end_association_membership"(uuid, uuid, text) FROM PUBLIC, "anon", "service_role";
