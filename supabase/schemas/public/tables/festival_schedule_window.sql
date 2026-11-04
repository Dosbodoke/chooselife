CREATE TABLE "public"."festival_schedule_window" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "festival_id"         uuid                     NOT NULL,
  "highline_id"         uuid                     NOT NULL,
  "scheduling_opens_at" timestamp with time zone NOT NULL,
  "window_start_at"     timestamp with time zone NOT NULL,
  "window_end_at"       timestamp with time zone NOT NULL,
  "created_at"          timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "festival_schedule_window_check1" CHECK ((scheduling_opens_at < window_end_at)),
  CONSTRAINT "festival_schedule_window_check" CHECK ((window_end_at > window_start_at)),
  CONSTRAINT "festival_schedule_window_festival_id_fkey" FOREIGN KEY (festival_id) REFERENCES public.festival(id) ON DELETE CASCADE,
  CONSTRAINT "festival_schedule_window_festival_id_highline_id_fkey" FOREIGN KEY (festival_id, highline_id) REFERENCES public.festival_highline(festival_id, highline_id)
    ON DELETE CASCADE,
  CONSTRAINT "festival_schedule_window_pkey" PRIMARY KEY (id),
  CONSTRAINT "festival_schedule_window_scheduling_opens_at_check"
    CHECK (((EXTRACT(second FROM scheduling_opens_at) = (0)::numeric) AND (EXTRACT(minute FROM scheduling_opens_at) = ANY (ARRAY[(0)::numeric, (30)::numeric])))),
  CONSTRAINT "festival_schedule_window_highline_id_fkey" FOREIGN KEY (highline_id) REFERENCES public.highline(id) ON DELETE CASCADE
);

ALTER TABLE "public"."festival_schedule_window"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."festival_schedule_window"
  REPLICA IDENTITY FULL;

CREATE INDEX festival_schedule_window_lookup_idx ON public.festival_schedule_window USING btree (festival_id, highline_id, window_start_at);

CREATE INDEX festival_schedule_window_opens_at_idx ON public.festival_schedule_window USING btree (scheduling_opens_at);

CREATE UNIQUE INDEX festival_schedule_window_unique_idx ON public.festival_schedule_window USING btree (festival_id, highline_id, window_start_at);

CREATE TRIGGER festival_schedule_window_regenerate_trigger
  AFTER INSERT OR UPDATE OF window_start_at, window_end_at ON public.festival_schedule_window
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_festival_schedule_window_change();

CREATE POLICY "Festival schedule windows are viewable by everyone." ON "public"."festival_schedule_window"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_schedule_window" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_schedule_window" TO "service_role";

REVOKE ALL ON TABLE "public"."festival_schedule_window" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_schedule_window" TO "postgres";
