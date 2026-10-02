create table public.choosen_course_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.choosen_course_entitlements enable row level security;

create policy "Users can read their own course entitlement"
  on public.choosen_course_entitlements
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.choosen_course_entitlements from public, anon, authenticated;
grant select on table public.choosen_course_entitlements to authenticated;
