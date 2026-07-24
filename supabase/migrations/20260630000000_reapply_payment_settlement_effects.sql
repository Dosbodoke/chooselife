alter table public.payments
add column if not exists payment_provider text,
add column if not exists provider_payment_id text;

update public.payments
set
  payment_provider = 'abacate_pay',
  provider_payment_id = abacate_pay_charge_id
where abacate_pay_charge_id is not null
  and provider_payment_id is null;

create unique index if not exists payments_provider_payment_id_unique
on public.payments (payment_provider, provider_payment_id)
where provider_payment_id is not null;

create or replace function public.apply_succeeded_payment_effects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  subscription_record record;
  period_start timestamp with time zone;
begin
  if new.status <> 'succeeded' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'succeeded' then
      return new;
    end if;
  end if;

  select current_period_end, plan_type
  into subscription_record
  from public.subscriptions
  where id = new.subscription_id
  for update;

  if not found then
    raise warning 'Cannot apply payment effects. Subscription % was not found for payment %.', new.subscription_id, new.id;
    return new;
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
  where id = new.subscription_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new.organization_id, new.user_id, 'member')
  on conflict (organization_id, user_id) do update
  set role = excluded.role;

  return new;
end;
$$;

drop trigger if exists payments_apply_succeeded_effects on public.payments;
create trigger payments_apply_succeeded_effects
after insert or update of status on public.payments
for each row
execute function public.apply_succeeded_payment_effects();
