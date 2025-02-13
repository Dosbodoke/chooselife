drop policy "Anyone can read rig_setup" on "public"."rig_setup";

drop policy "Anyone can read rig_setup_webbing" on "public"."rig_setup_webbing";

alter table "public"."profiles" add column "deletion_requested" timestamp with time zone;

create policy "Anyone can read rig_setup"
on "public"."rig_setup"
as permissive
for select
to authenticated, anon
using (true);


create policy "Anyone can read rig_setup_webbing"
on "public"."rig_setup_webbing"
as permissive
for select
to authenticated, anon
using (true);