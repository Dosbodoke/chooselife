CREATE OR REPLACE FUNCTION public.unregister_festival_companion_installation (
  installation_id_input uuid
)
  RETURNS void
  LANGUAGE sql
  SET search_path TO 'public'
  AS $function$
  DELETE FROM public.festival_companion_tokens
  WHERE profile_id = auth.uid()
    AND installation_id = installation_id_input;
$function$;

GRANT EXECUTE ON FUNCTION "public"."unregister_festival_companion_installation"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."unregister_festival_companion_installation"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."unregister_festival_companion_installation"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."unregister_festival_companion_installation"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."unregister_festival_companion_installation"(uuid) FROM PUBLIC, "anon";
