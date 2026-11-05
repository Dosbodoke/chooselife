CREATE OR REPLACE FUNCTION public.get_membership_payment_reminder_preview (
  p_organization_id uuid,
  p_user_id         uuid
)
  RETURNS TABLE (
    recipient_user_id  uuid,
    recipient_name     text,
    recipient_handle   text,
    recipient_language public.language,
    device_count       integer,
    open_count         integer,
    overdue_count      integer,
    oldest_due_on      date,
    last_sent_at       timestamp with time zone,
    next_available_at  timestamp with time zone,
    title              jsonb,
    body               jsonb,
    blocked_reason     text
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.assert_membership_payment_reminder_admin(
    p_organization_id,
    p_user_id
  );

  return query
  select
    p_user_id,
    state.recipient_name,
    state.recipient_handle,
    state.recipient_language,
    state.device_count,
    state.open_count,
    state.overdue_count,
    state.oldest_due_on,
    state.last_sent_at,
    state.next_available_at,
    state.title,
    state.body,
    state.blocked_reason
  from public.membership_payment_reminder_state(
    p_organization_id,
    p_user_id
  ) state;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_membership_payment_reminder_preview"(uuid, uuid) TO "authenticated";

COMMENT ON FUNCTION "public"."get_membership_payment_reminder_preview"(uuid, uuid) IS 'Association admins only. Shows the recipient, device count, localized wording and any reason a payment reminder cannot be sent now. Sends nothing.';

REVOKE ALL ON FUNCTION "public"."get_membership_payment_reminder_preview"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_membership_payment_reminder_preview"(uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_membership_payment_reminder_preview"(uuid, uuid) FROM PUBLIC, "anon", "service_role";
