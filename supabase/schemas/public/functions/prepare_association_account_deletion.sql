CREATE OR REPLACE FUNCTION public.prepare_association_account_deletion (
  p_user_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  person_record public.association_people%rowtype;
  membership public.organization_members%rowtype;
begin
  if p_user_id is null then
    raise exception 'A person is required.' using errcode = '22023';
  end if;

  for person_record in
    select ap.*
    from public.association_people ap
    where ap.account_user_id = p_user_id
    order by ap.id
    for update
  loop
    select om.*
    into membership
    from public.organization_members om
    where om.organization_id = person_record.organization_id
      and om.user_id = p_user_id
    for update;

    if found then
      insert into public.organization_membership_departures (
        organization_id,
        association_person_id,
        user_id,
        departed_role,
        joined_at,
        actor_user_id,
        reason
      )
      values (
        person_record.organization_id,
        person_record.id,
        p_user_id,
        membership.role,
        membership.joined_at,
        null,
        'Account deleted.'
      )
      on conflict (organization_id, association_person_id, joined_at) do nothing;

      delete from public.organization_members om
      where om.organization_id = person_record.organization_id
        and om.user_id = p_user_id;
    end if;

    update public.contribution_schedules cs
    set active = false
    where cs.association_person_id = person_record.id
      and cs.active;

    update public.association_people ap
    set
      account_user_id = null,
      anonymized_at = timezone('utc'::text, clock_timestamp())
    where ap.id = person_record.id;
  end loop;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."prepare_association_account_deletion"(uuid) TO "service_role";

COMMENT ON FUNCTION "public"."prepare_association_account_deletion"(uuid) IS 'Prepares one Choose Life account for deletion: journals any still-active association membership as a closure, removes the membership authorization, deactivates the contribution schedules, and severs the account link so only association admins retain access. Deletes no formal record. Service role only.';

REVOKE ALL ON FUNCTION "public"."prepare_association_account_deletion"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."prepare_association_account_deletion"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."prepare_association_account_deletion"(uuid) FROM PUBLIC, "anon", "authenticated";
