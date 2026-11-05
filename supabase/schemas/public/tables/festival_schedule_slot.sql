CREATE TABLE "public"."festival_schedule_slot" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "festival_id"  uuid                     NOT NULL,
  "highline_id"  uuid                     NOT NULL,
  "window_id"    uuid                     NOT NULL,
  "start_at"     timestamp with time zone NOT NULL,
  "end_at"       timestamp with time zone NOT NULL,
  "status" public.festival_schedule_slot_status_enum NOT NULL DEFAULT 'available'::public.festival_schedule_slot_status_enum,
  "block_reason" text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "festival_schedule_slot_check" CHECK ((end_at > start_at)),
  CONSTRAINT "festival_schedule_slot_festival_id_fkey" FOREIGN KEY (festival_id) REFERENCES public.festival(id) ON DELETE CASCADE,
  CONSTRAINT "festival_schedule_slot_festival_id_highline_id_fkey" FOREIGN KEY (festival_id, highline_id) REFERENCES public.festival_highline(festival_id, highline_id)
    ON DELETE CASCADE,
  CONSTRAINT "festival_schedule_slot_pkey" PRIMARY KEY (id),
  CONSTRAINT "festival_schedule_slot_window_id_fkey" FOREIGN KEY (window_id) REFERENCES public.festival_schedule_window(id) ON DELETE CASCADE,
  CONSTRAINT "festival_schedule_slot_highline_id_fkey" FOREIGN KEY (highline_id) REFERENCES public.highline(id) ON DELETE CASCADE
);

ALTER TABLE "public"."festival_schedule_slot"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."festival_schedule_slot"
  REPLICA IDENTITY FULL;


ALTER TABLE "public"."festival_schedule_slot"
  ADD CONSTRAINT "festival_schedule_slot_check1" CHECK (((status <> 'blocked'::public.festival_schedule_slot_status_enum) OR (block_reason IS NOT NULL)));

CREATE INDEX festival_schedule_slot_lookup_idx ON public.festival_schedule_slot USING btree (festival_id, highline_id, start_at);

CREATE UNIQUE INDEX festival_schedule_slot_unique_start_idx ON public.festival_schedule_slot USING btree (festival_id, highline_id, start_at);

CREATE TRIGGER festival_schedule_slot_blocked_trigger
  AFTER INSERT OR UPDATE OF status, block_reason ON public.festival_schedule_slot
  FOR EACH ROW
  WHEN ((new.status = 'blocked'::public.festival_schedule_slot_status_enum))
  EXECUTE FUNCTION public.handle_blocked_festival_schedule_slot();

CREATE POLICY "Festival schedule slots are viewable by everyone." ON "public"."festival_schedule_slot"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_schedule_slot" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_schedule_slot" TO "service_role";

REVOKE ALL ON TABLE "public"."festival_schedule_slot" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_schedule_slot" TO "postgres";
