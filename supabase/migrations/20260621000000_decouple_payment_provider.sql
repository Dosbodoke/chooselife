alter table public.payments
add column payment_provider text,
add column provider_payment_id text;

update public.payments
set
  payment_provider = 'abacate_pay',
  provider_payment_id = abacate_pay_charge_id
where abacate_pay_charge_id is not null
  and provider_payment_id is null;

create unique index payments_provider_payment_id_unique
on public.payments (payment_provider, provider_payment_id)
where provider_payment_id is not null;

comment on column public.payments.payment_provider is 'Payment provider that created the external payment reference. Null for manual payments.';
comment on column public.payments.provider_payment_id is 'Provider-owned payment reference. Null for manual payments.';
comment on column public.payments.abacate_pay_charge_id is 'Deprecated legacy Abacate Pay charge ID. Use payment_provider and provider_payment_id instead.';
