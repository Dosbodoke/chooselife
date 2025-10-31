-- Create a custom type for user roles within an organization
create type public.organization_role as enum ('owner', 'admin', 'member');

-- Create organizations table
create table public.organizations (
    id uuid not null default gen_random_uuid() primary key,
    name text not null,
    owner_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamp with time zone not null default timezone('utc'::text, now())
    price_amount integer not null,
);
comment on table public.organizations is 'Stores information about each team or association.';

-- Create organization_members table
create table public.organization_members (
    organization_id uuid not null references public.organizations(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role public.organization_role not null default 'member',
    joined_at timestamp with time zone not null default timezone('utc'::text, now()),
    primary key (organization_id, user_id)
);
comment on table public.organization_members is 'Join table to link users to organizations with specific roles.';

-- Create subscriptions table
create table public.subscriptions (
    id uuid not null default gen_random_uuid() primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    status text not null default 'pending_payment',
    current_period_end timestamp with time zone,
    abacate_pay_charge_id text,
    unique (user_id, organization_id)
);
comment on table public.subscriptions is 'Tracks the status of each member''s subscription to an organization.';

-- Create payments table
create table public.payments (
    id uuid not null default gen_random_uuid() primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    subscription_id uuid not null references public.subscriptions(id) on delete cascade,
    amount integer not null,
    currency text not null,
    status text not null,
    paid_at timestamp with time zone not null default timezone('utc'::text, now()),
    abacate_pay_charge_id text not null unique
);
comment on table public.payments is 'Stores a historical record of all payments.';
comment on column public.payments.amount is 'Amount in the smallest currency unit (e.g., cents).';

-- Automatically create a member entry for the organization owner
create function public.handle_new_organization()
returns trigger as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_organization_created
  after insert on public.organizations
  for each row execute procedure public.handle_new_organization();

-- Enable Row Level Security (RLS)
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

-- RLS POLICIES --

-- Policies for organizations
create policy "Users can view organizations they are a member of."
on public.organizations for select
using (
  exists (
    select 1 from public.organization_members
    where organization_members.organization_id = organizations.id
      and organization_members.user_id = auth.uid()
  )
);

create policy "Owners can manage their own organization."
on public.organizations for all
using ( auth.uid() = owner_id )
with check ( auth.uid() = owner_id );

-- Policies for organization_members
create policy "Users can view their own membership and other members of their orgs."
on public.organization_members for select
using (
  exists (
    select 1 from public.organization_members as m
    where m.organization_id = organization_members.organization_id
      and m.user_id = auth.uid()
  )
);

create policy "Admins or owners can add/remove/update members."
on public.organization_members for all
using (
  exists (
    select 1 from public.organization_members as m
    where m.organization_id = organization_members.organization_id
      and m.user_id = auth.uid()
      and (m.role = 'admin' or m.role = 'owner')
  )
);

create policy "Members can leave an organization."
on public.organization_members for delete
using ( user_id = auth.uid() );


-- Policies for subscriptions
create policy "Users can view and manage their own subscriptions."
on public.subscriptions for all
using ( auth.uid() = user_id )
with check ( auth.uid() = user_id );

-- Policies for payments
create policy "Users can view their own payments."
on public.payments for select
using ( auth.uid() = user_id );

-- Note: Inserts/Updates to the payments table should ONLY be done via a secure backend function (webhook) using the 
service_role key.
-- We are intentionally not creating insert/update/delete policies for clients.
