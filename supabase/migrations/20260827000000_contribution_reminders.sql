-- Issue #211: private, durable contribution reminder outbox.
--
-- Logical reminder events are deliberately separate from public.notifications.
-- The tables below are private service data: clients can only register and
-- unregister their own push token through authenticated commands.

alter table public.organizations
  add column if not exists contribution_reminder_local_time
    time without time zone not null default '09:00:00'::time;

comment on column public.organizations.contribution_reminder_local_time is
  'Local delivery time for private contribution reminders. The initial default is 09:00.';

do $$
begin
  create type public.contribution_reminder_stage_enum as enum (
    'available',
    'due',
    'overdue'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.contribution_reminder_event_status_enum as enum (
    'pending',
    'delivered',
    'coalesced',
    'suppressed',
    'no_device',
    'exhausted'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.contribution_reminder_batch_status_enum as enum (
    'pending',
    'leased',
    'awaiting_receipts',
    'retryable',
    'delivered',
    'no_device',
    'terminal',
    'suppressed'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.contribution_reminder_attempt_status_enum as enum (
    'pending',
    'leased',
    'ticketed',
    'retryable',
    'delivered',
    'terminal'
  );
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.contribution_reminder_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  obligation_id uuid not null references public.payment_obligations(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  stage public.contribution_reminder_stage_enum not null,
  stage_on date not null,
  delivery_window_on date not null,
  status public.contribution_reminder_event_status_enum not null default 'pending',
  suppression_reason text,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  delivered_at timestamp with time zone,
  unique (obligation_id, recipient_user_id, stage)
);

comment on table public.contribution_reminder_events is
  'Private logical contribution reminder events. One row exists per obligation, recipient, and stage.';

create table if not exists public.contribution_reminder_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  delivery_window_on date not null,
  status public.contribution_reminder_batch_status_enum not null default 'pending',
  lease_token uuid,
  lease_expires_at timestamp with time zone,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamp with time zone not null default timezone('utc'::text, now()),
  last_failure_code text,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  delivered_at timestamp with time zone,
  unique (organization_id, recipient_user_id, delivery_window_on)
);

comment on table public.contribution_reminder_batches is
  'Private physical delivery windows. Several logical events share at most one batch per member and association window.';

create table if not exists public.contribution_reminder_batch_events (
  batch_id uuid not null references public.contribution_reminder_batches(id) on delete cascade,
  event_id uuid not null references public.contribution_reminder_events(id) on delete cascade,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  primary key (batch_id, event_id),
  unique (event_id)
);

create table if not exists public.contribution_reminder_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.contribution_reminder_batches(id) on delete cascade,
  push_token_id bigint references public.push_tokens(id) on delete set null,
  token text not null,
  language public.language,
  status public.contribution_reminder_attempt_status_enum not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  lease_token uuid,
  lease_expires_at timestamp with time zone,
  next_attempt_at timestamp with time zone not null default timezone('utc'::text, now()),
  expo_ticket_id text,
  expo_receipt_status text,
  expo_receipt_error_code text,
  terminal_outcome text,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  next_receipt_check_at timestamp with time zone,
  unique (batch_id, token)
);

comment on table public.contribution_reminder_delivery_attempts is
  'Private at-least-once delivery state for one reminder batch and one device token.';

create index if not exists contribution_reminder_events_pending_idx
  on public.contribution_reminder_events (
    delivery_window_on,
    organization_id,
    recipient_user_id,
    created_at,
    id
  )
  where status = 'pending'::public.contribution_reminder_event_status_enum;

create index if not exists contribution_reminder_events_obligation_idx
  on public.contribution_reminder_events (obligation_id, status, stage);

create index if not exists contribution_reminder_batches_due_idx
  on public.contribution_reminder_batches (
    next_attempt_at,
    delivery_window_on,
    organization_id,
    recipient_user_id,
    id
  )
  where status in (
    'pending'::public.contribution_reminder_batch_status_enum,
    'retryable'::public.contribution_reminder_batch_status_enum
  );

create index if not exists contribution_reminder_batch_events_event_idx
  on public.contribution_reminder_batch_events (event_id, batch_id);

create index if not exists contribution_reminder_attempts_due_idx
  on public.contribution_reminder_delivery_attempts (
    next_attempt_at,
    batch_id,
    status,
    id
  );

create index if not exists contribution_reminder_attempts_receipts_idx
  on public.contribution_reminder_delivery_attempts (
    next_receipt_check_at,
    status,
    id
  )
  where status = 'ticketed'::public.contribution_reminder_attempt_status_enum;

create index if not exists contribution_reminder_attempts_expired_receipt_leases_idx
  on public.contribution_reminder_delivery_attempts (lease_expires_at, id)
  where status = 'leased'::public.contribution_reminder_attempt_status_enum
    and expo_ticket_id is not null;

alter table public.contribution_reminder_events enable row level security;
alter table public.contribution_reminder_batches enable row level security;
alter table public.contribution_reminder_batch_events enable row level security;
alter table public.contribution_reminder_delivery_attempts enable row level security;

revoke all on table public.contribution_reminder_events
  from public, anon, authenticated;
revoke all on table public.contribution_reminder_batches
  from public, anon, authenticated;
revoke all on table public.contribution_reminder_batch_events
  from public, anon, authenticated;
revoke all on table public.contribution_reminder_delivery_attempts
  from public, anon, authenticated;
grant all on table public.contribution_reminder_events to service_role;
grant all on table public.contribution_reminder_batches to service_role;
grant all on table public.contribution_reminder_batch_events to service_role;
grant all on table public.contribution_reminder_delivery_attempts to service_role;

-- Push tokens are private device ownership data. Existing public policies are
-- removed before the authenticated command functions below are exposed.
drop policy if exists "Allow all users to read push tokens" on public.push_tokens;
drop policy if exists "Allow all users to insert push tokens" on public.push_tokens;
drop policy if exists "Allow authenticated users to update their own push tokens"
  on public.push_tokens;
revoke all on table public.push_tokens from public, anon, authenticated;
grant all on table public.push_tokens to service_role;

create or replace function public.contribution_reminder_stage_for_date(
  p_available_on date,
  p_due_on date,
  p_local_date date
)
returns public.contribution_reminder_stage_enum
language sql
immutable
set search_path = ''
as $$
  select case
    when p_local_date >= p_due_on + 7 then
      'overdue'::public.contribution_reminder_stage_enum
    when p_local_date >= p_due_on then
      'due'::public.contribution_reminder_stage_enum
    when p_local_date >= p_available_on then
      'available'::public.contribution_reminder_stage_enum
    else null
  end;
$$;

create or replace function public.contribution_reminder_delivery_at(
  p_stage_on date,
  p_timezone text,
  p_local_time time without time zone
)
returns timestamp with time zone
language sql
immutable
set search_path = ''
as $$
  select (
    p_stage_on::timestamp
      + (p_local_time - time '00:00:00')
  ) at time zone p_timezone;
$$;

create or replace function public.contribution_reminder_backoff(
  p_attempt_count integer
)
returns interval
language sql
immutable
set search_path = ''
as $$
  select make_interval(
    secs => least(
      3600::double precision,
      60::double precision * power(
        2::double precision,
        greatest(coalesce(p_attempt_count, 1) - 1, 0)
      )
    )
  );
$$;

revoke all on function public.contribution_reminder_stage_for_date(date, date, date)
  from public, anon, authenticated, service_role;
revoke all on function public.contribution_reminder_delivery_at(
  date, text, time without time zone
) from public, anon, authenticated, service_role;
revoke all on function public.contribution_reminder_backoff(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.contribution_reminder_stage_for_date(date, date, date)
  to postgres;
grant execute on function public.contribution_reminder_delivery_at(
  date, text, time without time zone
) to postgres;
grant execute on function public.contribution_reminder_backoff(integer)
  to postgres;

create or replace function public.register_push_token(
  p_token text,
  p_language public.language default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  normalized_token text := nullif(btrim(p_token), '');
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if normalized_token is null or char_length(normalized_token) > 512 then
    raise exception 'A valid push token is required.' using errcode = '22023';
  end if;

  insert into public.push_tokens (token, profile_id, language, created_at)
  values (normalized_token, actor_id, p_language, clock_timestamp())
  on conflict (token) do update
  set
    profile_id = excluded.profile_id,
    language = excluded.language,
    created_at = clock_timestamp();

  return 'registered';
end;
$$;

comment on function public.register_push_token(text, public.language) is
  'Associates one device token with the currently authenticated profile, replacing a previous owner for account switching.';

create or replace function public.unregister_push_token(
  p_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  removed_id bigint;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  delete from public.push_tokens
  where token = nullif(btrim(p_token), '')
    and profile_id = actor_id
  returning id into removed_id;

  return removed_id is not null;
end;
$$;

comment on function public.unregister_push_token(text) is
  'Removes one device token only when it is owned by the currently authenticated profile.';

revoke all on function public.register_push_token(text, public.language)
  from public, anon;
revoke all on function public.unregister_push_token(text)
  from public, anon;
grant execute on function public.register_push_token(text, public.language)
  to authenticated, service_role;
grant execute on function public.unregister_push_token(text)
  to authenticated, service_role;

create or replace function public.enqueue_contribution_reminder_events_at(
  p_as_of timestamp with time zone
)
returns table (
  created_count integer,
  skipped_count integer,
  suppressed_count integer,
  coalesced_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  evaluated_at timestamp with time zone := coalesce(p_as_of, clock_timestamp());
  obligation_record record;
  stage_value public.contribution_reminder_stage_enum;
  stage_on_value date;
  local_date_value date;
  delivery_at_value timestamp with time zone;
  inserted_event public.contribution_reminder_events%rowtype;
  existing_event public.contribution_reminder_events%rowtype;
  batch_record public.contribution_reminder_batches%rowtype;
  affected_count integer;
begin
  if evaluated_at is null then
    raise exception 'The reminder evaluation clock is required.' using errcode = '22023';
  end if;

  created_count := 0;
  skipped_count := 0;
  suppressed_count := 0;
  coalesced_count := 0;

  update public.contribution_reminder_events event_record
  set
    status = 'suppressed'::public.contribution_reminder_event_status_enum,
    suppression_reason = case
      when po.status = 'settled'::public.payment_obligation_status_enum
        then 'obligation_settled'
      when po.status = 'void'::public.payment_obligation_status_enum
        then 'obligation_void'
      when exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      ) then 'claim_under_review'
      else 'membership_not_active'
    end,
    updated_at = clock_timestamp()
  from public.payment_obligations po
  where event_record.obligation_id = po.id
    and event_record.status = 'pending'::public.contribution_reminder_event_status_enum
    and (
      po.status in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      or exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      )
      or not exists (
        select 1
        from public.organization_members om
        join public.subscriptions s
          on s.organization_id = om.organization_id
          and s.user_id = om.user_id
          and s.status = 'active'::public.subscription_status_enum
        where om.organization_id = po.organization_id
          and om.user_id = po.user_id
          and om.role in (
            'admin'::public.organization_role_enum,
            'member'::public.organization_role_enum
          )
      )
    );
  get diagnostics affected_count = row_count;
  suppressed_count := suppressed_count + affected_count;

  for obligation_record in
    select
      po.id,
      po.organization_id,
      po.user_id,
      po.available_on,
      po.due_on,
      coalesce(po.billing_timezone, o.billing_timezone) as billing_timezone,
      o.contribution_reminder_local_time
    from public.payment_obligations po
    join public.organizations o on o.id = po.organization_id
    join public.organization_members om
      on om.organization_id = po.organization_id
      and om.user_id = po.user_id
      and om.role in (
        'admin'::public.organization_role_enum,
        'member'::public.organization_role_enum
      )
    join public.subscriptions s
      on s.organization_id = po.organization_id
      and s.user_id = po.user_id
      and s.status = 'active'::public.subscription_status_enum
    where po.purpose = 'recurring'::public.payment_obligation_purpose_enum
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and o.organization_type = 'association'::public.organization_type_enum
      and not exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      )
    order by po.organization_id, po.user_id, po.due_on, po.id
  loop
    local_date_value := timezone(
      obligation_record.billing_timezone,
      evaluated_at
    )::date;
    stage_value := public.contribution_reminder_stage_for_date(
      obligation_record.available_on,
      obligation_record.due_on,
      local_date_value
    );

    if stage_value is null then
      skipped_count := skipped_count + 1;
      continue;
    end if;

    stage_on_value := case stage_value
      when 'available'::public.contribution_reminder_stage_enum
        then obligation_record.available_on
      when 'due'::public.contribution_reminder_stage_enum
        then obligation_record.due_on
      else obligation_record.due_on + 7
    end;

    delivery_at_value := public.contribution_reminder_delivery_at(
      stage_on_value,
      obligation_record.billing_timezone,
      obligation_record.contribution_reminder_local_time
    );

    if evaluated_at < delivery_at_value then
      skipped_count := skipped_count + 1;
      continue;
    end if;

    update public.contribution_reminder_events event_record
    set
      status = 'suppressed'::public.contribution_reminder_event_status_enum,
      suppression_reason = 'superseded_by_newer_stage',
      updated_at = clock_timestamp()
    where event_record.obligation_id = obligation_record.id
      and event_record.recipient_user_id = obligation_record.user_id
      and event_record.status = 'pending'::public.contribution_reminder_event_status_enum
      and event_record.stage < stage_value;
    get diagnostics affected_count = row_count;
    suppressed_count := suppressed_count + affected_count;

    inserted_event := null;
    existing_event := null;
    insert into public.contribution_reminder_events (
      organization_id,
      obligation_id,
      recipient_user_id,
      stage,
      stage_on,
      delivery_window_on,
      status
    )
    values (
      obligation_record.organization_id,
      obligation_record.id,
      obligation_record.user_id,
      stage_value,
      stage_on_value,
      local_date_value,
      'pending'::public.contribution_reminder_event_status_enum
    )
    on conflict (obligation_id, recipient_user_id, stage)
    do nothing
    returning * into inserted_event;

    if inserted_event.id is null then
      select event_record.*
      into existing_event
      from public.contribution_reminder_events event_record
      where event_record.obligation_id = obligation_record.id
        and event_record.recipient_user_id = obligation_record.user_id
        and event_record.stage = stage_value;
    else
      created_count := created_count + 1;
      existing_event := inserted_event;
    end if;

    if existing_event.status <>
      'pending'::public.contribution_reminder_event_status_enum then
      continue;
    end if;

    batch_record := null;
    insert into public.contribution_reminder_batches (
      organization_id,
      recipient_user_id,
      delivery_window_on
    )
    values (
      obligation_record.organization_id,
      obligation_record.user_id,
      local_date_value
    )
    on conflict (organization_id, recipient_user_id, delivery_window_on)
    do update set updated_at = clock_timestamp()
    returning * into batch_record;

    insert into public.contribution_reminder_batch_events (batch_id, event_id)
    values (batch_record.id, existing_event.id)
    on conflict (event_id) do nothing;

    if batch_record.status =
      'delivered'::public.contribution_reminder_batch_status_enum then
      update public.contribution_reminder_events
      set
        status = 'coalesced'::public.contribution_reminder_event_status_enum,
        suppression_reason = 'coalesced_into_completed_window',
        updated_at = clock_timestamp()
      where id = existing_event.id
        and status = 'pending'::public.contribution_reminder_event_status_enum;
      if found then
        coalesced_count := coalesced_count + 1;
      end if;
    elsif batch_record.status =
      'no_device'::public.contribution_reminder_batch_status_enum then
      update public.contribution_reminder_events
      set
        status = 'no_device'::public.contribution_reminder_event_status_enum,
        suppression_reason = 'no_current_device',
        updated_at = clock_timestamp()
      where id = existing_event.id
        and status = 'pending'::public.contribution_reminder_event_status_enum;
    elsif batch_record.status =
      'terminal'::public.contribution_reminder_batch_status_enum then
      update public.contribution_reminder_events
      set
        status = 'exhausted'::public.contribution_reminder_event_status_enum,
        suppression_reason = 'delivery_exhausted',
        updated_at = clock_timestamp()
      where id = existing_event.id
        and status = 'pending'::public.contribution_reminder_event_status_enum;
    elsif batch_record.status =
      'suppressed'::public.contribution_reminder_batch_status_enum then
      update public.contribution_reminder_events
      set
        status = 'suppressed'::public.contribution_reminder_event_status_enum,
        suppression_reason = 'batch_suppressed',
        updated_at = clock_timestamp()
      where id = existing_event.id
        and status = 'pending'::public.contribution_reminder_event_status_enum;
    end if;
  end loop;

  update public.contribution_reminder_batches queued_batch
  set
    status = 'suppressed'::public.contribution_reminder_batch_status_enum,
    last_failure_code = 'no_pending_events',
    updated_at = clock_timestamp()
  where queued_batch.status =
      'pending'::public.contribution_reminder_batch_status_enum
    and not exists (
      select 1
      from public.contribution_reminder_batch_events batch_event
      join public.contribution_reminder_events event_record
        on event_record.id = batch_event.event_id
      where batch_event.batch_id = queued_batch.id
        and event_record.status =
          'pending'::public.contribution_reminder_event_status_enum
    )
    and not exists (
      select 1
      from public.contribution_reminder_delivery_attempts delivery_attempt
      where delivery_attempt.batch_id = queued_batch.id
    );
  return next;
end;
$$;

create or replace function public.enqueue_contribution_reminder_events()
returns table (
  created_count integer,
  skipped_count integer,
  suppressed_count integer,
  coalesced_count integer
)
language sql
security definer
set search_path = ''
as $$
  select *
  from public.enqueue_contribution_reminder_events_at(clock_timestamp());
$$;

comment on function public.enqueue_contribution_reminder_events() is
  'Trusted scheduler command that creates only the latest useful reminder stage for each eligible recurring obligation.';

revoke all on function public.enqueue_contribution_reminder_events_at(timestamp with time zone)
  from public, anon, authenticated, service_role;
revoke all on function public.enqueue_contribution_reminder_events()
  from public, anon, authenticated;
grant execute on function public.enqueue_contribution_reminder_events_at(timestamp with time zone)
  to postgres;
grant execute on function public.enqueue_contribution_reminder_events()
  to service_role;

create or replace function public.refresh_contribution_reminder_batch(
  p_batch_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_pending boolean;
  has_waiting boolean;
  has_delivered boolean;
  has_attempts boolean;
  next_retry timestamp with time zone;
begin
  select
    exists (
      select 1
      from public.contribution_reminder_delivery_attempts da
      where da.batch_id = p_batch_id
        and da.status in (
          'pending'::public.contribution_reminder_attempt_status_enum,
          'retryable'::public.contribution_reminder_attempt_status_enum
        )
    ),
    exists (
      select 1
      from public.contribution_reminder_delivery_attempts da
      where da.batch_id = p_batch_id
        and da.status in (
          'leased'::public.contribution_reminder_attempt_status_enum,
          'ticketed'::public.contribution_reminder_attempt_status_enum
        )
    ),
    exists (
      select 1
      from public.contribution_reminder_delivery_attempts da
      where da.batch_id = p_batch_id
        and da.status = 'delivered'::public.contribution_reminder_attempt_status_enum
    ),
    exists (
      select 1
      from public.contribution_reminder_delivery_attempts da
      where da.batch_id = p_batch_id
    )
  into has_pending, has_waiting, has_delivered, has_attempts;

  if has_pending and has_waiting then
    update public.contribution_reminder_batches
    set
      status = 'awaiting_receipts'::public.contribution_reminder_batch_status_enum,
      next_attempt_at = coalesce(
        (
          select min(da.next_attempt_at)
          from public.contribution_reminder_delivery_attempts da
          where da.batch_id = p_batch_id
            and da.status = 'retryable'::public.contribution_reminder_attempt_status_enum
        ),
        clock_timestamp()
      ),
      updated_at = clock_timestamp()
    where id = p_batch_id;
    return;
  end if;

  if has_waiting then
    update public.contribution_reminder_batches
    set
      status = 'awaiting_receipts'::public.contribution_reminder_batch_status_enum,
      updated_at = clock_timestamp()
    where id = p_batch_id;
    return;
  end if;

  if has_pending then
    select min(da.next_attempt_at)
    into next_retry
    from public.contribution_reminder_delivery_attempts da
    where da.batch_id = p_batch_id
      and da.status in (
        'pending'::public.contribution_reminder_attempt_status_enum,
        'retryable'::public.contribution_reminder_attempt_status_enum
      );

    update public.contribution_reminder_batches
    set
      status = 'retryable'::public.contribution_reminder_batch_status_enum,
      next_attempt_at = coalesce(next_retry, clock_timestamp()),
      updated_at = clock_timestamp()
    where id = p_batch_id;
    return;
  end if;

  if has_delivered then
    update public.contribution_reminder_batches
    set
      status = 'delivered'::public.contribution_reminder_batch_status_enum,
      delivered_at = coalesce(delivered_at, clock_timestamp()),
      updated_at = clock_timestamp()
    where id = p_batch_id;

    update public.contribution_reminder_events event_record
    set
      status = 'delivered'::public.contribution_reminder_event_status_enum,
      delivered_at = coalesce(delivered_at, clock_timestamp()),
      updated_at = clock_timestamp()
    where event_record.id in (
      select event_id
      from public.contribution_reminder_batch_events batch_event
      where batch_event.batch_id = p_batch_id
    )
      and event_record.status = 'pending'::public.contribution_reminder_event_status_enum;
    return;
  end if;

  if has_attempts then
    update public.contribution_reminder_batches
    set
      status = 'terminal'::public.contribution_reminder_batch_status_enum,
      updated_at = clock_timestamp()
    where id = p_batch_id;

    update public.contribution_reminder_events event_record
    set
      status = 'exhausted'::public.contribution_reminder_event_status_enum,
      suppression_reason = 'delivery_exhausted',
      updated_at = clock_timestamp()
    where event_record.id in (
      select event_id
      from public.contribution_reminder_batch_events batch_event
      where batch_event.batch_id = p_batch_id
    )
      and event_record.status = 'pending'::public.contribution_reminder_event_status_enum;
  end if;
end;
$$;

revoke all on function public.refresh_contribution_reminder_batch(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.refresh_contribution_reminder_batch(uuid)
  to postgres;

create or replace function public.claim_contribution_reminder_batches(
  p_limit integer default 20,
  p_lease_seconds integer default 120
)
returns table (
  batch_id uuid,
  lease_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch_record public.contribution_reminder_batches%rowtype;
  lease_value uuid;
  limit_value integer := greatest(1, least(coalesce(p_limit, 20), 100));
  lease_interval interval := make_interval(
    secs => greatest(30, least(coalesce(p_lease_seconds, 120), 900))
  );
begin
  for batch_record in
    select b.*
    from public.contribution_reminder_batches b
    where (
      b.status in (
        'pending'::public.contribution_reminder_batch_status_enum,
        'retryable'::public.contribution_reminder_batch_status_enum
      )
      and b.next_attempt_at <= clock_timestamp()
      or (
        b.status = 'leased'::public.contribution_reminder_batch_status_enum
        and b.lease_expires_at < clock_timestamp()
        and not exists (
          select 1
          from public.contribution_reminder_delivery_attempts da
          where da.batch_id = b.id
            and da.status = 'ticketed'::public.contribution_reminder_attempt_status_enum
        )
      )
    )
    order by b.delivery_window_on, b.organization_id, b.recipient_user_id, b.id
    limit limit_value
    for update skip locked
  loop
    lease_value := gen_random_uuid();

    update public.contribution_reminder_batches
    set
      status = 'leased'::public.contribution_reminder_batch_status_enum,
      lease_token = lease_value,
      lease_expires_at = clock_timestamp() + lease_interval,
      attempt_count = attempt_count + 1,
      updated_at = clock_timestamp()
    where id = batch_record.id;

    batch_id := batch_record.id;
    lease_token := lease_value;
    return next;
  end loop;
end;
$$;

comment on function public.claim_contribution_reminder_batches(integer, integer) is
  'Claims private reminder batches with SKIP LOCKED so concurrent dispatchers do not process the same batch.';

revoke all on function public.claim_contribution_reminder_batches(integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_contribution_reminder_batches(integer, integer)
  to service_role;

create or replace function public.prepare_contribution_reminder_batch(
  p_batch_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer default 120
)
returns table (
  batch_id uuid,
  organization_slug text,
  delivery_window_on date,
  delivery_attempts jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch_record public.contribution_reminder_batches%rowtype;
  lease_interval interval := make_interval(
    secs => greatest(30, least(coalesce(p_lease_seconds, 120), 900))
  );
  token_count integer;
  active_event_count integer;
  attempt_count_value integer;
  slug_value text;
begin
  select b.*
  into batch_record
  from public.contribution_reminder_batches b
  where b.id = p_batch_id
    and b.status = 'leased'::public.contribution_reminder_batch_status_enum
    and b.lease_token = p_lease_token
    and b.lease_expires_at > clock_timestamp()
  for update;

  if not found then
    return;
  end if;

  update public.contribution_reminder_events event_record
  set
    status = 'suppressed'::public.contribution_reminder_event_status_enum,
    suppression_reason = case
      when po.status = 'settled'::public.payment_obligation_status_enum
        then 'obligation_settled'
      when po.status = 'void'::public.payment_obligation_status_enum
        then 'obligation_void'
      when exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      ) then 'claim_under_review'
      else 'membership_not_active'
    end,
    updated_at = clock_timestamp()
  from public.contribution_reminder_batch_events batch_event
  join public.contribution_reminder_events batch_event_record
    on batch_event_record.id = batch_event.event_id
  join public.payment_obligations po on po.id = batch_event_record.obligation_id
  where batch_event.batch_id = p_batch_id
    and event_record.id = batch_event.event_id
    and event_record.status = 'pending'::public.contribution_reminder_event_status_enum
    and (
      po.status in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      or exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      )
      or not exists (
        select 1
        from public.organization_members om
        join public.subscriptions s
          on s.organization_id = om.organization_id
          and s.user_id = om.user_id
          and s.status = 'active'::public.subscription_status_enum
        where om.organization_id = po.organization_id
          and om.user_id = po.user_id
          and om.role in (
            'admin'::public.organization_role_enum,
            'member'::public.organization_role_enum
          )
      )
    );

  select count(*)
  into active_event_count
  from public.contribution_reminder_batch_events batch_event
  join public.contribution_reminder_events event_record
    on event_record.id = batch_event.event_id
  where batch_event.batch_id = p_batch_id
    and event_record.status = 'pending'::public.contribution_reminder_event_status_enum;

  if active_event_count = 0 then
    update public.contribution_reminder_batches
    set
      status = 'suppressed'::public.contribution_reminder_batch_status_enum,
      lease_token = null,
      lease_expires_at = null,
      updated_at = clock_timestamp()
    where id = p_batch_id;
    return;
  end if;

  select o.slug
  into slug_value
  from public.organizations o
  where o.id = batch_record.organization_id
    and o.organization_type = 'association'::public.organization_type_enum;

  if slug_value is null then
    update public.contribution_reminder_batches
    set
      status = 'suppressed'::public.contribution_reminder_batch_status_enum,
      last_failure_code = 'organization_unavailable',
      lease_token = null,
      lease_expires_at = null,
      updated_at = clock_timestamp()
    where id = p_batch_id;
    return;
  end if;

  update public.contribution_reminder_delivery_attempts da
  set
    status = 'terminal'::public.contribution_reminder_attempt_status_enum,
    terminal_outcome = 'token_no_longer_owned',
    lease_token = null,
    lease_expires_at = null,
    updated_at = clock_timestamp()
  where da.batch_id = p_batch_id
    and da.status in (
      'pending'::public.contribution_reminder_attempt_status_enum,
      'retryable'::public.contribution_reminder_attempt_status_enum,
      'leased'::public.contribution_reminder_attempt_status_enum
    )
    and not exists (
      select 1
      from public.push_tokens pt
      where pt.token = da.token
        and pt.profile_id = batch_record.recipient_user_id
    );

  insert into public.contribution_reminder_delivery_attempts (
    batch_id,
    push_token_id,
    token,
    language,
    status,
    next_attempt_at
  )
  select
    p_batch_id,
    pt.id,
    pt.token,
    pt.language,
    'pending'::public.contribution_reminder_attempt_status_enum,
    clock_timestamp()
  from public.push_tokens pt
  where pt.profile_id = batch_record.recipient_user_id
  on conflict on constraint contribution_reminder_delivery_attempts_batch_id_token_key
  do update
  set
    push_token_id = excluded.push_token_id,
    language = excluded.language,
    updated_at = clock_timestamp();

  select count(*)
  into token_count
  from public.push_tokens pt
  where pt.profile_id = batch_record.recipient_user_id;

  if token_count = 0 then
    update public.contribution_reminder_batches
    set
      status = 'no_device'::public.contribution_reminder_batch_status_enum,
      lease_token = null,
      lease_expires_at = null,
      updated_at = clock_timestamp()
    where id = p_batch_id;

    update public.contribution_reminder_events event_record
    set
      status = 'no_device'::public.contribution_reminder_event_status_enum,
      suppression_reason = 'no_current_device',
      updated_at = clock_timestamp()
    where event_record.id in (
      select event_id
      from public.contribution_reminder_batch_events batch_event
      where batch_event.batch_id = p_batch_id
    )
      and event_record.status = 'pending'::public.contribution_reminder_event_status_enum;
    return;
  end if;

  with candidates as (
    select da.id
    from public.contribution_reminder_delivery_attempts da
    where da.batch_id = p_batch_id
      and da.status in (
        'pending'::public.contribution_reminder_attempt_status_enum,
        'retryable'::public.contribution_reminder_attempt_status_enum,
        'leased'::public.contribution_reminder_attempt_status_enum
      )
      and (
        da.status in (
          'pending'::public.contribution_reminder_attempt_status_enum,
          'retryable'::public.contribution_reminder_attempt_status_enum
        )
        and da.next_attempt_at <= clock_timestamp()
        or da.status = 'leased'::public.contribution_reminder_attempt_status_enum
          and da.lease_expires_at < clock_timestamp()
      )
      and exists (
        select 1
        from public.push_tokens pt
        where pt.token = da.token
          and pt.profile_id = batch_record.recipient_user_id
      )
    order by da.id
    for update skip locked
  )
  update public.contribution_reminder_delivery_attempts da
  set
    status = 'leased'::public.contribution_reminder_attempt_status_enum,
    lease_token = p_lease_token,
    lease_expires_at = clock_timestamp() + lease_interval,
    attempt_count = da.attempt_count + 1,
    updated_at = clock_timestamp()
  where da.id in (select id from candidates);

  select count(*)
  into attempt_count_value
  from public.contribution_reminder_delivery_attempts da
  where da.batch_id = p_batch_id
    and da.status = 'leased'::public.contribution_reminder_attempt_status_enum
    and da.lease_token = p_lease_token;

  if attempt_count_value = 0 then
    perform public.refresh_contribution_reminder_batch(p_batch_id);
    return;
  end if;

  batch_id := p_batch_id;
  organization_slug := slug_value;
  delivery_window_on := batch_record.delivery_window_on;
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'attempt_id', da.id,
        'token', da.token,
        'language', da.language
      )
      order by da.id
    ),
    '[]'::jsonb
  )
  into delivery_attempts
  from public.contribution_reminder_delivery_attempts da
  where da.batch_id = p_batch_id
    and da.status = 'leased'::public.contribution_reminder_attempt_status_enum
    and da.lease_token = p_lease_token;
  return next;
end;
$$;

revoke all on function public.prepare_contribution_reminder_batch(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.prepare_contribution_reminder_batch(uuid, uuid, integer)
  to service_role;

create or replace function public.record_contribution_reminder_tickets(
  p_batch_id uuid,
  p_lease_token uuid,
  p_tickets jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket_record record;
  updated_count integer := 0;
  changed_count integer;
  normalized_error text;
begin
  for ticket_record in
    select *
    from jsonb_to_recordset(coalesce(p_tickets, '[]'::jsonb)) as ticket(
      attempt_id uuid,
      status text,
      expo_ticket_id text,
      error_code text
    )
  loop
    normalized_error := lower(
      replace(coalesce(ticket_record.error_code, ''), '_', '')
    );

    if ticket_record.status = 'ok'
      and nullif(ticket_record.expo_ticket_id, '') is not null then
      update public.contribution_reminder_delivery_attempts da
      set
        status = 'ticketed'::public.contribution_reminder_attempt_status_enum,
        expo_ticket_id = ticket_record.expo_ticket_id,
        expo_receipt_status = null,
        expo_receipt_error_code = null,
        terminal_outcome = null,
        lease_token = null,
        lease_expires_at = null,
        next_receipt_check_at = clock_timestamp() + interval '1 minute',
        updated_at = clock_timestamp()
      where da.id = ticket_record.attempt_id
        and da.batch_id = p_batch_id
        and da.status = 'leased'::public.contribution_reminder_attempt_status_enum
        and da.lease_token = p_lease_token;
      get diagnostics changed_count = row_count;
      updated_count := updated_count + changed_count;
    else
      update public.contribution_reminder_delivery_attempts da
      set
        status = case
          when normalized_error in (
            'toomanyrequests',
            'ratelimited',
            'messagerateexceeded',
            'serviceunavailable',
            'internalservererror',
            'timeout',
            'network'
          ) and da.attempt_count < 5
            then 'retryable'::public.contribution_reminder_attempt_status_enum
          else 'terminal'::public.contribution_reminder_attempt_status_enum
        end,
        expo_receipt_status = 'error',
        expo_receipt_error_code = nullif(ticket_record.error_code, ''),
        terminal_outcome = case
          when normalized_error = 'devicenotregistered'
            then 'device_not_registered'
          when normalized_error in (
            'toomanyrequests',
            'ratelimited',
            'messagerateexceeded',
            'serviceunavailable',
            'internalservererror',
            'timeout',
            'network'
          ) and da.attempt_count < 5 then null
          when da.attempt_count >= 5 then 'retry_exhausted'
          else 'expo_ticket_error'
        end,
        next_attempt_at = case
          when normalized_error in (
            'toomanyrequests',
            'ratelimited',
            'messagerateexceeded',
            'serviceunavailable',
            'internalservererror',
            'timeout',
            'network'
          ) and da.attempt_count < 5
            then clock_timestamp() + public.contribution_reminder_backoff(da.attempt_count)
          else da.next_attempt_at
        end,
        lease_token = null,
        lease_expires_at = null,
        updated_at = clock_timestamp()
      where da.id = ticket_record.attempt_id
        and da.batch_id = p_batch_id
        and da.status = 'leased'::public.contribution_reminder_attempt_status_enum
        and da.lease_token = p_lease_token;
      get diagnostics changed_count = row_count;
      updated_count := updated_count + changed_count;

      if normalized_error = 'devicenotregistered'
        or normalized_error = 'invalidpushtoken'
        or normalized_error = 'invalidtoken' then
        delete from public.push_tokens pt
        where exists (
          select 1
          from public.contribution_reminder_delivery_attempts da
          where da.id = ticket_record.attempt_id
            and da.batch_id = p_batch_id
            and da.token = pt.token
        );
      end if;
    end if;
  end loop;

  update public.contribution_reminder_batches
  set
    status = 'awaiting_receipts'::public.contribution_reminder_batch_status_enum,
    lease_token = null,
    lease_expires_at = null,
    updated_at = clock_timestamp()
  where id = p_batch_id
    and status = 'leased'::public.contribution_reminder_batch_status_enum;

  perform public.refresh_contribution_reminder_batch(p_batch_id);
  return updated_count;
end;
$$;

revoke all on function public.record_contribution_reminder_tickets(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_contribution_reminder_tickets(uuid, uuid, jsonb)
  to service_role;

create or replace function public.record_contribution_reminder_send_failure(
  p_batch_id uuid,
  p_lease_token uuid,
  p_failure_code text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  update public.contribution_reminder_delivery_attempts da
  set
    status = case
      when da.attempt_count < 5
        then 'retryable'::public.contribution_reminder_attempt_status_enum
      else 'terminal'::public.contribution_reminder_attempt_status_enum
    end,
    expo_receipt_status = 'send_error',
    expo_receipt_error_code = case
      when p_failure_code in ('network', 'rate_limit', 'server')
        then p_failure_code
      else 'unknown'
    end,
    terminal_outcome = case
      when da.attempt_count >= 5 then 'retry_exhausted'
      else null
    end,
    next_attempt_at = case
      when da.attempt_count < 5
        then clock_timestamp() + public.contribution_reminder_backoff(da.attempt_count)
      else da.next_attempt_at
    end,
    lease_token = null,
    lease_expires_at = null,
    updated_at = clock_timestamp()
  where da.batch_id = p_batch_id
    and da.status = 'leased'::public.contribution_reminder_attempt_status_enum
    and da.lease_token = p_lease_token;
  get diagnostics updated_count = row_count;

  update public.contribution_reminder_batches
  set
    status = 'retryable'::public.contribution_reminder_batch_status_enum,
    last_failure_code = case
      when p_failure_code in ('network', 'rate_limit', 'server') then p_failure_code
      else 'unknown'
    end,
    lease_token = null,
    lease_expires_at = null,
    updated_at = clock_timestamp()
  where id = p_batch_id
    and status = 'leased'::public.contribution_reminder_batch_status_enum;

  perform public.refresh_contribution_reminder_batch(p_batch_id);
  return updated_count;
end;
$$;

revoke all on function public.record_contribution_reminder_send_failure(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_contribution_reminder_send_failure(uuid, uuid, text)
  to service_role;

create or replace function public.claim_contribution_reminder_receipts(
  p_limit integer default 100,
  p_lease_seconds integer default 120
)
returns table (
  attempt_id uuid,
  batch_id uuid,
  lease_token uuid,
  expo_ticket_id text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_record public.contribution_reminder_delivery_attempts%rowtype;
  lease_value uuid;
  limit_value integer := greatest(1, least(coalesce(p_limit, 100), 500));
  lease_interval interval := make_interval(
    secs => greatest(30, least(coalesce(p_lease_seconds, 120), 900))
  );
begin
  for attempt_record in
    select da.*
    from public.contribution_reminder_delivery_attempts da
    join public.contribution_reminder_batches b on b.id = da.batch_id
    where b.status = 'awaiting_receipts'::public.contribution_reminder_batch_status_enum
      and (
        (
          da.status = 'ticketed'::public.contribution_reminder_attempt_status_enum
          and da.next_receipt_check_at <= clock_timestamp()
        )
        or (
          da.status = 'leased'::public.contribution_reminder_attempt_status_enum
          and da.lease_expires_at < clock_timestamp()
        )
      )
    order by da.next_receipt_check_at, da.id
    limit limit_value
    for update of da skip locked
  loop
    lease_value := gen_random_uuid();
    update public.contribution_reminder_delivery_attempts da
    set
      status = 'leased'::public.contribution_reminder_attempt_status_enum,
      lease_token = lease_value,
      lease_expires_at = clock_timestamp() + lease_interval,
      updated_at = clock_timestamp()
    where da.id = attempt_record.id;

    attempt_id := attempt_record.id;
    batch_id := attempt_record.batch_id;
    lease_token := lease_value;
    expo_ticket_id := attempt_record.expo_ticket_id;
    return next;
  end loop;
end;
$$;

revoke all on function public.claim_contribution_reminder_receipts(integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_contribution_reminder_receipts(integer, integer)
  to service_role;

create or replace function public.record_contribution_reminder_receipts(
  p_receipts jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt_record record;
  updated_count integer := 0;
  changed_count integer;
  normalized_error text;
  batch_id_value uuid;
begin
  for receipt_record in
    select *
    from jsonb_to_recordset(coalesce(p_receipts, '[]'::jsonb)) as receipt(
      attempt_id uuid,
      lease_token uuid,
      status text,
      error_code text
    )
  loop
    normalized_error := lower(
      replace(coalesce(receipt_record.error_code, ''), '_', '')
    );

    select da.batch_id
    into batch_id_value
    from public.contribution_reminder_delivery_attempts da
    where da.id = receipt_record.attempt_id
      and da.status = 'leased'::public.contribution_reminder_attempt_status_enum
      and da.lease_token = receipt_record.lease_token;

    if batch_id_value is null then
      continue;
    end if;

    if receipt_record.status = 'ok' then
      update public.contribution_reminder_delivery_attempts da
      set
        status = 'delivered'::public.contribution_reminder_attempt_status_enum,
        expo_receipt_status = 'ok',
        expo_receipt_error_code = null,
        terminal_outcome = null,
        lease_token = null,
        lease_expires_at = null,
        next_receipt_check_at = null,
        updated_at = clock_timestamp()
      where da.id = receipt_record.attempt_id
        and da.status = 'leased'::public.contribution_reminder_attempt_status_enum
        and da.lease_token = receipt_record.lease_token;
      get diagnostics changed_count = row_count;
      updated_count := updated_count + changed_count;
    else
      update public.contribution_reminder_delivery_attempts da
      set
        status = case
          when normalized_error in (
            'toomanyrequests',
            'ratelimited',
            'messagerateexceeded',
            'serviceunavailable',
            'internalservererror',
            'timeout',
            'network'
          ) and da.attempt_count < 5
            then 'retryable'::public.contribution_reminder_attempt_status_enum
          else 'terminal'::public.contribution_reminder_attempt_status_enum
        end,
        expo_receipt_status = 'error',
        expo_receipt_error_code = nullif(receipt_record.error_code, ''),
        terminal_outcome = case
          when normalized_error = 'devicenotregistered'
            then 'device_not_registered'
          when normalized_error in (
            'toomanyrequests',
            'ratelimited',
            'messagerateexceeded',
            'serviceunavailable',
            'internalservererror',
            'timeout',
            'network'
          ) and da.attempt_count < 5 then null
          when da.attempt_count >= 5 then 'retry_exhausted'
          else 'expo_receipt_error'
        end,
        next_attempt_at = case
          when normalized_error in (
            'toomanyrequests',
            'ratelimited',
            'messagerateexceeded',
            'serviceunavailable',
            'internalservererror',
            'timeout',
            'network'
          ) and da.attempt_count < 5
            then clock_timestamp() + public.contribution_reminder_backoff(da.attempt_count)
          else da.next_attempt_at
        end,
        lease_token = null,
        lease_expires_at = null,
        next_receipt_check_at = null,
        updated_at = clock_timestamp()
      where da.id = receipt_record.attempt_id
        and da.status = 'leased'::public.contribution_reminder_attempt_status_enum
        and da.lease_token = receipt_record.lease_token;
      get diagnostics changed_count = row_count;
      updated_count := updated_count + changed_count;

      if normalized_error = 'devicenotregistered'
        or normalized_error = 'invalidpushtoken'
        or normalized_error = 'invalidtoken' then
        delete from public.push_tokens pt
        where exists (
          select 1
          from public.contribution_reminder_delivery_attempts da
          where da.id = receipt_record.attempt_id
            and da.token = pt.token
        );
      end if;
    end if;

    perform public.refresh_contribution_reminder_batch(batch_id_value);
  end loop;

  return updated_count;
end;
$$;

revoke all on function public.record_contribution_reminder_receipts(jsonb)
  from public, anon, authenticated;
grant execute on function public.record_contribution_reminder_receipts(jsonb)
  to service_role;

-- The old daily-renewal-check job was removed by the recurring-obligation
-- cutover. These jobs are the only reminder recovery contract: enqueueing,
-- dispatching, and receipt reconciliation all poll the durable outbox.
do $$
begin
  if to_regclass('cron.job') is not null then
    if not exists (
      select 1 from cron.job
      where jobname = 'contribution-reminder-enqueuer'
    ) then
      perform cron.schedule(
        'contribution-reminder-enqueuer',
        '*/15 * * * *',
        $cron$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
            || '/functions/v1/contribution-reminder-enqueuer',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'secret_key'
            )
          ),
          body := '{}'::jsonb
        ) as request_id;
        $cron$
      );
    end if;

    if not exists (
      select 1 from cron.job
      where jobname = 'contribution-reminder-dispatcher'
    ) then
      perform cron.schedule(
        'contribution-reminder-dispatcher',
        '* * * * *',
        $cron$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
            || '/functions/v1/contribution-reminder-dispatcher',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'secret_key'
            )
          ),
          body := '{}'::jsonb
        ) as request_id;
        $cron$
      );
    end if;

    if not exists (
      select 1 from cron.job
      where jobname = 'contribution-reminder-receipts'
    ) then
      perform cron.schedule(
        'contribution-reminder-receipts',
        '* * * * *',
        $cron$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
            || '/functions/v1/contribution-reminder-receipts',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'secret_key'
            )
          ),
          body := '{}'::jsonb
        ) as request_id;
        $cron$
      );
    end if;
  end if;
end;
$$;
