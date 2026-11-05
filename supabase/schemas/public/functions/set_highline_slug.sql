CREATE OR REPLACE FUNCTION public.set_highline_slug()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.slug := OLD.slug;
  ELSE
    NEW.slug := public.generate_highline_slug(NEW.name, NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."set_highline_slug"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."set_highline_slug"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_highline_slug"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_highline_slug"() TO "postgres";
