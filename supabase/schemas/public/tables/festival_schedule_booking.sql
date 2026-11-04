CREATE TABLE "public"."festival_schedule_booking" (
  "id"                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "slot_id"                 uuid                     NOT NULL,
  "festival_id"             uuid                     NOT NULL,
  "highline_id"             uuid                     NOT NULL,
  "profile_id"              uuid,
  "instagram_username"      text,
  "display_name"            text,
  "status" public.festival_schedule_booking_status_enum NOT NULL DEFAULT 'booked'::public.festival_schedule_booking_status_enum,
  "cancellation_reason"     text,
  "cancellation_source" public.festival_schedule_booking_cancellation_source_enum,
  "cancelled_by_profile_id" uuid,
  "created_at"              timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "cancelled_at"            timestamp with time zone,
  "completed_at"            timestamp with time zone,
  "booking_source"          text                     NOT NULL DEFAULT 'participant'::text,
  CONSTRAINT "festival_schedule_booking_booking_source_check" CHECK ((booking_source = ANY (ARRAY['participant'::text, 'staff'::text]))),
  CONSTRAINT "festival_schedule_booking_check" CHECK ((((profile_id IS NOT NULL) AND (instagram_username IS NULL)) OR ((profile_id IS NULL) AND (instagram_username IS
    NOT NULL) AND (display_name IS NOT NULL)))),
  CONSTRAINT "festival_schedule_booking_festival_id_fkey" FOREIGN KEY (festival_id) REFERENCES public.festival(id) ON DELETE CASCADE,
  CONSTRAINT "festival_schedule_booking_instagram_username_check"
    CHECK (((instagram_username IS NULL) OR ((instagram_username = lower(btrim(instagram_username))) AND (instagram_username ~~ '@%'::text)))),
  CONSTRAINT "festival_schedule_booking_pkey" PRIMARY KEY (id),
  CONSTRAINT "festival_schedule_booking_slot_id_fkey" FOREIGN KEY (slot_id) REFERENCES public.festival_schedule_slot(id) ON DELETE CASCADE,
  CONSTRAINT "festival_schedule_booking_highline_id_fkey" FOREIGN KEY (highline_id) REFERENCES public.highline(id) ON DELETE CASCADE,
  CONSTRAINT "festival_schedule_booking_cancelled_by_profile_id_fkey" FOREIGN KEY (cancelled_by_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT "festival_schedule_booking_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE "public"."festival_schedule_booking"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."festival_schedule_booking"
  REPLICA IDENTITY FULL;



ALTER TABLE "public"."festival_schedule_booking"
  ADD CONSTRAINT "festival_schedule_booking_check1" CHECK (((status <> 'cancelled'::public.festival_schedule_booking_status_enum) OR (cancellation_reason IS NOT NULL)));

CREATE UNIQUE INDEX festival_schedule_booking_active_slot_unique_idx ON public.festival_schedule_booking USING btree (slot_id)
  WHERE (status = 'booked'::public.festival_schedule_booking_status_enum);

CREATE INDEX festival_schedule_booking_instagram_active_idx ON public.festival_schedule_booking USING btree (festival_id, instagram_username)
  WHERE ((status = 'booked'::public.festival_schedule_booking_status_enum) AND (instagram_username IS NOT NULL));

CREATE INDEX festival_schedule_booking_profile_active_idx ON public.festival_schedule_booking USING btree (festival_id, profile_id)
  WHERE ((status = 'booked'::public.festival_schedule_booking_status_enum) AND (profile_id IS NOT NULL));

CREATE TRIGGER enqueue_festival_companion_after_booking_cancel
  AFTER UPDATE OF status ON public.festival_schedule_booking
  FOR EACH ROW
  WHEN (((old.status = 'booked'::public.festival_schedule_booking_status_enum) AND (new.status = 'cancelled'::public.festival_schedule_booking_status_enum)))
  EXECUTE FUNCTION public.enqueue_festival_companion_after_booking();

CREATE TRIGGER enqueue_festival_companion_after_booking_insert
  AFTER INSERT ON public.festival_schedule_booking
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_festival_companion_after_booking();

CREATE TRIGGER festival_schedule_booking_touch_revision_trigger
  AFTER INSERT OR DELETE OR UPDATE ON public.festival_schedule_booking
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_festival_schedule_revision();

CREATE POLICY "Festival booking reads" ON "public"."festival_schedule_booking"
  FOR SELECT
  TO "authenticated"
  USING (((profile_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.festival_staff festival_staff
  WHERE ((festival_staff.festival_id = festival_schedule_booking.festival_id) AND (festival_staff.profile_id = auth.uid()))))));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_schedule_booking" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_schedule_booking" TO "service_role";

REVOKE ALL ON TABLE "public"."festival_schedule_booking" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_schedule_booking" TO "postgres";
