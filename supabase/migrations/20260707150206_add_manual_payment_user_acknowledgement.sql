alter table public.payments
add column if not exists user_marked_paid_at timestamp with time zone;

comment on column public.payments.user_marked_paid_at is 'When the signed-in user said they completed a manual payment. This does not approve or settle the payment.';

create or replace function public.mark_manual_payment_paid_by_user(
  p_payment_id uuid
)
returns table (
  payment_id uuid,
  status public.payment_status_enum,
  user_marked_paid_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_record record;
begin
  select
    p.id,
    p.user_id,
    p.status,
    p.payment_provider,
    p.provider_payment_id,
    p.user_marked_paid_at
  into payment_record
  from public.payments p
  where p.id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment % was not found.', p_payment_id
      using errcode = 'P0002';
  end if;

  if payment_record.user_id <> auth.uid() then
    raise exception 'Payment % does not belong to the current user.', p_payment_id
      using errcode = '42501';
  end if;

  if payment_record.status <> 'pending' then
    raise exception 'Only pending payments can be marked as paid by the user.'
      using errcode = '23514';
  end if;

  if payment_record.payment_provider is not null
    or payment_record.provider_payment_id is not null then
    raise exception 'Only manual payments can be marked as paid by the user.'
      using errcode = '23514';
  end if;

  update public.payments p
  set user_marked_paid_at = coalesce(
    p.user_marked_paid_at,
    timezone('utc'::text, now())
  )
  where p.id = p_payment_id;

  return query
  select
    p.id,
    p.status,
    p.user_marked_paid_at
  from public.payments p
  where p.id = p_payment_id;
end;
$$;

comment on function public.mark_manual_payment_paid_by_user(uuid) is 'Lets the signed-in owner flag a pending manual payment as already paid. The payment remains pending until an admin manually approves it.';

revoke all on function public.mark_manual_payment_paid_by_user(uuid) from public;
revoke all on function public.mark_manual_payment_paid_by_user(uuid) from anon;
grant execute on function public.mark_manual_payment_paid_by_user(uuid) to authenticated;
