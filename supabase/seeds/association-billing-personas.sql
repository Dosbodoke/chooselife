-- Login-ready local scenarios for the association application and billing flows.
-- Applied after ../seed.sql by `supabase db reset`.

-- Complete the local SL.A.C billing policy used by every scenario below.
update public.organizations
set
  organization_type = 'association'::public.organization_type_enum,
  membership_terms_version = 'estatuto-local-v1',
  billing_currency = 'BRL',
  billing_timezone = 'America/Sao_Paulo',
  billing_due_day = 10,
  billing_lead_days = 7,
  monthly_price_amount = 3500,
  annual_price_amount = 36000,
  monthly_pix_copy_paste = '000201LOCAL-SLAC-MONTHLY-PIX',
  annual_pix_copy_paste = '000201LOCAL-SLAC-ANNUAL-PIX'
where id = '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid;

-- Password login users. The auth trigger creates the matching profile rows.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  persona.id,
  'authenticated',
  'authenticated',
  persona.email,
  extensions.crypt('LocalTest123!', extensions.gen_salt('bf')),
  timezone('utc'::text, now()),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', persona.display_name),
  timezone('utc'::text, now()),
  timezone('utc'::text, now()),
  '',
  '',
  '',
  ''
from (
  values
    ('c1fe0000-0000-4000-8000-000000000001'::uuid, 'admin@chooselife.local', 'Admin SL.A.C'),
    ('c1fe0000-0000-4000-8000-000000000002'::uuid, 'new@chooselife.local', 'Novo Sem Cadastro'),
    ('c1fe0000-0000-4000-8000-000000000003'::uuid, 'draft@chooselife.local', 'Aplicação Rascunho'),
    ('c1fe0000-0000-4000-8000-000000000004'::uuid, 'awaiting-payment@chooselife.local', 'Aguardando Pagamento'),
    ('c1fe0000-0000-4000-8000-000000000005'::uuid, 'initial-review@chooselife.local', 'Pagamento Em Análise'),
    ('c1fe0000-0000-4000-8000-000000000006'::uuid, 'claim-rejected@chooselife.local', 'Pagamento Rejeitado'),
    ('c1fe0000-0000-4000-8000-000000000007'::uuid, 'monthly-current@chooselife.local', 'Mensal Em Dia'),
    ('c1fe0000-0000-4000-8000-000000000008'::uuid, 'monthly-overdue@chooselife.local', 'Mensal Em Atraso'),
    ('c1fe0000-0000-4000-8000-000000000009'::uuid, 'annual-current@chooselife.local', 'Anual Em Dia'),
    ('c1fe0000-0000-4000-8000-000000000010'::uuid, 'recurring-review@chooselife.local', 'Recorrência Em Análise'),
    ('c1fe0000-0000-4000-8000-000000000011'::uuid, 'ex-member@chooselife.local', 'Ex Membro')
) as persona(id, email, display_name);

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  md5(persona.email)::uuid,
  persona.id::text,
  persona.id,
  jsonb_build_object('sub', persona.id::text, 'email', persona.email, 'email_verified', true),
  'email',
  timezone('utc'::text, now()),
  timezone('utc'::text, now()),
  timezone('utc'::text, now())
from (
  values
    ('c1fe0000-0000-4000-8000-000000000001'::uuid, 'admin@chooselife.local'),
    ('c1fe0000-0000-4000-8000-000000000002'::uuid, 'new@chooselife.local'),
    ('c1fe0000-0000-4000-8000-000000000003'::uuid, 'draft@chooselife.local'),
    ('c1fe0000-0000-4000-8000-000000000004'::uuid, 'awaiting-payment@chooselife.local'),
    ('c1fe0000-0000-4000-8000-000000000005'::uuid, 'initial-review@chooselife.local'),
    ('c1fe0000-0000-4000-8000-000000000006'::uuid, 'claim-rejected@chooselife.local'),
    ('c1fe0000-0000-4000-8000-000000000007'::uuid, 'monthly-current@chooselife.local'),
    ('c1fe0000-0000-4000-8000-000000000008'::uuid, 'monthly-overdue@chooselife.local'),
    ('c1fe0000-0000-4000-8000-000000000009'::uuid, 'annual-current@chooselife.local'),
    ('c1fe0000-0000-4000-8000-000000000010'::uuid, 'recurring-review@chooselife.local'),
    ('c1fe0000-0000-4000-8000-000000000011'::uuid, 'ex-member@chooselife.local')
) as persona(id, email);

