-- Create a custom type for user roles within an organization
create type public.organization_role_enum as enum ('admin', 'member');

-- Create a custom type for subscription plan types
create type public.subscription_plan_type_enum as enum ('monthly', 'annual');

-- Create custom types for statuses
create type public.subscription_status_enum as enum ('pending_payment', 'active', 'canceled');
create type public.payment_status_enum as enum ('pending', 'succeeded', 'failed');

-- Create organizations table
create table public.organizations (
    id uuid not null default gen_random_uuid() primary key,
    name text not null,
    slug text not null unique,
    owner_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamp with time zone not null default timezone('utc'::text, now()),
    monthly_price_amount integer,
    annual_price_amount integer
);
comment on table public.organizations is 'Stores information about each team or association.';

-- Create organization_members table
create table public.organization_members (
    organization_id uuid not null references public.organizations(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role public.organization_role_enum not null default 'member',
    joined_at timestamp with time zone not null default timezone('utc'::text, now()),
    primary key (organization_id, user_id)
);
comment on table public.organization_members is 'Join table to link users to organizations with specific roles.';

-- Create subscriptions table
create table public.subscriptions (
    id uuid not null default gen_random_uuid() primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    plan_type public.subscription_plan_type_enum not null,
    status public.subscription_status_enum not null default 'pending_payment',
    current_period_end timestamp with time zone,
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
    status public.payment_status_enum not null default 'pending',
    created_at timestamp with time zone not null default timezone('utc'::text, now()),
    paid_at timestamp with time zone,
    abacate_pay_charge_id text unique
);
comment on table public.payments is 'Stores a historical record of all payments.';
comment on column public.payments.amount is 'Amount in the smallest currency unit (e.g., cents).';
comment on column public.payments.abacate_pay_charge_id is 'The unique ID from the payment provider (Abacate Pay).';

alter table public.payments replica identity full;
alter publication supabase_realtime add table public.payments;

-- Enable Row Level Security (RLS)
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

-- RLS POLICIES --

-- Policies for organizations
create policy "All users can view organizations."
on public.organizations for select
using ( true );

create policy "Owners can manage their own organization."
on public.organizations for all
using ( auth.uid() = owner_id )
with check ( auth.uid() = owner_id );

-- Policies for organization_members
create policy "Authenticated users can view organization members."
on public.organization_members for select
using ( auth.role() = 'authenticated' );

create policy "Authenticated users can join an organization."
on public.organization_members for insert
with check ( auth.uid() = user_id );

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

create policy "Servers with service_role can update payment records."
on public.payments for update
using ( auth.role() = 'service_role' )
with check ( auth.role() = 'service_role' );

-- Note: Inserts/Updates to the payments table should ONLY be done via a secure backend function (webhook) using the service_role key.
-- We are intentionally not creating insert/update/delete policies for clients.
