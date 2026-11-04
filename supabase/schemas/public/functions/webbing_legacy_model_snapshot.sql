CREATE OR REPLACE FUNCTION public.webbing_legacy_model_snapshot (
  model_id    bigint,
  captured_by text
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'schemaVersion', 1,
    'source', 'chooselife',
    'modelId', m.id,
    'name', m.name,
    'material', m.material::text,
    'weave', m.weave::text,
    'strengthClass', m.strength_class::text,
    'recommendedLifetimeDays', m.recommended_lifetime_days,
    'imagePath', m.image_url,
    'capturedAt', to_jsonb(now()),
    'capturedBy', captured_by
  ))
  FROM public.webbing_model AS m
  WHERE m.id = model_id;
$function$;

GRANT EXECUTE ON FUNCTION "public"."webbing_legacy_model_snapshot"(bigint, text) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."webbing_legacy_model_snapshot"(bigint, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."webbing_legacy_model_snapshot"(bigint, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."webbing_legacy_model_snapshot"(bigint, text) TO "postgres";