insert into public.profiles (id, name, username, description, birthday)
values
  ('c1fe0000-0000-4000-8000-000000000001', 'Admin SL.A.C', '@seed_admin_slac', 'Administração local da associação.', '1988-04-12'),
  ('c1fe0000-0000-4000-8000-000000000002', 'Novo Sem Cadastro', '@seed_novo', 'Conta limpa para testar o onboarding completo.', '1998-07-22'),
  ('c1fe0000-0000-4000-8000-000000000003', 'Aplicação Rascunho', '@seed_rascunho', 'Formulário salvo pela metade.', '1996-02-14'),
  ('c1fe0000-0000-4000-8000-000000000004', 'Aguardando Pagamento', '@seed_aguarda_pix', 'Inscrição enviada; PIX inicial disponível.', '1994-09-03'),
  ('c1fe0000-0000-4000-8000-000000000005', 'Pagamento Em Análise', '@seed_analise_inicial', 'Comprovante inicial aguardando revisão.', '1992-11-19'),
  ('c1fe0000-0000-4000-8000-000000000006', 'Pagamento Rejeitado', '@seed_rejeitado', 'Pagamento inicial rejeitado e pronto para reenvio.', '1990-06-08'),
  ('c1fe0000-0000-4000-8000-000000000007', 'Mensal Em Dia', '@seed_mensal_em_dia', 'Mensalista com histórico quitado.', '1997-01-25'),
  ('c1fe0000-0000-4000-8000-000000000008', 'Mensal Em Atraso', '@seed_mensal_atraso', 'Mensalista com contribuição vencida.', '1989-08-17'),
  ('c1fe0000-0000-4000-8000-000000000009', 'Anual Em Dia', '@seed_anual_em_dia', 'Plano anual com dois anos de histórico.', '1993-03-30'),
  ('c1fe0000-0000-4000-8000-000000000010', 'Recorrência Em Análise', '@seed_recorrencia', 'Pagamento recorrente feito por terceiro.', '1995-12-05'),
  ('c1fe0000-0000-4000-8000-000000000011', 'Ex Membro', '@seed_ex_membro', 'Saiu da associação depois de um ano de contribuições.', '1991-05-11')
on conflict (id) do update
set
  name = excluded.name,
  username = excluded.username,
  description = excluded.description,
  birthday = excluded.birthday;

-- One draft and three submitted applications.
insert into public.membership_applications (
  id,
  organization_id,
  user_id,
  status,
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
  accepted_terms_at,
  submitted_at,
  draft_version,
  created_at,
  updated_at
)
select
  persona.application_id,
  '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
  persona.user_id,
  persona.status::public.membership_application_status_enum,
  persona.display_name,
  persona.birth_date,
  'Brasileira',
  'single'::public.marital_status_enum,
  persona.profession,
  'São Paulo, SP',
  persona.cpf,
  persona.document_number,
  'SSP/SP',
  '01310-100',
  'Avenida Paulista, 1000',
  'São Paulo',
  'SP',
  persona.email,
  '+5511999990000',
  'o_pos'::public.blood_type_enum,
  false,
  null,
  false,
  null,
  'athlete'::public.highline_experience_enum,
  true,
  'updated'::public.first_aid_course_enum,
  'Contato Local',
  'Amizade',
  '+5511988880000',
  case when persona.status = 'submitted' then timezone('utc'::text, now()) - interval '5 days' end,
  case when persona.status = 'submitted' then timezone('utc'::text, now()) - interval '4 days' end,
  1,
  timezone('utc'::text, now()) - interval '6 days',
  timezone('utc'::text, now()) - interval '4 days'
