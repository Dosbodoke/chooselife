CREATE OR REPLACE FUNCTION public.register_push_token (
  p_token    text,
  p_language public.language DEFAULT NULL::public.language
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor_id uuid := (select auth.uid());
  normalized_token text := nullif(btrim(p_token), '');
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if normalized_token is null or char_length(normalized_token) > 512 then
    raise exception 'A valid push token is required.' using errcode = '22023';
  end if;

  insert into public.push_tokens (token, profile_id, language, created_at)
  values (normalized_token, actor_id, p_language, clock_timestamp())
  on conflict (token) do update
  set
    profile_id = excluded.profile_id,
    language = excluded.language,
    created_at = clock_timestamp();

  return 'registered';
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."register_push_token"(text, public.language) TO "authenticated";

COMMENT ON FUNCTION "public"."register_push_token"(text, public.language) IS 'Associates one device token with the currently authenticated profile, replacing a previous owner for account switching.';

REVOKE ALL ON FUNCTION "public"."register_push_token"(text, public.language) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."register_push_token"(text, public.language) TO "postgres";

REVOKE ALL ON FUNCTION "public"."register_push_token"(text, public.language) FROM PUBLIC, "anon", "service_role";
