CREATE OR REPLACE FUNCTION public.unregister_push_token (
  p_token text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor_id uuid := (select auth.uid());
  removed_id bigint;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  delete from public.push_tokens
  where token = nullif(btrim(p_token), '')
    and profile_id = actor_id
  returning id into removed_id;

  return removed_id is not null;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."unregister_push_token"(text) TO "authenticated";

COMMENT ON FUNCTION "public"."unregister_push_token"(text) IS 'Removes one device token only when it is owned by the currently authenticated profile.';

REVOKE ALL ON FUNCTION "public"."unregister_push_token"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."unregister_push_token"(text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."unregister_push_token"(text) FROM PUBLIC, "anon", "service_role";
