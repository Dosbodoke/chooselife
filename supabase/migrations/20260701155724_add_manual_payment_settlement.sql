alter table public.payments
add column if not exists settlement_applied_at timestamp with time zone;

comment on column public.payments.settlement_applied_at is 'When local subscription and membership effects were applied for this payment. Prevents duplicate manual/provider settlement effects.';

create or replace function public.apply_payment_settlement_effects(p_payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_record record;
  subscription_record record;
  period_start timestamp with time zone;
begin
  select
    id,
    subscription_id,
    user_id,
    organization_id,
    status,
    settlement_applied_at
  into payment_record
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment % was not found.', p_payment_id
      using errcode = 'P0002';
  end if;

  if payment_record.status <> 'succeeded' then
    return false;
  end if;

  if payment_record.settlement_applied_at is not null then
    return false;
  end if;

  select current_period_end, plan_type
  into subscription_record
  from public.subscriptions
  where id = payment_record.subscription_id
  for update;

  if not found then
    raise warning 'Cannot apply payment effects. Subscription % was not found for payment %.', payment_record.subscription_id, payment_record.id;
    return false;
  end if;

  period_start = greatest(
    coalesce(subscription_record.current_period_end, timezone('utc'::text, now())),
    timezone('utc'::text, now())
  );

  update public.subscriptions
  set
    status = 'active',
    current_period_end = period_start + case subscription_record.plan_type
      when 'annual'::public.subscription_plan_type_enum then interval '1 year'
      else interval '1 month'
    end
  where id = payment_record.subscription_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (payment_record.organization_id, payment_record.user_id, 'member')
  on conflict (organization_id, user_id) do update
  set role = excluded.role;

  update public.payments
  set settlement_applied_at = timezone('utc'::text, now())
  where id = payment_record.id
    and settlement_applied_at is null;

  return true;
end;
$$;

revoke all on function public.apply_payment_settlement_effects(uuid) from public;
revoke all on function public.apply_payment_settlement_effects(uuid) from anon;
revoke all on function public.apply_payment_settlement_effects(uuid) from authenticated;
grant execute on function public.apply_payment_settlement_effects(uuid) to service_role;

create or replace function public.apply_succeeded_payment_effects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'succeeded' then
    return new;
  end if;

  perform public.apply_payment_settlement_effects(new.id);
  return new;
end;
$$;

revoke all on function public.apply_succeeded_payment_effects() from public;
revoke all on function public.apply_succeeded_payment_effects() from anon;
revoke all on function public.apply_succeeded_payment_effects() from authenticated;

drop trigger if exists payments_apply_succeeded_effects on public.payments;
create trigger payments_apply_succeeded_effects
after insert or update of status on public.payments
for each row
execute function public.apply_succeeded_payment_effects();

create or replace function public.mark_payment_succeeded_manually(
  p_payment_id uuid,
  p_paid_at timestamp with time zone default timezone('utc'::text, now())
)
returns table (
  payment_id uuid,
  previous_status public.payment_status_enum,
  status public.payment_status_enum,
  paid_at timestamp with time zone,
  settlement_applied_at timestamp with time zone,
  applied_effects_now boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_payment record;
  applied_now boolean;
  current_settlement_applied_at timestamp with time zone;
begin
  select p.status, p.settlement_applied_at
  into previous_payment
  from public.payments p
  where p.id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment % was not found.', p_payment_id
      using errcode = 'P0002';
  end if;

  if previous_payment.status = 'succeeded' then
    update public.payments p
    set paid_at = coalesce(p.paid_at, p_paid_at, timezone('utc'::text, now()))
    where p.id = p_payment_id;

    applied_now = public.apply_payment_settlement_effects(p_payment_id);
  else
    update public.payments p
    set
      status = 'succeeded',
      paid_at = coalesce(p_paid_at, timezone('utc'::text, now()))
    where p.id = p_payment_id;

    select p.settlement_applied_at
    into current_settlement_applied_at
    from public.payments p
    where p.id = p_payment_id;

    applied_now = previous_payment.settlement_applied_at is null
      and current_settlement_applied_at is not null;
  end if;

  return query
  select
    p.id,
    previous_payment.status,
    p.status,
    p.paid_at,
    p.settlement_applied_at,
    applied_now
  from public.payments p
  where p.id = p_payment_id;
end;
$$;

comment on function public.mark_payment_succeeded_manually(uuid, timestamp with time zone) is 'Marks a local payment as succeeded and applies subscription/membership effects exactly once. Intended for service-role/admin manual settlement.';

revoke all on function public.mark_payment_succeeded_manually(uuid, timestamp with time zone) from public;
revoke all on function public.mark_payment_succeeded_manually(uuid, timestamp with time zone) from anon;
revoke all on function public.mark_payment_succeeded_manually(uuid, timestamp with time zone) from authenticated;
grant execute on function public.mark_payment_succeeded_manually(uuid, timestamp with time zone) to service_role;
