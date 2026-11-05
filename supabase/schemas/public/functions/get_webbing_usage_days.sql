CREATE OR REPLACE FUNCTION public.get_webbing_usage_days (
  webbing_id_param bigint
)
  RETURNS TABLE (
    usage_days integer,
    rig_count  integer
  )
  LANGUAGE plpgsql
  AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(
      GREATEST(1, EXTRACT(DAY FROM (
        COALESCE(rs.unrigged_at, NOW()) - rs.rig_date
      ))::INTEGER + 1)
    ), 0)::INTEGER as usage_days,
    COUNT(rsw.id)::INTEGER as rig_count
  FROM rig_setup_webbing rsw
  JOIN rig_setup rs ON rs.id = rsw.setup_id
  WHERE rsw.webbing_id = webbing_id_param
    AND (rs.is_rigged = true OR rs.unrigged_at IS NOT NULL);
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_webbing_usage_days"(bigint) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."get_webbing_usage_days"(bigint) TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_webbing_usage_days"(bigint) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_webbing_usage_days"(bigint) TO "postgres";