from (
  values
    ('c1fe0000-0000-4000-8000-000000000103'::uuid, 'c1fe0000-0000-4000-8000-000000000003'::uuid, 'draft', 'Aplicação Rascunho', '1996-02-14'::date, 'Instrutora de escalada', 'draft@chooselife.local', '000.000.003-53', 'LOCAL-003'),
    ('c1fe0000-0000-4000-8000-000000000104'::uuid, 'c1fe0000-0000-4000-8000-000000000004'::uuid, 'submitted', 'Aguardando Pagamento', '1994-09-03'::date, 'Fotógrafa', 'awaiting-payment@chooselife.local', '000.000.004-34', 'LOCAL-004'),
    ('c1fe0000-0000-4000-8000-000000000105'::uuid, 'c1fe0000-0000-4000-8000-000000000005'::uuid, 'submitted', 'Pagamento Em Análise', '1992-11-19'::date, 'Fisioterapeuta', 'initial-review@chooselife.local', '000.000.005-15', 'LOCAL-005'),
    ('c1fe0000-0000-4000-8000-000000000106'::uuid, 'c1fe0000-0000-4000-8000-000000000006'::uuid, 'submitted', 'Pagamento Rejeitado', '1990-06-08'::date, 'Engenheiro', 'claim-rejected@chooselife.local', '000.000.006-04', 'LOCAL-006')
) as persona(application_id, user_id, status, display_name, birth_date, profession, email, cpf, document_number);

insert into public.membership_application_revisions (
  id,
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
  pix_copy_paste,
  created_at
)
select
  persona.revision_id,
  persona.application_id,
  '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
  persona.user_id,
  1,
  1,
  persona.plan_type::public.subscription_plan_type_enum,
  'estatuto-local-v1',
  timezone('utc'::text, now()) - interval '5 days',
  timezone('utc'::text, now()) - interval '4 days',
  profile.name,
  profile.birthday,
  'Brasileira',
  'single'::public.marital_status_enum,
  'Profissional de aventura',
  'São Paulo, SP',
  persona.cpf,
  persona.document_number,
  'SSP/SP',
  '01310-100',
  'Avenida Paulista, 1000',
  'São Paulo',
  'SP',
  persona.email,
  '+5511999990000',
  'o_pos'::public.blood_type_enum,
  false,
  null,
  false,
  null,
  'athlete'::public.highline_experience_enum,
  true,
  'updated'::public.first_aid_course_enum,
  'Contato Local',
  'Amizade',
  '+5511988880000',
  case when persona.plan_type = 'annual' then 36000 else 3500 end,
  'BRL',
  case when persona.plan_type = 'annual' then '000201LOCAL-SLAC-ANNUAL-PIX' else '000201LOCAL-SLAC-MONTHLY-PIX' end,
  timezone('utc'::text, now()) - interval '4 days'
from (
  values
    ('c1fe0000-0000-4000-8000-000000000204'::uuid, 'c1fe0000-0000-4000-8000-000000000104'::uuid, 'c1fe0000-0000-4000-8000-000000000004'::uuid, 'monthly', 'awaiting-payment@chooselife.local', '000.000.004-34', 'LOCAL-004'),
    ('c1fe0000-0000-4000-8000-000000000205'::uuid, 'c1fe0000-0000-4000-8000-000000000105'::uuid, 'c1fe0000-0000-4000-8000-000000000005'::uuid, 'monthly', 'initial-review@chooselife.local', '000.000.005-15', 'LOCAL-005'),
    ('c1fe0000-0000-4000-8000-000000000206'::uuid, 'c1fe0000-0000-4000-8000-000000000106'::uuid, 'c1fe0000-0000-4000-8000-000000000006'::uuid, 'annual', 'claim-rejected@chooselife.local', '000.000.006-04', 'LOCAL-006')
) as persona(revision_id, application_id, user_id, plan_type, email, cpf, document_number)
join public.profiles profile on profile.id = persona.user_id;

