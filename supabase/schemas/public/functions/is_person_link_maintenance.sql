CREATE OR REPLACE FUNCTION public.is_person_link_maintenance (
  p_old jsonb,
  p_new jsonb
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select coalesce(
    bool_and(
      case changed.key
        -- A deleted Choose Life account arrives here as ON DELETE SET NULL.
        when 'user_id' then jsonb_typeof(p_new -> 'user_id') = 'null'
        when 'actor_user_id' then jsonb_typeof(p_new -> 'actor_user_id') = 'null'
        when 'claimant_user_id' then jsonb_typeof(p_new -> 'claimant_user_id') = 'null'
        -- The subject link is filled in once, on rows that predate the column.
        -- It can be populated but never repointed.
        when 'association_person_id' then
          jsonb_typeof(p_old -> 'association_person_id') = 'null'
          and jsonb_typeof(p_new -> 'association_person_id') <> 'null'
        else false
      end
    ),
    false
  )
  from (
    select o.key
    from jsonb_each(p_old) o
    where o.value is distinct from (p_new -> o.key)
  ) changed;
$function$;

COMMENT ON FUNCTION "public"."is_person_link_maintenance"(jsonb, jsonb) IS 'True when an update changes nothing except the links between a formal record and its people: an account reference set to null (the shape a deleted Choose Life account produces through ON DELETE SET NULL), or the subject reference populated for the first time. Neither alters what a person attested to or what an admin decided, so the immutability guards allow exactly these and nothing else.';

REVOKE ALL ON FUNCTION "public"."is_person_link_maintenance"(jsonb, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_person_link_maintenance"(jsonb, jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "public"."is_person_link_maintenance"(jsonb, jsonb) FROM PUBLIC, "anon", "authenticated", "service_role";
