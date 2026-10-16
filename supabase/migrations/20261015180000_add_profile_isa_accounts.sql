-- Links a Choose Life profile to its International Slackline Association
-- account (isa-users Cognito pool). A link proves the profile owner signed in
-- to ISA, so it can only be written by the `link-isa-account` edge function
-- after it verified the ISA ID token; clients may read and unlink.
create table public.profile_isa_accounts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  isa_id text not null unique check (isa_id ~ '^ISA_[0-9A-F]{8}$'),
  cognito_sub uuid not null unique,
  isa_name text,
  linked_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.profile_isa_accounts is
  'Verified link between a profile and its ISA account. Written only by the link-isa-account edge function.';
comment on column public.profile_isa_accounts.isa_id is
  'ISA member ID as returned by account-api.slacklineinternational.org.';
comment on column public.profile_isa_accounts.cognito_sub is
  'Subject of the ISA Cognito user. Not exposed to clients.';

alter table public.profile_isa_accounts enable row level security;

-- The ISA ID is shown on public profiles as a verification badge.
create policy "ISA links are publicly readable"
  on public.profile_isa_accounts
  for select
  to anon, authenticated
  using (true);

create policy "Users can unlink their own ISA account"
  on public.profile_isa_accounts
  for delete
  to authenticated
  using ((select auth.uid()) = profile_id);

revoke all on table public.profile_isa_accounts from public, anon, authenticated;
grant select (profile_id, isa_id, isa_name, linked_at)
  on table public.profile_isa_accounts to anon, authenticated;
grant delete on table public.profile_isa_accounts to authenticated;