-- Initial admission obligations and claim states.
insert into public.payment_obligations (
  id,
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
  available_at,
  period_key,
  period_start,
  period_end,
  available_on,
  due_on,
  created_at
)
select
  persona.obligation_id,
  '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
  persona.user_id,
  persona.revision_id,
  'initial_admission'::public.payment_obligation_purpose_enum,
  'available'::public.payment_obligation_status_enum,
  persona.plan_type::public.subscription_plan_type_enum,
  case when persona.plan_type = 'annual' then 36000 else 3500 end,
  'BRL',
  'manual_pix',
  case when persona.plan_type = 'annual' then '000201LOCAL-SLAC-ANNUAL-PIX' else '000201LOCAL-SLAC-MONTHLY-PIX' end,
  (timezone('America/Sao_Paulo', now())::date - 4)::timestamp at time zone 'America/Sao_Paulo',
  'initial',
  timezone('America/Sao_Paulo', now())::date - 4,
  timezone('America/Sao_Paulo', now())::date - 4,
  timezone('America/Sao_Paulo', now())::date - 4,
  timezone('America/Sao_Paulo', now())::date - 4,
  timezone('utc'::text, now()) - interval '4 days'
from (
  values
    ('c1fe0000-0000-4000-8000-000000000304'::uuid, 'c1fe0000-0000-4000-8000-000000000004'::uuid, 'c1fe0000-0000-4000-8000-000000000204'::uuid, 'monthly'),
    ('c1fe0000-0000-4000-8000-000000000305'::uuid, 'c1fe0000-0000-4000-8000-000000000005'::uuid, 'c1fe0000-0000-4000-8000-000000000205'::uuid, 'monthly'),
    ('c1fe0000-0000-4000-8000-000000000306'::uuid, 'c1fe0000-0000-4000-8000-000000000006'::uuid, 'c1fe0000-0000-4000-8000-000000000206'::uuid, 'annual')
) as persona(obligation_id, user_id, revision_id, plan_type);

insert into public.payment_claims (
  id,
  obligation_id,
  organization_id,
  claimant_user_id,
  payer_type,
  payer_name,
  status,
  created_at,
  decided_at,
  decision_reason
)
values
  (
    'c1fe0000-0000-4000-8000-000000000405',
    'c1fe0000-0000-4000-8000-000000000305',
    '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1',
    'c1fe0000-0000-4000-8000-000000000005',
    'applicant',
    null,
    'under_review',
    timezone('utc'::text, now()) - interval '2 days',
    null,
    null
  ),
  (
    'c1fe0000-0000-4000-8000-000000000406',
    'c1fe0000-0000-4000-8000-000000000306',
    '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1',
    'c1fe0000-0000-4000-8000-000000000006',
    'other',
    'Pessoa Pagadora Local',
    'rejected',
    timezone('utc'::text, now()) - interval '3 days',
    timezone('utc'::text, now()) - interval '1 day',
    'Valor não identificado no extrato local.'
  );

-- The refusal is one atomic outcome: application refused, claim rejected,
-- obligation void. The rows above are inserted directly rather than through
-- reject_initial_claim, so the other two halves are applied here -- otherwise
-- this persona would sit in a state the command can never produce.
update public.payment_obligations
set status = 'void'::public.payment_obligation_status_enum
where id = 'c1fe0000-0000-4000-8000-000000000306'::uuid;

update public.membership_applications
set status = 'refused'::public.membership_application_status_enum
where id = 'c1fe0000-0000-4000-8000-000000000106'::uuid;

