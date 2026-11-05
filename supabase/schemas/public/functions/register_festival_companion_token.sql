CREATE OR REPLACE FUNCTION public.register_festival_companion_token (
  installation_id_input uuid,
  token_type_input      text,
  activity_name_input   text,
  token_input           text,
  language_input        public.language
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  actor_profile_id UUID := auth.uid();
BEGIN
  IF actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF token_type_input NOT IN ('push_to_start', 'activity_update') THEN
    RAISE EXCEPTION 'Unsupported festival companion token type';
  END IF;

  IF nullif(btrim(token_input), '') IS NULL THEN
    RAISE EXCEPTION 'Festival companion token is required';
  END IF;

  DELETE FROM public.festival_companion_tokens
  WHERE token = token_input
    OR (
      profile_id = actor_profile_id
      AND installation_id = installation_id_input
      AND token_type = token_type_input
      AND activity_name = coalesce(activity_name_input, '')
    );

  INSERT INTO public.festival_companion_tokens (
    profile_id,
    installation_id,
    token_type,
    activity_name,
    token,
    language,
    updated_at
  )
  VALUES (
    actor_profile_id,
    installation_id_input,
    token_type_input,
    coalesce(activity_name_input, ''),
    btrim(token_input),
    language_input,
    timezone('utc'::text, now())
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."register_festival_companion_token"(uuid, text, text, text, public.language) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."register_festival_companion_token"(uuid, text, text, text, public.language) TO "service_role";

REVOKE ALL ON FUNCTION "public"."register_festival_companion_token"(uuid, text, text, text, public.language) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."register_festival_companion_token"(uuid, text, text, text, public.language) TO "postgres";

REVOKE ALL ON FUNCTION "public"."register_festival_companion_token"(uuid, text, text, text, public.language) FROM PUBLIC, "anon";
