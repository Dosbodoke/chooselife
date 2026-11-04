CREATE OR REPLACE FUNCTION public.generate_highline_slug (
  highline_name text,
  highline_id   uuid
)
  RETURNS text
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
DECLARE
  base text;
  candidate text;
  suffix integer := 1;
BEGIN
  base := trim(BOTH '-' FROM left(coalesce(public.slugify(highline_name), ''), 80));
  IF base = '' THEN
    base := 'highline';
  END IF;

  candidate := base;
  WHILE EXISTS (
    SELECT 1
    FROM public.highline h
    WHERE h.slug = candidate
      AND h.id IS DISTINCT FROM highline_id
  ) LOOP
    suffix := suffix + 1;
    candidate := base || '-' || suffix;
  END LOOP;

  RETURN candidate;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."generate_highline_slug"(text, uuid) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."generate_highline_slug"(text, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."generate_highline_slug"(text, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."generate_highline_slug"(text, uuid) TO "postgres";