insert into public.payment_claim_audit_events (
  id,
  organization_id,
  obligation_id,
  claim_id,
  actor_user_id,
  previous_state,
  next_state,
  reason,
  created_at
)
values
  ('c1fe0000-0000-4000-8000-000000000505', '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1', 'c1fe0000-0000-4000-8000-000000000305', 'c1fe0000-0000-4000-8000-000000000405', 'c1fe0000-0000-4000-8000-000000000005', 'payment_available', 'under_review', null, timezone('utc'::text, now()) - interval '2 days'),
  ('c1fe0000-0000-4000-8000-000000000506', '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1', 'c1fe0000-0000-4000-8000-000000000306', 'c1fe0000-0000-4000-8000-000000000406', 'c1fe0000-0000-4000-8000-000000000006', 'payment_available', 'under_review', null, timezone('utc'::text, now()) - interval '3 days'),
  ('c1fe0000-0000-4000-8000-000000000507', '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1', 'c1fe0000-0000-4000-8000-000000000306', 'c1fe0000-0000-4000-8000-000000000406', 'c1fe0000-0000-4000-8000-000000000001', 'under_review', 'payment_available', 'Valor não identificado no extrato local.', timezone('utc'::text, now()) - interval '1 day');

-- Active members get deterministic schedules with stable IDs. Membership rows
-- are inserted afterwards so the production trigger still runs.
insert into public.contribution_schedules (
  id,
  organization_id,
  user_id,
  cadence,
  admission_date,
  due_day,
  lead_days,
  billing_timezone,
  currency,
  active
)
values
  ('c1fe0000-0000-4000-8000-000000000707', '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1', 'c1fe0000-0000-4000-8000-000000000007', 'monthly', timezone('America/Sao_Paulo', now())::date - 365, 10, 7, 'America/Sao_Paulo', 'BRL', true),
  ('c1fe0000-0000-4000-8000-000000000708', '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1', 'c1fe0000-0000-4000-8000-000000000008', 'monthly', timezone('America/Sao_Paulo', now())::date - 365, 10, 7, 'America/Sao_Paulo', 'BRL', true),
  ('c1fe0000-0000-4000-8000-000000000709', '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1', 'c1fe0000-0000-4000-8000-000000000009', 'annual', timezone('America/Sao_Paulo', now())::date - 730, 10, 7, 'America/Sao_Paulo', 'BRL', true),
  ('c1fe0000-0000-4000-8000-000000000710', '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1', 'c1fe0000-0000-4000-8000-000000000010', 'monthly', timezone('America/Sao_Paulo', now())::date - 365, 10, 7, 'America/Sao_Paulo', 'BRL', true);

insert into public.contribution_plan_assignments (
  id,
  schedule_id,
  effective_period_start,
  plan_type,
  amount,
  currency,
  due_day,
  lead_days,
  billing_timezone,
  pix_copy_paste
)
select
  assignment.id,
  assignment.schedule_id,
  schedule.admission_date,
  assignment.plan_type::public.subscription_plan_type_enum,
  case when assignment.plan_type = 'annual' then 36000 else 3500 end,
  'BRL',
  10,
  7,
  'America/Sao_Paulo',
  case when assignment.plan_type = 'annual' then '000201LOCAL-SLAC-ANNUAL-PIX' else '000201LOCAL-SLAC-MONTHLY-PIX' end
from (
  values
    ('c1fe0000-0000-4000-8000-000000000807'::uuid, 'c1fe0000-0000-4000-8000-000000000707'::uuid, 'monthly'),
    ('c1fe0000-0000-4000-8000-000000000808'::uuid, 'c1fe0000-0000-4000-8000-000000000708'::uuid, 'monthly'),
    ('c1fe0000-0000-4000-8000-000000000809'::uuid, 'c1fe0000-0000-4000-8000-000000000709'::uuid, 'annual'),
    ('c1fe0000-0000-4000-8000-000000000810'::uuid, 'c1fe0000-0000-4000-8000-000000000710'::uuid, 'monthly')
) as assignment(id, schedule_id, plan_type)
join public.contribution_schedules schedule on schedule.id = assignment.schedule_id;

