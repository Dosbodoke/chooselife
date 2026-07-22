alter table public.organizations
add column if not exists monthly_pix_copy_paste text,
add column if not exists annual_pix_copy_paste text;

comment on column public.organizations.monthly_pix_copy_paste is 'Fixed PIX copy-paste payload used for monthly membership payments.';
comment on column public.organizations.annual_pix_copy_paste is 'Fixed PIX copy-paste payload used for annual membership payments.';

create or replace function public.get_manual_payment_instructions(
  p_payment_id uuid
)
returns table (
  payment_id uuid,
  amount integer,
  status public.payment_status_enum,
  user_marked_paid_at timestamp with time zone,
  pix_copy_paste text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    p.id,
    p.amount,
    p.status,
    p.user_marked_paid_at,
    case s.plan_type
      when 'annual'::public.subscription_plan_type_enum then o.annual_pix_copy_paste
      else o.monthly_pix_copy_paste
    end as pix_copy_paste
  from public.payments p
  join public.subscriptions s on s.id = p.subscription_id
  join public.organizations o on o.id = p.organization_id
  where p.id = p_payment_id
    and p.user_id = auth.uid()
    and p.payment_provider is null
    and p.provider_payment_id is null;
end;
$$;

comment on function public.get_manual_payment_instructions(uuid) is 'Returns the fixed manual PIX payload for the signed-in owner of a local manual payment.';

revoke all on function public.get_manual_payment_instructions(uuid) from public;
revoke all on function public.get_manual_payment_instructions(uuid) from anon;
grant execute on function public.get_manual_payment_instructions(uuid) to authenticated;
