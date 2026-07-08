# 002 — In-app member onboarding (replaces Google Form)

Status: SPEC FROZEN (data model + API). UI spec appended in section 6.
Owner: Fable session (design/review) → Codex (implementation).

## 1. Goal

Replace the SLAC Google Form ("Formulário de Inscrição na SLAC - Pessoa Física")
with a polished in-app onboarding wizard. Data lands in Postgres instead of a
spreadsheet, keyed to the authenticated user, and gates the membership payment
flow.

## 2. Flow integration

Current flow (PR #192 + local commits):
`(tabs)/organizations` → Seja Membro → `/organizations/[slug]/member`
(showcase carousel → plan select → Termos de Adesão dialog) →
`start-subscription` → `/payment` (manual PIX, "Já paguei").

New flow — the wizard sits between terms agreement and payment:

1. User agrees to "Termos de Adesão" in `become-member-form.tsx`.
2. If the user has NO submitted application for the org →
   `router.push('/organizations/[slug]/onboarding', { plan_type })`.
   If a submitted application exists → skip straight to the existing
   `start-subscription` mutation (unchanged behavior).
3. Wizard final step ("Revisão") submits the application (status
   `submitted`), then runs the same `start-subscription` mutation and
   routes to `/payment` with the same params as today.
4. Renewal flow (`Subscription.tsx`) is untouched — onboarding is only for
   `new_member` context.

Terms acceptance is recorded on the application (`accepted_terms_at`) at the
moment the user taps "Concordar" (pass it into the wizard route params; wizard
persists it on first draft save).

## 3. Data model (new migration)

```sql
create type public.marital_status_enum as enum (
  'single','married','divorced','widowed','legally_separated','common_law');
create type public.blood_type_enum as enum (
  'a_pos','a_neg','b_pos','b_neg','ab_pos','ab_neg','o_pos','o_neg');
create type public.highline_experience_enum as enum (
  'beginner','athlete','professional');
create type public.first_aid_course_enum as enum (
  'updated','outdated','none');
create type public.membership_application_status_enum as enum (
  'draft','submitted');

create table public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.profiles(id),
  status public.membership_application_status_enum not null default 'draft',

  -- Dados pessoais
  full_name text,
  birth_date date,
  nationality text,
  marital_status public.marital_status_enum,
  profession text,
  birthplace text,                -- "Cidade e Estado"

  -- Documentos
  cpf text,                       -- digits only, 11 chars, checksum-validated client-side
  id_document_number text,        -- RG or CIN
  id_document_issuer text,        -- órgão expedidor

  -- Endereço
  postal_code text,               -- CEP, digits only
  address_line text,              -- rua, número, bairro
  city text,
  state text,                     -- UF, 2 chars

  -- Contato
  email text,
  phone text,                     -- celular com DDD, digits only

  -- Saúde
  blood_type public.blood_type_enum,
  allergies text,                 -- null = "Não"; non-null = description
  dietary_restrictions text,      -- null = "Não"; non-null = description

  -- Experiência
  highline_experience public.highline_experience_enum,
  has_rescue_course boolean,
  first_aid_course public.first_aid_course_enum,

  -- Contato de emergência
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_phone text,

  accepted_terms_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  unique (organization_id, user_id)
);
```

- `updated_at` maintained by the standard `moddatetime`-style trigger (match
  repo conventions; if none exists, add a simple trigger function).
- Submission guard: a `check`-style enforcement in an RPC (not a table
  constraint) — see below. Draft rows may be sparse; `status = 'submitted'`
  requires all required fields non-null.

### RLS

```sql
alter table public.membership_applications enable row level security;
-- owner can select / insert / update own row while draft;
-- once submitted, owner can still select but not update (updates only via RPC
-- returning to draft is NOT allowed in v1).
```

Policies: `select` where `user_id = auth.uid()`; `insert` with
`user_id = auth.uid()`; `update` where `user_id = auth.uid() and status = 'draft'`.
Admins read via service role / SQL (same operating model as the payment
runbook). No anon access.

### Submission RPC

```sql
create function public.submit_membership_application(p_application_id uuid)
returns ... security definer
```

- Verifies ownership (`auth.uid()`), status `draft`, and that every required
  field is present (required set mirrors the Google Form: full_name,
  birth_date, marital_status, profession, cpf, id_document_issuer,
  postal_code, city, state, email, allergies-answered, dietary-answered,
  highline_experience, has_rescue_course, first_aid_course, emergency_contact
  name/relationship/phone, accepted_terms_at).
  "Allergies answered" is modeled client-side (Não → null is valid), so the
  RPC only re-checks the truly non-nullable ones; client owns fine-grained
  validation.
- Sets `status = 'submitted'`, `submitted_at = now()`.
- Grant execute to `authenticated` only.

## 4. Client API surface (expo)

New file `expo/lib/membership-application.ts`:

- `fetchMembershipApplication(orgId, userId)` — select single row.
- `upsertMembershipApplicationDraft(partial)` — upsert on
  `(organization_id, user_id)`; used by per-step autosave (debounced ~800ms
  after last change + on step advance).
- `submitMembershipApplication(applicationId)` — calls the RPC.

React Query keys under `queryKeys.membershipApplication.byOrgUser(orgId, userId)`
(extend `expo/lib/query-keys.ts`).

CEP lookup: `GET https://viacep.com.br/ws/{cep}/json/` — on 8-digit CEP,
autofill `address_line` (logradouro + bairro), `city`, `state`; failures are
non-blocking (silent fallback to manual entry).

Prefill on first open: `full_name` ← `profiles.name`, `birth_date` ←
`profiles.birthday`, `email` ← auth user email, `nationality` default
"Brasileira".

## 5. Route & gating

- New route `expo/app/organizations/[slug]/onboarding.tsx` (auth-gated with
  the same Redirect pattern as `member.tsx`).
- `become-member-form.tsx`: after Concordar, check application status via the
  query cache (fetch on mount of the member screen so the check is instant):
  submitted → existing mutation; otherwise → push onboarding with
  `{ slug, plan_type }`.
- Wizard completion: submit RPC → run existing `start-subscription` mutation
  (same code path as today) → `router.replace('/payment', …)`.

## 6. UI spec

Route: `/organizations/[slug]/onboarding` (fullscreen modal, `gestureEnabled: false`). Runs between the terms dialog and `/payment`. Dark `BgBlob` background throughout — visually it's the first act of the "Finalize seu cadastro" payment screen, so the handoff feels seamless.

### 6.1 Step grouping (6 steps)

1. **Sobre você** (nome completo*, data de nascimento*, local de nascimento, nacionalidade, estado civil*, profissão*) — easy, self-known answers build momentum.
2. **Documentos** (CPF*, RG/CIN, órgão expedidor*) — short step right after identity.
3. **Endereço e contato** (CEP* → auto-fill, endereço, cidade*, UF*, e-mail* prefilled, celular) — CEP auto-fill makes address nearly free; email prefilled.
4. **Saúde** (tipo sanguíneo, alergias*, restrição alimentar*) — subtitle "Usamos apenas em emergências nos eventos".
5. **Experiência** (nível de highline*, resgate*, primeiros socorros*) — the fun step, placed late as a reward.
6. **Contato de emergência** (nome*, parentesco*, telefone*) — 3 fields, easy close before payment.

### 6.2 Screen anatomy

- **Header** (below `insets.top + 12`): left ghost back chevron (`p-2.5 rounded-full bg-white/10`, hidden on step 1), right `CloseButton` identical to payment.tsx. Centered **segmented progress bar**: 6 pills, `h-1 flex-1 rounded-full`, done/current = `bg-emerald-400`, upcoming = `bg-white/15`; current segment's fill animates width via reanimated `withTiming(300ms, easeOut)`. Under it, `text-white/60 text-xs font-semibold tracking-wide` "PASSO 2 DE 6".
- **Body**: keyboard-aware scroll view, `px-6 pt-6`, `gap-5`. Step title `text-3xl font-bold text-white leading-9` (matches payment title), subtitle `text-white/70 text-base leading-6`, both entering `FadeInDown.delay(100/200).duration(300)`. Fields stagger `FadeInDown.delay(250 + i*60).duration(300)`.
- **Footer** (pinned, `px-6`, `pb: insets.bottom + 16`, subtle gradient fade to bg): white pill CTA exactly like payment — `bg-white rounded-full py-4 items-center`, label `text-black text-lg font-bold` "Continuar" (step 6: "Ir para o pagamento"); disabled `opacity-50` until required fields valid. `ActivityIndicator color="#000"` while persisting. No skip buttons — optional fields are just left blank.

### 6.3 Input inventory (glass style, consistent with `bg-white/10` cards)

- **Text field**: container `bg-white/10 rounded-2xl border border-white/15 px-4 py-3.5`, floating label `text-white/60 text-xs font-medium` above value `text-white text-base`, required marked `*` in emerald. Focus: `border-emerald-400/70` + label `text-emerald-300` (150ms). Error: `border-red-400/70` + helper `text-red-300 text-xs mt-1.5` below. `returnKeyType="next"` chains focus down the step.
- **Masked fields**: same shell; masks CPF `000.000.000-00`, CEP `00000-000`, celular `(00) 00000-0000`, data `DD/MM/AAAA` — all `keyboardType="number-pad"`, `tracking-wide`. Validate on blur, never while typing.
- **Single-select — chips** for estado civil, tipo sanguíneo, parentesco: wrapping row of pills `px-4 py-2.5 rounded-full border`, unselected `bg-white/10 border-white/20 text-white/80`, selected `bg-emerald-500/20 border-emerald-400 text-emerald-300 font-semibold` + light haptic. Blood type renders as 4×2 grid of equal chips.
- **Single-select — cards** for nível de highline and primeiros socorros (options need descriptions): the become-member plan-card pattern — `bg-white/10 rounded-2xl border-2 p-5`, title `text-white text-xl font-bold`, description `text-white/60 text-sm`, selected `border-emerald-400`.
- **Yes/No rows** (alergias, restrição alimentar, resgate): glass row `rounded-2xl bg-white/10 border border-white/15 p-4 flex-row justify-between`, label left, two segmented pills "Não | Sim" right. Choosing "Sim" on alergias/restrição expands a textarea (`min-h-[88px]`, placeholder "Descreva…") beneath via `_layoutAnimation` + `FadeIn`; textarea becomes required.
- **Keyboard**: footer CTA rides above keyboard; scroll auto-reveals focused field with 24px clearance; tapping outside dismisses.

### 6.4 Micro-interactions

- **Step transitions**: forward `SlideInRight.duration(250)` new content / `SlideOutLeft` old; back reversed. Progress segment fills simultaneously.
- **Haptics**: `impactAsync(Light)` on chip/card select and Continuar; `notificationAsync(Error)` when Continuar tapped with invalid fields; `notificationAsync(Success)` on wizard completion.
- **Autosave**: debounced 800ms per field to the draft row. Indicator: tiny `text-white/40 text-xs` "Salvo ✓" next to the step counter, fading in/out (`FadeIn`/`FadeOut`, 1.5s visible). Never a spinner.
- **Success moment**: after step 6, 1.6s interstitial reusing payment's success grammar — `ZoomIn` emerald `CheckCircle2Icon` (64, `#10B981`), "Cadastro completo!" `FadeIn.delay(200)`, subtitle "Agora só falta o pagamento" — then `router.replace('/payment')` so back never returns mid-celebration.

### 6.5 Empty/edge states

- **Resume draft**: reopening with a draft skips straight to the first incomplete step and shows a dismissible banner atop the body — `bg-emerald-500/15 border border-emerald-400/30 rounded-2xl p-4`, "Continuamos de onde você parou" + ghost "Recomeçar do zero" text link.
- **Validation**: per-field only, revealed on Continuar press; screen auto-scrolls to the first invalid field and its border pulses once (scale 1→1.02→1, 300ms). No error-summary list.
- **CEP lookup**: inline `ActivityIndicator` (white, small) in the field's right slot while fetching; on success, rua/cidade/UF fill with a quick `FadeIn` and success haptic. On failure/timeout (4s): non-blocking helper `text-amber-300 text-xs` "CEP não encontrado — preencha manualmente" and fields unlock; never blocks Continuar.

### 6.6 Accessibility

- Every input gets `accessibilityLabel` = full pt-BR label + "obrigatório" when required; chips/cards use `accessibilityRole="radio"` + `accessibilityState={{ selected }}`; yes/no rows `role="switch"`.
- Hit targets ≥ 44×44pt (chips get `hitSlop`); header icons `hitSlop={12}` as in payment.
- Dynamic Type: all text via `Text`; field containers use padding not fixed heights; cap `maxFontSizeMultiplier={1.6}` on the progress counter only.
- Progress announced on step change via `AccessibilityInfo.announceForAccessibility("Passo 3 de 6, Endereço e contato")`; errors announced with `accessibilityLiveRegion="polite"`. Body copy ≥ `white/70` (≥4.5:1).

## 7. Non-goals

- Admin review UI in-app (admins use SQL, consistent with payment runbook).
- Editing a submitted application (v1: contact the association).
- i18n — screens are pt-BR hardcoded like the rest of the org tab.
- Migrating historical Google Form responses.

## 8. Acceptance / proof

- `pnpm -C expo typecheck` (or repo's tsc script) passes.
- New migration applies cleanly on a fresh local db (`supabase db reset` or
  `supabase migration up` against local).
- Manual flow on simulator: new user → Seja Membro → plan → terms →
  wizard (all steps, autosave visible mid-way by killing/reopening app) →
  submit → lands on payment screen. Returning submitted user skips wizard.