insert into public.organization_members (organization_id, user_id, role, joined_at)
values
  ('2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1', 'c1fe0000-0000-4000-8000-000000000001', 'admin', timezone('utc'::text, now()) - interval '3 years'),
  ('2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1', 'c1fe0000-0000-4000-8000-000000000007', 'member', timezone('utc'::text, now()) - interval '1 year'),
  ('2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1', 'c1fe0000-0000-4000-8000-000000000008', 'member', timezone('utc'::text, now()) - interval '1 year'),
  ('2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1', 'c1fe0000-0000-4000-8000-000000000009', 'member', timezone('utc'::text, now()) - interval '2 years'),
  ('2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1', 'c1fe0000-0000-4000-8000-000000000010', 'member', timezone('utc'::text, now()) - interval '1 year');

-- An ex-member: the membership row is gone, the departure journal keeps the
-- relationship visible, and the retired schedule stops minting new periods.
insert into public.contribution_schedules (
  id,
  organization_id,
  user_id,
  cadence,
  admission_date,
  due_day,
  lead_days,
  billing_timezone,
  currency,
  active
)
values
  ('c1fe0000-0000-4000-8000-000000000711', '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1', 'c1fe0000-0000-4000-8000-000000000011', 'monthly', timezone('America/Sao_Paulo', now())::date - 400, 10, 7, 'America/Sao_Paulo', 'BRL', false);

insert into public.contribution_plan_assignments (
  id,
  schedule_id,
  effective_period_start,
  plan_type,
  amount,
  currency,
  due_day,
  lead_days,
  billing_timezone,
  pix_copy_paste
)
select
  'c1fe0000-0000-4000-8000-000000000811'::uuid,
  schedule.id,
  schedule.admission_date,
  'monthly'::public.subscription_plan_type_enum,
  3500,
  'BRL',
  10,
  7,
  'America/Sao_Paulo',
  '000201LOCAL-SLAC-MONTHLY-PIX'
from public.contribution_schedules schedule
where schedule.id = 'c1fe0000-0000-4000-8000-000000000711'::uuid;

insert into public.organization_membership_departures (
  id,
  organization_id,
  user_id,
  departed_role,
  joined_at,
  departed_at,
  actor_user_id,
  reason
)
values
  (
    'c1fe0000-0000-4000-8000-000000000911',
    '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1',
    'c1fe0000-0000-4000-8000-000000000011',
    'member',
    timezone('utc'::text, now()) - interval '14 months',
    timezone('utc'::text, now()) - interval '2 months',
    'c1fe0000-0000-4000-8000-000000000011',
    'Mudou de cidade.'
  );

-- Twelve settled monthly periods for the up-to-date persona.
insert into public.payment_obligations (
  id, organization_id, user_id, purpose, status, plan_type, amount, currency,
  payment_method, pix_copy_paste, available_at, settled_at, schedule_id,
  period_key, period_start, period_end, available_on, due_on, schedule_term_id,
  created_at
)
select
  md5('seed-monthly-current-' || month_offset)::uuid,
  '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
  'c1fe0000-0000-4000-8000-000000000007'::uuid,
  'recurring',
  'settled',
  'monthly',
  3500,
  'BRL',
  'manual_pix',
  '000201LOCAL-SLAC-MONTHLY-PIX',
  (due_on - 7)::timestamp at time zone 'America/Sao_Paulo',
  (due_on - 2)::timestamp at time zone 'America/Sao_Paulo',
  'c1fe0000-0000-4000-8000-000000000707'::uuid,
  public.recurring_period_key('monthly', due_on),
  date_trunc('month', due_on)::date,
  (date_trunc('month', due_on) + interval '1 month - 1 day')::date,
  due_on - 7,
  due_on,
  'c1fe0000-0000-4000-8000-000000000807'::uuid,
  (due_on - 7)::timestamp at time zone 'America/Sao_Paulo'
from generate_series(0, 11) as series(month_offset)
cross join lateral (
  select (date_trunc('month', timezone('America/Sao_Paulo', now())::date) - make_interval(months => series.month_offset) + interval '9 days')::date as due_on
) dates;

