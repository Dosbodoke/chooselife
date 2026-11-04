CREATE OR REPLACE FUNCTION public.highlines_in_view (
  min_lat  double precision,
  min_long double precision,
  max_lat  double precision,
  max_long double precision
)
  RETURNS TABLE (
    id            uuid,
    name          text,
    anchor_a_lat  double precision,
    anchor_a_long double precision,
    anchor_b_lat  double precision,
    anchor_b_long double precision
  )
  LANGUAGE sql
  AS $function$
	select id, name, st_y(anchor_a::geometry) as anchor_a_lat, st_x(anchor_a::geometry) as anchor_b_long, st_y(anchor_b::geometry) as anchor_b_lat, st_x(anchor_b::geometry) as anchor_b_long
	from public.highline
	where anchor_a && ST_SetSRID(ST_MakeBox2D(ST_Point(min_long, min_lat), ST_Point(max_long, max_lat)), 4326)
$function$;

GRANT EXECUTE ON FUNCTION "public"."highlines_in_view"(double precision, double precision, double precision, double precision) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."highlines_in_view"(double precision, double precision, double precision, double precision) TO "service_role";

REVOKE ALL ON FUNCTION "public"."highlines_in_view"(double precision, double precision, double precision, double precision) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."highlines_in_view"(double precision, double precision, double precision, double precision) TO "postgres";
