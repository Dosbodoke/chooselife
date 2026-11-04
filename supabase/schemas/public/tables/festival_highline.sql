CREATE TABLE "public"."festival_highline" (
  "festival_id"           uuid                     NOT NULL,
  "highline_id"           uuid                     NOT NULL,
  "sort_order"            integer                  NOT NULL DEFAULT 0,
  "slot_duration_minutes" integer                  NOT NULL DEFAULT 45,
  "created_at"            timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "festival_highline_festival_id_fkey" FOREIGN KEY (festival_id) REFERENCES public.festival(id) ON DELETE CASCADE,
  CONSTRAINT "festival_highline_pkey" PRIMARY KEY (festival_id, highline_id),
  CONSTRAINT "festival_highline_slot_duration_minutes_check" CHECK ((slot_duration_minutes > 0)),
  CONSTRAINT "festival_highline_highline_id_fkey" FOREIGN KEY (highline_id) REFERENCES public.highline(id) ON DELETE CASCADE
);

ALTER TABLE "public"."festival_highline"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX festival_highline_sort_order_idx ON public.festival_highline USING btree (festival_id, sort_order, highline_id);

CREATE TRIGGER festival_highline_duration_regenerate_trigger
  AFTER UPDATE OF slot_duration_minutes ON public.festival_highline
  FOR EACH ROW
  WHEN ((old.slot_duration_minutes IS DISTINCT FROM new.slot_duration_minutes))
  EXECUTE FUNCTION public.handle_festival_highline_duration_change();

CREATE POLICY "Festival highlines are viewable by everyone." ON "public"."festival_highline"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_highline" TO "anon", "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_highline" TO "service_role";

REVOKE ALL ON TABLE "public"."festival_highline" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."festival_highline" TO "postgres";