-- Historical monthly rows plus one deliberately overdue obligation.
insert into public.payment_obligations (
  id, organization_id, user_id, purpose, status, plan_type, amount, currency,
  payment_method, pix_copy_paste, available_at, settled_at, schedule_id,
  period_key, period_start, period_end, available_on, due_on, schedule_term_id,
  created_at
)
select
  md5('seed-monthly-overdue-history-' || month_offset)::uuid,
  '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
  'c1fe0000-0000-4000-8000-000000000008'::uuid,
  'recurring',
  'settled',
  'monthly',
  3500,
  'BRL',
  'manual_pix',
  '000201LOCAL-SLAC-MONTHLY-PIX',
  (due_on - 7)::timestamp at time zone 'America/Sao_Paulo',
  (due_on - 1)::timestamp at time zone 'America/Sao_Paulo',
  'c1fe0000-0000-4000-8000-000000000708'::uuid,
  public.recurring_period_key('monthly', due_on),
  date_trunc('month', due_on)::date,
  (date_trunc('month', due_on) + interval '1 month - 1 day')::date,
  due_on - 7,
  due_on,
  'c1fe0000-0000-4000-8000-000000000808'::uuid,
  (due_on - 7)::timestamp at time zone 'America/Sao_Paulo'
from generate_series(2, 12) as series(month_offset)
cross join lateral (
  select (date_trunc('month', timezone('America/Sao_Paulo', now())::date) - make_interval(months => series.month_offset) + interval '9 days')::date as due_on
) dates;

insert into public.payment_obligations (
  id, organization_id, user_id, purpose, status, plan_type, amount, currency,
  payment_method, pix_copy_paste, available_at, schedule_id, period_key,
  period_start, period_end, available_on, due_on, schedule_term_id, created_at
)
values (
  'c1fe0000-0000-4000-8000-000000000908',
  '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1',
  'c1fe0000-0000-4000-8000-000000000008',
  'recurring',
  'available',
  'monthly',
  3500,
  'BRL',
  'manual_pix',
  '000201LOCAL-SLAC-MONTHLY-PIX',
  (timezone('America/Sao_Paulo', now())::date - 27)::timestamp at time zone 'America/Sao_Paulo',
  'c1fe0000-0000-4000-8000-000000000708',
  'seed:monthly-overdue',
  timezone('America/Sao_Paulo', now())::date - 50,
  timezone('America/Sao_Paulo', now())::date - 20,
  timezone('America/Sao_Paulo', now())::date - 27,
  timezone('America/Sao_Paulo', now())::date - 20,
  'c1fe0000-0000-4000-8000-000000000808',
  timezone('utc'::text, now()) - interval '27 days'
);

-- Two settled annual periods and one future scheduled period.
insert into public.payment_obligations (
  id, organization_id, user_id, purpose, status, plan_type, amount, currency,
  payment_method, pix_copy_paste, available_at, settled_at, schedule_id,
  period_key, period_start, period_end, available_on, due_on, schedule_term_id,
  created_at
)
select
  md5('seed-annual-current-' || year_offset)::uuid,
  '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
  'c1fe0000-0000-4000-8000-000000000009'::uuid,
  'recurring',
  'settled',
  'annual',
  36000,
  'BRL',
  'manual_pix',
  '000201LOCAL-SLAC-ANNUAL-PIX',
  (due_on - 7)::timestamp at time zone 'America/Sao_Paulo',
  (due_on - 3)::timestamp at time zone 'America/Sao_Paulo',
  'c1fe0000-0000-4000-8000-000000000709'::uuid,
  public.recurring_period_key('annual', due_on),
  (due_on - interval '1 year' + interval '1 day')::date,
  due_on,
  due_on - 7,
  due_on,
  'c1fe0000-0000-4000-8000-000000000809'::uuid,
  (due_on - 7)::timestamp at time zone 'America/Sao_Paulo'
