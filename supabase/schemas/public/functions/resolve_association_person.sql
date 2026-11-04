CREATE OR REPLACE FUNCTION public.resolve_association_person (
  p_organization_id uuid,
  p_user_id         uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  resolved uuid;
begin
  if p_organization_id is null or p_user_id is null then
    return null;
  end if;

  select ap.id
  into resolved
  from public.association_people ap
  where ap.organization_id = p_organization_id
    and ap.account_user_id = p_user_id;

  if resolved is not null then
    return resolved;
  end if;

  insert into public.association_people (organization_id, account_user_id)
  values (p_organization_id, p_user_id)
  on conflict (organization_id, account_user_id)
    where account_user_id is not null
    do nothing
  returning id into resolved;

  if resolved is null then
    select ap.id
    into resolved
    from public.association_people ap
    where ap.organization_id = p_organization_id
      and ap.account_user_id = p_user_id;
  end if;

  return resolved;
end;
$function$;

COMMENT ON FUNCTION "public"."resolve_association_person"(uuid, uuid) IS 'Returns the formal association subject for one account in one organization, creating it on first use.';

REVOKE ALL ON FUNCTION "public"."resolve_association_person"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."resolve_association_person"(uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."resolve_association_person"(uuid, uuid) FROM PUBLIC, "anon", "authenticated", "service_role";
