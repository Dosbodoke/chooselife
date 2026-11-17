-- Stop clients from writing notifications (GHSA-cx5h-mg45-2544).
--
-- Every insert fires the push-notification Edge Function, and a row with no
-- user_id is broadcast to every registered device, so "Anyone can insert"
-- let anyone holding the public anon key push arbitrary text to all users.
-- Notifications are created by security-definer functions and by server code
-- with the service role, neither of which needs a client grant.
--
-- Reads are narrowed too: broadcasts (which every device receives anyway) and
-- the caller's own notifications, instead of everyone's.

REVOKE ALL ON SEQUENCE "public"."notifications_id_seq" FROM "anon";

REVOKE ALL ON SEQUENCE "public"."notifications_id_seq" FROM "authenticated";

DROP POLICY "Anyone can insert notifications" ON "public"."notifications";

DROP POLICY "Anyone can read notifications" ON "public"."notifications";

CREATE POLICY "Read broadcasts and own notifications" ON "public"."notifications"
  FOR SELECT
  TO "anon", "authenticated"
  USING (((user_id IS NULL) OR (user_id = ( SELECT auth.uid() AS uid))));

REVOKE ALL ON TABLE "public"."notifications" FROM "anon";

GRANT SELECT ON TABLE "public"."notifications" TO "anon";

REVOKE ALL ON TABLE "public"."notifications" FROM "authenticated";

GRANT SELECT ON TABLE "public"."notifications" TO "authenticated";