from generate_series(0, 1) as series(year_offset)
cross join lateral (
  select ((timezone('America/Sao_Paulo', now())::date - make_interval(years => series.year_offset))::date - 30) as due_on
) dates;

-- Eleven settled periods plus the actionable recurring claim.
insert into public.payment_obligations (
  id, organization_id, user_id, purpose, status, plan_type, amount, currency,
  payment_method, pix_copy_paste, available_at, settled_at, schedule_id,
  period_key, period_start, period_end, available_on, due_on, schedule_term_id,
  created_at
)
select
  md5('seed-recurring-review-history-' || month_offset)::uuid,
  '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1'::uuid,
  'c1fe0000-0000-4000-8000-000000000010'::uuid,
  'recurring',
  'settled',
  'monthly',
  3500,
  'BRL',
  'manual_pix',
  '000201LOCAL-SLAC-MONTHLY-PIX',
  (due_on - 7)::timestamp at time zone 'America/Sao_Paulo',
  (due_on - 2)::timestamp at time zone 'America/Sao_Paulo',
  'c1fe0000-0000-4000-8000-000000000710'::uuid,
  public.recurring_period_key('monthly', due_on),
  date_trunc('month', due_on)::date,
  (date_trunc('month', due_on) + interval '1 month - 1 day')::date,
  due_on - 7,
  due_on,
  'c1fe0000-0000-4000-8000-000000000810'::uuid,
  (due_on - 7)::timestamp at time zone 'America/Sao_Paulo'
from generate_series(1, 11) as series(month_offset)
cross join lateral (
  select (date_trunc('month', timezone('America/Sao_Paulo', now())::date) - make_interval(months => series.month_offset) + interval '9 days')::date as due_on
) dates;

insert into public.payment_obligations (
  id, organization_id, user_id, purpose, status, plan_type, amount, currency,
  payment_method, pix_copy_paste, available_at, schedule_id, period_key,
  period_start, period_end, available_on, due_on, schedule_term_id, created_at
)
values (
  'c1fe0000-0000-4000-8000-000000000910',
  '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1',
  'c1fe0000-0000-4000-8000-000000000010',
  'recurring',
  'available',
  'monthly',
  3500,
  'BRL',
  'manual_pix',
  '000201LOCAL-SLAC-MONTHLY-PIX',
  (timezone('America/Sao_Paulo', now())::date - 4)::timestamp at time zone 'America/Sao_Paulo',
  'c1fe0000-0000-4000-8000-000000000710',
  'seed:recurring-review',
  timezone('America/Sao_Paulo', now())::date - 27,
  timezone('America/Sao_Paulo', now())::date + 3,
  timezone('America/Sao_Paulo', now())::date - 4,
  timezone('America/Sao_Paulo', now())::date + 3,
  'c1fe0000-0000-4000-8000-000000000810',
  timezone('utc'::text, now()) - interval '4 days'
);

insert into public.payment_claims (
  id, obligation_id, organization_id, claimant_user_id, payer_type, payer_name,
  status, created_at
)
values (
  'c1fe0000-0000-4000-8000-000000000410',
  'c1fe0000-0000-4000-8000-000000000910',
  '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1',
  'c1fe0000-0000-4000-8000-000000000010',
  'other',
  'Patrocinador Local',
  'under_review',
  timezone('utc'::text, now()) - interval '1 day'
);

insert into public.payment_claim_audit_events (
  id, organization_id, obligation_id, claim_id, actor_user_id,
  previous_state, next_state, created_at
)
values (
  'c1fe0000-0000-4000-8000-000000000510',
  '2c9c5c8a-4e4d-4322-bb48-adf6231d2bb1',
  'c1fe0000-0000-4000-8000-000000000910',
  'c1fe0000-0000-4000-8000-000000000410',
  'c1fe0000-0000-4000-8000-000000000010',
  'payment_available',
  'under_review',
  timezone('utc'::text, now()) - interval '1 day'
);
