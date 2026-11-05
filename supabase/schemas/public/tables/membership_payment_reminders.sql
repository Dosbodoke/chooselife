CREATE TABLE "public"."membership_payment_reminders" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "organization_id"   uuid                     NOT NULL,
  "recipient_user_id" uuid                     NOT NULL,
  "sent_by_user_id"   uuid,
  "notification_id"   bigint,
  "device_count"      integer                  NOT NULL,
  "created_at"        timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "membership_payment_reminders_device_count_check" CHECK ((device_count >= 0)),
  CONSTRAINT "membership_payment_reminders_pkey" PRIMARY KEY (id),
  CONSTRAINT "membership_payment_reminders_notification_id_fkey" FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE SET NULL,
  CONSTRAINT "membership_payment_reminders_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT "membership_payment_reminders_recipient_user_id_fkey" FOREIGN KEY (recipient_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT "membership_payment_reminders_sent_by_user_id_fkey" FOREIGN KEY (sent_by_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE "public"."membership_payment_reminders"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX membership_payment_reminders_notification_idx ON public.membership_payment_reminders USING btree (notification_id)
  WHERE (notification_id IS NOT NULL);

CREATE INDEX membership_payment_reminders_organization_idx ON public.membership_payment_reminders USING btree (organization_id);

CREATE INDEX membership_payment_reminders_recipient_idx ON public.membership_payment_reminders USING btree (recipient_user_id, organization_id, created_at DESC);

CREATE INDEX membership_payment_reminders_sent_by_idx ON public.membership_payment_reminders USING btree (sent_by_user_id)
  WHERE (sent_by_user_id IS NOT NULL);

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."membership_payment_reminders" TO "service_role";

COMMENT ON TABLE "public"."membership_payment_reminders" IS 'Audit trail of admin-sent payment reminders. Source of the per-person cooldown. Written only by send_membership_payment_reminder.';

REVOKE ALL ON TABLE "public"."membership_payment_reminders" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."membership_payment_reminders" TO "postgres";

REVOKE ALL ON TABLE "public"."membership_payment_reminders" FROM "anon", "authenticated";
