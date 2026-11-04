CREATE OR REPLACE FUNCTION public.submit_association_application (
  p_application_id  uuid,
  p_organization_id uuid,
  p_plan_type       public.subscription_plan_type_enum,
  p_terms_version   text,
  p_draft_version   bigint
)
  RETURNS TABLE (
    application_revision_id uuid,
    obligation_id           uuid,
    organization_id         uuid,
    plan_type               public.subscription_plan_type_enum,
    amount                  integer,
    currency                text,
    payment_method          text,
    obligation_status       public.payment_obligation_status_enum,
    available_at            timestamp with time zone
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor_id uuid := auth.uid();
  draft_record public.membership_applications%rowtype;
  organization_record public.organizations%rowtype;
  revision_record public.membership_application_revisions%rowtype;
  obligation_record public.payment_obligations%rowtype;
  revision_number integer;
  plan_amount integer;
  pix_payload text;
  submission_timestamp timestamp with time zone;
  terms_accepted_timestamp timestamp with time zone;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_application_id is null
    or p_organization_id is null
    or p_plan_type is null
    or p_terms_version is null
    or p_draft_version is null
    or p_draft_version <= 0 then
    raise exception 'The application submission request is incomplete.'
      using errcode = '22023';
  end if;

  select ma.*
  into draft_record
  from public.membership_applications ma
  where ma.id = p_application_id
  for update;

  if not found then
    raise exception 'Application draft not found.' using errcode = 'P0002';
  end if;

  if draft_record.user_id <> actor_id then
    raise exception 'Application draft is not owned by the current user.'
      using errcode = '42501';
  end if;

  if draft_record.organization_id <> p_organization_id then
    raise exception 'Application draft belongs to a different organization.'
      using errcode = '42501';
  end if;

  -- The revision lookup comes before current billing validation so a retry
  -- returns the original authoritative snapshot even after configuration
  -- changes. The draft row lock serializes identical and concurrent retries.
  select mar.*
  into revision_record
  from public.membership_application_revisions mar
  where mar.application_id = p_application_id
    and mar.draft_version = p_draft_version
  for update;

  if found then
    if revision_record.plan_type <> p_plan_type
      or revision_record.terms_version <> p_terms_version then
      raise exception 'The application was already submitted with different terms or plan.'
        using errcode = '40001';
    end if;

    select po.*
    into obligation_record
    from public.payment_obligations po
    where po.application_revision_id = revision_record.id
      and po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
    for update;

    if not found then
      insert into public.payment_obligations (
        organization_id,
        user_id,
        application_revision_id,
        purpose,
        status,
        plan_type,
        amount,
        currency,
        payment_method,
        pix_copy_paste,
        available_at
      )
      values (
        revision_record.organization_id,
        revision_record.user_id,
        revision_record.id,
        'initial_admission'::public.payment_obligation_purpose_enum,
        'available'::public.payment_obligation_status_enum,
        revision_record.plan_type,
        revision_record.plan_amount,
        revision_record.currency,
        'manual_pix',
        revision_record.pix_copy_paste,
        revision_record.submitted_at
      )
      returning * into obligation_record;
    end if;

    return query
    select
      revision_record.id,
      obligation_record.id,
      obligation_record.organization_id,
      obligation_record.plan_type,
      obligation_record.amount,
      obligation_record.currency,
      obligation_record.payment_method,
      obligation_record.status,
      obligation_record.available_at;
    return;
  end if;

  select o.*
  into organization_record
  from public.organizations o
  where o.id = p_organization_id
  for update;

  if not found then
    raise exception 'Association not found.' using errcode = 'P0002';
  end if;

  if organization_record.organization_type <> 'association'::public.organization_type_enum then
    raise exception 'Applications can only be submitted to associations.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.organization_members om
    where om.organization_id = organization_record.id
      and om.user_id = actor_id
  ) then
    raise exception 'The current person is already associated with this organization.'
      using errcode = '23505';
  end if;

  if p_terms_version <> organization_record.membership_terms_version then
    raise exception 'The association terms have changed. Review and accept the current terms.'
      using errcode = '40001';
  end if;

  if draft_record.draft_version <> p_draft_version then
    raise exception 'The application draft changed. Refresh and try again.'
      using errcode = '40001';
  end if;

  if draft_record.status <> 'draft'::public.membership_application_status_enum
    and draft_record.status <> 'submitted'::public.membership_application_status_enum then
    raise exception 'The application draft is not submittable.' using errcode = '23514';
  end if;

  if nullif(btrim(draft_record.full_name), '') is null
    or draft_record.birth_date is null
    or nullif(btrim(draft_record.nationality), '') is null
    or draft_record.marital_status is null
    or nullif(btrim(draft_record.profession), '') is null
    or nullif(btrim(draft_record.birthplace), '') is null
    or nullif(btrim(draft_record.cpf), '') is null
    or btrim(draft_record.cpf) !~ '^[0-9]{11}$'
    or nullif(btrim(draft_record.id_document_number), '') is null
    or nullif(btrim(draft_record.id_document_issuer), '') is null
    or nullif(btrim(draft_record.postal_code), '') is null
    or btrim(draft_record.postal_code) !~ '^[0-9]{8}$'
    or nullif(btrim(draft_record.address_line), '') is null
    or nullif(btrim(draft_record.city), '') is null
    or nullif(btrim(draft_record.state), '') is null
    or nullif(btrim(draft_record.email), '') is null
    or btrim(draft_record.email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or nullif(btrim(draft_record.phone), '') is null
    or btrim(draft_record.phone) !~ '^[0-9]{10,11}$'
    or draft_record.accepted_terms_at is null
    or draft_record.has_allergies is null
    or (draft_record.has_allergies
      and nullif(btrim(draft_record.allergies), '') is null)
    or draft_record.has_dietary_restrictions is null
    or (draft_record.has_dietary_restrictions
      and nullif(btrim(draft_record.dietary_restrictions), '') is null)
    or draft_record.highline_experience is null
    or draft_record.has_rescue_course is null
    or draft_record.first_aid_course is null
    or nullif(btrim(draft_record.emergency_contact_name), '') is null
    or nullif(btrim(draft_record.emergency_contact_relationship), '') is null
    or nullif(btrim(draft_record.emergency_contact_phone), '') is null
    or btrim(draft_record.emergency_contact_phone) !~ '^[0-9]{10,11}$' then
    raise exception 'Complete all required application fields before submitting.'
      using errcode = '23514';
  end if;

  plan_amount = case p_plan_type
    when 'annual'::public.subscription_plan_type_enum then organization_record.annual_price_amount
    else organization_record.monthly_price_amount
  end;

  pix_payload = case p_plan_type
    when 'annual'::public.subscription_plan_type_enum then organization_record.annual_pix_copy_paste
    else organization_record.monthly_pix_copy_paste
  end;

  if plan_amount is null or plan_amount <= 0
    or nullif(btrim(organization_record.billing_currency), '') is null
    or organization_record.billing_currency !~ '^[A-Z]{3}$'
    or nullif(btrim(pix_payload), '') is null then
    raise exception 'The association payment configuration is incomplete.'
      using errcode = '23514';
  end if;

  terms_accepted_timestamp = timezone('utc'::text, clock_timestamp());
  submission_timestamp = timezone('utc'::text, clock_timestamp());

  select coalesce(max(mar.revision_number), 0) + 1
  into revision_number
  from public.membership_application_revisions mar
  where mar.application_id = p_application_id;

  insert into public.membership_application_revisions (
    application_id,
    organization_id,
    user_id,
    revision_number,
    draft_version,
    plan_type,
    terms_version,
    accepted_terms_at,
    submitted_at,
    full_name,
    birth_date,
    nationality,
    marital_status,
    profession,
    birthplace,
    cpf,
    id_document_number,
    id_document_issuer,
    postal_code,
    address_line,
    city,
    state,
    email,
    phone,
    blood_type,
    has_allergies,
    allergies,
    has_dietary_restrictions,
    dietary_restrictions,
    highline_experience,
    has_rescue_course,
    first_aid_course,
    emergency_contact_name,
    emergency_contact_relationship,
    emergency_contact_phone,
    plan_amount,
    currency,
    pix_copy_paste
  )
  values (
    p_application_id,
    p_organization_id,
    actor_id,
    revision_number,
    p_draft_version,
    p_plan_type,
    p_terms_version,
    terms_accepted_timestamp,
    submission_timestamp,
    draft_record.full_name,
    draft_record.birth_date,
    draft_record.nationality,
    draft_record.marital_status,
    draft_record.profession,
    draft_record.birthplace,
    draft_record.cpf,
    draft_record.id_document_number,
    draft_record.id_document_issuer,
    draft_record.postal_code,
    draft_record.address_line,
    draft_record.city,
    draft_record.state,
    draft_record.email,
    draft_record.phone,
    draft_record.blood_type,
    draft_record.has_allergies,
    draft_record.allergies,
    draft_record.has_dietary_restrictions,
    draft_record.dietary_restrictions,
    draft_record.highline_experience,
    draft_record.has_rescue_course,
    draft_record.first_aid_course,
    draft_record.emergency_contact_name,
    draft_record.emergency_contact_relationship,
    draft_record.emergency_contact_phone,
    plan_amount,
    organization_record.billing_currency,
    pix_payload
  )
  returning * into revision_record;

  insert into public.payment_obligations (
    organization_id,
    user_id,
    application_revision_id,
    purpose,
    status,
    plan_type,
    amount,
    currency,
    payment_method,
    pix_copy_paste,
    available_at
  )
  values (
    p_organization_id,
    actor_id,
    revision_record.id,
    'initial_admission'::public.payment_obligation_purpose_enum,
    'available'::public.payment_obligation_status_enum,
    p_plan_type,
    plan_amount,
    organization_record.billing_currency,
    'manual_pix',
    pix_payload,
    submission_timestamp
  )
  returning * into obligation_record;

  if draft_record.status = 'draft'::public.membership_application_status_enum then
    update public.membership_applications ma
    set
      status = 'submitted'::public.membership_application_status_enum,
      submitted_at = submission_timestamp
    where ma.id = p_application_id;
  end if;

  return query
  select
    revision_record.id,
    obligation_record.id,
    obligation_record.organization_id,
    obligation_record.plan_type,
    obligation_record.amount,
    obligation_record.currency,
    obligation_record.payment_method,
    obligation_record.status,
    obligation_record.available_at;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."submit_association_application"(uuid, uuid, public.subscription_plan_type_enum, text, bigint) TO "authenticated";

COMMENT ON FUNCTION "public"."submit_association_application"(uuid, uuid, public.subscription_plan_type_enum, text, bigint) IS 'Atomically snapshots an authenticated association application and creates exactly one initial manual-PIX obligation. Returns no personal application fields.';

REVOKE ALL ON FUNCTION "public"."submit_association_application"(uuid, uuid, public.subscription_plan_type_enum, text, bigint) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."submit_association_application"(uuid, uuid, public.subscription_plan_type_enum, text, bigint) TO "postgres";

REVOKE ALL ON FUNCTION "public"."submit_association_application"(uuid, uuid, public.subscription_plan_type_enum, text, bigint) FROM PUBLIC, "anon", "service_role";
