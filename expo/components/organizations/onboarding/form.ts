import type { MembershipApplication } from '~/lib/membership-application';
import type { Enums } from '~/utils/database.types';

export type PlanType = 'monthly' | 'annual';

export type YesNoValue = 'yes' | 'no' | null;

export type MembershipApplicationForm = {
  accepted_terms_at: string | null;
  address_line: string;
  allergies: string;
  allergies_choice: YesNoValue;
  birth_date: string;
  birthplace: string;
  blood_type: Enums<'blood_type_enum'> | null;
  city: string;
  cpf: string;
  dietary_choice: YesNoValue;
  dietary_restrictions: string;
  email: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string | null;
  first_aid_course: Enums<'first_aid_course_enum'> | null;
  full_name: string;
  has_rescue_course: boolean | null;
  highline_experience: Enums<'highline_experience_enum'> | null;
  id_document_issuer: string;
  id_document_number: string;
  marital_status: Enums<'marital_status_enum'> | null;
  nationality: string;
  phone: string;
  postal_code: string;
  profession: string;
  state: string;
};

export type FormField = keyof MembershipApplicationForm;

export type FormErrors = Partial<Record<FormField, string>>;

export const maritalStatusOptions = [
  { label: 'Solteiro(a)', value: 'single' },
  { label: 'Casado(a)', value: 'married' },
  { label: 'Divorciado(a)', value: 'divorced' },
  { label: 'Viúvo(a)', value: 'widowed' },
  { label: 'Separado(a)', value: 'legally_separated' },
  { label: 'União estável', value: 'common_law' },
] satisfies { label: string; value: Enums<'marital_status_enum'> }[];

export const bloodTypeOptions = [
  { label: 'A+', value: 'a_pos' },
  { label: 'A-', value: 'a_neg' },
  { label: 'B+', value: 'b_pos' },
  { label: 'B-', value: 'b_neg' },
  { label: 'AB+', value: 'ab_pos' },
  { label: 'AB-', value: 'ab_neg' },
  { label: 'O+', value: 'o_pos' },
  { label: 'O-', value: 'o_neg' },
] satisfies { label: string; value: Enums<'blood_type_enum'> }[];

export const relationshipOptions = [
  'Mãe',
  'Pai',
  'Cônjuge',
  'Irmão(ã)',
  'Amigo(a)',
  'Outro',
].map((value) => ({ label: value, value }));

export const highlineExperienceOptions = [
  {
    title: 'Iniciante',
    description: 'Estou começando ou ainda pratico com pouca frequência.',
    value: 'beginner',
  },
  {
    title: 'Atleta',
    description: 'Pratico com regularidade e participo de eventos ou treinos.',
    value: 'athlete',
  },
  {
    title: 'Profissional',
    description: 'Atuo com montagem, aulas, produção ou performance.',
    value: 'professional',
  },
] satisfies {
  description: string;
  title: string;
  value: Enums<'highline_experience_enum'>;
}[];

export const firstAidOptions = [
  {
    title: 'Atualizado',
    description: 'Tenho curso vigente ou prática recente.',
    value: 'updated',
  },
  {
    title: 'Desatualizado',
    description: 'Já fiz curso, mas preciso renovar.',
    value: 'outdated',
  },
  {
    title: 'Nenhum',
    description: 'Ainda não fiz curso de primeiros socorros.',
    value: 'none',
  },
] satisfies {
  description: string;
  title: string;
  value: Enums<'first_aid_course_enum'>;
}[];

const digitsOnly = (value: string | null | undefined) =>
  (value ?? '').replace(/\D/g, '');

export const maskCpf = (value: string) => {
  const digits = digitsOnly(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

export const maskCep = (value: string) => {
  const digits = digitsOnly(value).slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, '$1-$2');
};

export const maskPhone = (value: string) => {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

export const maskDate = (value: string) => {
  const digits = digitsOnly(value).slice(0, 8);
  return digits
    .replace(/^(\d{2})(\d)/, '$1/$2')
    .replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
};

export const unmask = digitsOnly;

export const dateToDisplay = (value: string | null | undefined) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  return maskDate(value);
};

export const displayDateToIso = (value: string) => {
  const digits = digitsOnly(value);
  if (digits.length !== 8) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year.toString().padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const isValidCpf = (value: string) => {
  const cpf = digitsOnly(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  const calculate = (factor: number) => {
    let total = 0;
    for (let index = 0; index < factor - 1; index += 1) {
      total += Number(cpf[index]) * (factor - index);
    }
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return calculate(10) === Number(cpf[9]) && calculate(11) === Number(cpf[10]);
};

export const createInitialForm = ({
  acceptedTermsAt,
  application,
  email,
  phone,
  profileBirthday,
  profileName,
}: {
  acceptedTermsAt?: string;
  application: MembershipApplication | null;
  email?: string | null;
  phone?: string | null;
  profileBirthday?: string | null;
  profileName?: string | null;
}): MembershipApplicationForm => ({
  accepted_terms_at:
    application?.accepted_terms_at ?? acceptedTermsAt ?? null,
  address_line: application?.address_line ?? '',
  allergies: application?.allergies ?? '',
  // A brand-new form must not pretend the health questions were answered, so
  // the choice only starts filled when an application already exists.
  allergies_choice: application ? (application.allergies ? 'yes' : 'no') : null,
  birth_date: dateToDisplay(application?.birth_date ?? profileBirthday),
  birthplace: application?.birthplace ?? '',
  blood_type: application?.blood_type ?? null,
  city: application?.city ?? '',
  cpf: maskCpf(application?.cpf ?? ''),
  dietary_choice: application
    ? application.dietary_restrictions
      ? 'yes'
      : 'no'
    : null,
  dietary_restrictions: application?.dietary_restrictions ?? '',
  email: application?.email ?? email ?? '',
  emergency_contact_name: application?.emergency_contact_name ?? '',
  emergency_contact_phone: maskPhone(
    application?.emergency_contact_phone ?? '',
  ),
  emergency_contact_relationship:
    application?.emergency_contact_relationship ?? null,
  first_aid_course: application?.first_aid_course ?? null,
  full_name: application?.full_name ?? profileName ?? '',
  has_rescue_course: application?.has_rescue_course ?? null,
  highline_experience: application?.highline_experience ?? null,
  id_document_issuer: application?.id_document_issuer ?? '',
  id_document_number: application?.id_document_number ?? '',
  marital_status: application?.marital_status ?? null,
  nationality: application?.nationality ?? 'Brasileira',
  // iOS gives apps no access to the SIM's own number, so the only prefill
  // sources are the saved application and a phone-authenticated session. The
  // `telephoneNumber` content type lets iOS AutoFill offer it otherwise.
  phone: maskPhone(application?.phone ?? phone ?? ''),
  postal_code: maskCep(application?.postal_code ?? ''),
  profession: application?.profession ?? '',
  state: application?.state ?? '',
});

export const formToDraft = (
  form: MembershipApplicationForm,
  organizationId: string,
  userId: string,
) => ({
  accepted_terms_at: form.accepted_terms_at,
  address_line: form.address_line.trim() || null,
  allergies:
    form.allergies_choice === 'yes' ? form.allergies.trim() || null : null,
  birth_date: displayDateToIso(form.birth_date),
  birthplace: form.birthplace.trim() || null,
  blood_type: form.blood_type,
  city: form.city.trim() || null,
  cpf: digitsOnly(form.cpf) || null,
  dietary_restrictions:
    form.dietary_choice === 'yes'
      ? form.dietary_restrictions.trim() || null
      : null,
  email: form.email.trim() || null,
  emergency_contact_name: form.emergency_contact_name.trim() || null,
  emergency_contact_phone: digitsOnly(form.emergency_contact_phone) || null,
  emergency_contact_relationship:
    form.emergency_contact_relationship?.trim() || null,
  first_aid_course: form.first_aid_course,
  full_name: form.full_name.trim() || null,
  has_rescue_course: form.has_rescue_course,
  highline_experience: form.highline_experience,
  id_document_issuer: form.id_document_issuer.trim() || null,
  id_document_number: form.id_document_number.trim() || null,
  marital_status: form.marital_status,
  nationality: form.nationality.trim() || null,
  organization_id: organizationId,
  phone: digitsOnly(form.phone) || null,
  postal_code: digitsOnly(form.postal_code) || null,
  profession: form.profession.trim() || null,
  state: form.state.trim().toUpperCase() || null,
  user_id: userId,
});

export type FieldKind = 'cards' | 'chips' | 'choice' | 'text' | 'textarea';

export type QuestionField = {
  /**
   * True when the underlying field stores a boolean instead of a YesNoValue.
   */
  asBoolean?: boolean;
  autoCapitalize?: 'characters' | 'none' | 'sentences';
  /**
   * Written by an external lookup (ViaCEP) rather than by typing. Native text
   * state is captured on mount, so these fields must remount to show new values.
   */
  autofilled?: boolean;
  /**
   * Long-form option rows, used when each choice needs an explanation.
   */
  cards?: { description?: string; title: string; value: string }[];
  /**
   * Compact option pills, used when the labels speak for themselves.
   */
  chips?: { label: string; value: string }[];
  columns?: 2 | 4;
  id: FormField;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  kind: FieldKind;
  /**
   * Shown above the control. Omitted on single-field steps, where the step
   * prompt already names what is being asked.
   */
  label?: string;
  mask?: (value: string) => string;
  /**
   * Optional fields never block the step.
   */
  optional?: boolean;
  placeholder?: string;
  /**
   * Shown when the field is empty and the user tries to continue.
   */
  requiredMessage?: string;
  /**
   * Row label on the review screen, where the step prompt is too long.
   */
  reviewLabel: string;
  textContentType?: 'emailAddress' | 'name' | 'telephoneNumber';
  /**
   * Format check, only run once the field has a value.
   */
  validate?: (form: MembershipApplicationForm) => string | null;
  /**
   * Conditional fields appear on the same step as the answer that reveals them.
   */
  visible?: (form: MembershipApplicationForm) => boolean;
};

/**
 * One screen of the flow. Most hold a single field; fields that only make sense
 * together (a full address, an emergency contact) share one.
 */
export type Question = {
  fields: QuestionField[];
  id: string;
  prompt: string;
  section: string;
  supporting?: string;
};

const yesNoCards = [
  { title: 'Sim', value: 'yes' },
  { title: 'Não', value: 'no' },
];

const requiredPhone = (value: string) =>
  [10, 11].includes(digitsOnly(value).length)
    ? null
    : 'Informe um telefone com DDD.';

export const questions: Question[] = [
  {
    fields: [
      { id: 'full_name', kind: 'text', reviewLabel: 'Nome completo', textContentType: 'name' },
    ],
    id: 'full_name',
    prompt: 'Como devemos chamar você?',
    section: 'Sobre você',
    supporting: 'Use seu nome completo, como aparece nos seus documentos.',
  },
  {
    fields: [
      {
        id: 'birth_date',
        keyboardType: 'number-pad',
        kind: 'text',
        mask: maskDate,
        placeholder: 'DD/MM/AAAA',
        reviewLabel: 'Data de nascimento',
        validate: (form) =>
          displayDateToIso(form.birth_date) ? null : 'Informe uma data válida.',
      },
    ],
    id: 'birth_date',
    prompt: 'Qual é a sua data de nascimento?',
    section: 'Sobre você',
    supporting: 'Precisamos dela para o cadastro oficial da associação.',
  },
  {
    fields: [
      {
        id: 'birthplace',
        kind: 'text',
        placeholder: 'Cidade e Estado',
        reviewLabel: 'Local de nascimento',
      },
    ],
    id: 'birthplace',
    prompt: 'Onde você nasceu?',
    section: 'Sobre você',
    supporting: 'Informe a cidade e o estado.',
  },
  {
    fields: [{ id: 'nationality', kind: 'text', reviewLabel: 'Nacionalidade' }],
    id: 'nationality',
    prompt: 'Qual é a sua nacionalidade?',
    section: 'Sobre você',
  },
  {
    fields: [
      {
        chips: maritalStatusOptions,
        id: 'marital_status',
        kind: 'chips',
        requiredMessage: 'Selecione uma opção.',
        reviewLabel: 'Estado civil',
      },
    ],
    id: 'marital_status',
    prompt: 'Qual é o seu estado civil?',
    section: 'Sobre você',
  },
  {
    fields: [{ id: 'profession', kind: 'text', reviewLabel: 'Profissão' }],
    id: 'profession',
    prompt: 'Qual é a sua profissão?',
    section: 'Sobre você',
    supporting: 'O que você faz hoje, mesmo que não seja formalizado.',
  },
  {
    fields: [
      {
        id: 'cpf',
        keyboardType: 'number-pad',
        kind: 'text',
        mask: maskCpf,
        placeholder: '000.000.000-00',
        reviewLabel: 'CPF',
        validate: (form) =>
          isValidCpf(form.cpf) ? null : 'Informe um CPF válido.',
      },
    ],
    id: 'cpf',
    prompt: 'Qual é o seu CPF?',
    section: 'Documentos',
  },
  {
    fields: [
      {
        id: 'id_document_number',
        kind: 'text',
        label: 'Número',
        reviewLabel: 'RG/CIN',
      },
      {
        autoCapitalize: 'characters',
        id: 'id_document_issuer',
        kind: 'text',
        label: 'Órgão expedidor',
        placeholder: 'Ex.: SSP/MG',
        reviewLabel: 'Órgão expedidor',
      },
    ],
    id: 'id_document',
    prompt: 'Qual é o seu RG ou CIN?',
    section: 'Documentos',
    supporting: 'O número e o órgão expedidor aparecem no próprio documento.',
  },
  {
    fields: [
      {
        id: 'postal_code',
        keyboardType: 'number-pad',
        kind: 'text',
        label: 'CEP',
        mask: maskCep,
        placeholder: '00000-000',
        reviewLabel: 'CEP',
        validate: (form) =>
          digitsOnly(form.postal_code).length === 8
            ? null
            : 'Informe um CEP com 8 dígitos.',
      },
      {
        autofilled: true,
        id: 'address_line',
        kind: 'text',
        label: 'Endereço',
        placeholder: 'Rua, número, bairro',
        reviewLabel: 'Endereço',
      },
      {
        autofilled: true,
        id: 'city',
        kind: 'text',
        label: 'Cidade',
        reviewLabel: 'Cidade',
      },
      {
        autoCapitalize: 'characters',
        autofilled: true,
        id: 'state',
        kind: 'text',
        label: 'UF',
        mask: (value) => value.slice(0, 2).toUpperCase(),
        placeholder: 'MG',
        reviewLabel: 'UF',
        validate: (form) =>
          form.state.trim().length === 2 ? null : 'Informe a UF.',
      },
    ],
    id: 'address',
    prompt: 'Onde você mora?',
    section: 'Endereço e contato',
    supporting: 'Informe o CEP e preenchemos o resto para você.',
  },
  {
    fields: [
      {
        autoCapitalize: 'none',
        id: 'email',
        keyboardType: 'email-address',
        kind: 'text',
        reviewLabel: 'E-mail',
        textContentType: 'emailAddress',
        validate: (form) =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
            ? null
            : 'Informe um e-mail válido.',
      },
    ],
    id: 'email',
    prompt: 'Qual é o melhor e-mail para contato?',
    section: 'Endereço e contato',
    supporting: 'Enviaremos avisos importantes da associação por aqui.',
  },
  {
    fields: [
      {
        id: 'phone',
        keyboardType: 'number-pad',
        kind: 'text',
        mask: maskPhone,
        placeholder: '(31) 99999-9999',
        reviewLabel: 'Celular',
        textContentType: 'telephoneNumber',
        validate: (form) => requiredPhone(form.phone),
      },
    ],
    id: 'phone',
    prompt: 'Qual é o seu celular?',
    section: 'Endereço e contato',
  },
  {
    fields: [
      {
        chips: bloodTypeOptions,
        columns: 4,
        id: 'blood_type',
        kind: 'chips',
        optional: true,
        reviewLabel: 'Tipo sanguíneo',
      },
    ],
    id: 'blood_type',
    prompt: 'Qual é o seu tipo sanguíneo?',
    section: 'Saúde',
    supporting: 'Opcional — pule se não souber de cabeça.',
  },
  {
    fields: [
      {
        cards: yesNoCards,
        id: 'allergies_choice',
        kind: 'choice',
        requiredMessage: 'Escolha uma opção.',
        reviewLabel: 'Tem alergias',
      },
      {
        id: 'allergies',
        kind: 'textarea',
        label: 'Descreva suas alergias',
        placeholder: 'Ex.: alergia grave a dipirona…',
        requiredMessage: 'Descreva as alergias.',
        reviewLabel: 'Alergias',
        visible: (form) => form.allergies_choice === 'yes',
      },
    ],
    id: 'allergies',
    prompt: 'Você tem alguma alergia?',
    section: 'Saúde',
    supporting: 'Considere medicamentos, alimentos e picadas.',
  },
  {
    fields: [
      {
        cards: yesNoCards,
        id: 'dietary_choice',
        kind: 'choice',
        requiredMessage: 'Escolha uma opção.',
        reviewLabel: 'Tem restrição alimentar',
      },
      {
        id: 'dietary_restrictions',
        kind: 'textarea',
        label: 'Descreva sua restrição',
        placeholder: 'Ex.: vegetariano, intolerância a lactose…',
        requiredMessage: 'Descreva a restrição alimentar.',
        reviewLabel: 'Restrição alimentar',
        visible: (form) => form.dietary_choice === 'yes',
      },
    ],
    id: 'dietary',
    prompt: 'Você tem alguma restrição alimentar?',
    section: 'Saúde',
    supporting: 'Vale para dietas, intolerâncias e alimentos proibidos.',
  },
  {
    fields: [
      {
        cards: highlineExperienceOptions,
        id: 'highline_experience',
        kind: 'cards',
        requiredMessage: 'Selecione seu nível.',
        reviewLabel: 'Nível de highline',
      },
    ],
    id: 'highline_experience',
    prompt: 'Como você descreve sua experiência?',
    section: 'Experiência',
    supporting: 'Isso ajuda a associação a preparar atividades adequadas.',
  },
  {
    fields: [
      {
        asBoolean: true,
        cards: yesNoCards,
        id: 'has_rescue_course',
        kind: 'choice',
        requiredMessage: 'Escolha uma opção.',
        reviewLabel: 'Curso de resgate',
      },
    ],
    id: 'has_rescue_course',
    prompt: 'Você já fez curso de resgate?',
    section: 'Experiência',
    supporting: 'Escolha uma resposta — "Não" também conclui esta pergunta.',
  },
  {
    fields: [
      {
        cards: firstAidOptions,
        id: 'first_aid_course',
        kind: 'cards',
        requiredMessage: 'Selecione uma opção.',
        reviewLabel: 'Primeiros socorros',
      },
    ],
    id: 'first_aid_course',
    prompt: 'Como está seu conhecimento de primeiros socorros?',
    section: 'Experiência',
    supporting: 'Escolha a opção que representa seu momento atual.',
  },
  {
    fields: [
      {
        id: 'emergency_contact_name',
        kind: 'text',
        label: 'Nome',
        placeholder: 'Nome do contato',
        reviewLabel: 'Contato de emergência',
        textContentType: 'name',
      },
      {
        chips: relationshipOptions,
        id: 'emergency_contact_relationship',
        kind: 'chips',
        label: 'Relação com você',
        requiredMessage: 'Selecione uma opção.',
        reviewLabel: 'Parentesco',
      },
      {
        id: 'emergency_contact_phone',
        keyboardType: 'number-pad',
        kind: 'text',
        label: 'Telefone',
        mask: maskPhone,
        placeholder: '(31) 99999-9999',
        reviewLabel: 'Telefone de emergência',
        textContentType: 'telephoneNumber',
        validate: (form) => requiredPhone(form.emergency_contact_phone),
      },
    ],
    id: 'emergency_contact',
    prompt: 'Quem devemos chamar em uma emergência?',
    section: 'Contato de emergência',
    supporting: 'Informe alguém próximo, com DDD no telefone.',
  },
];

const isBlank = (value: MembershipApplicationForm[FormField]) =>
  value === null || value === undefined || value.toString().trim() === '';

export const getVisibleFields = (
  form: MembershipApplicationForm,
  question: Question,
) => question.fields.filter((field) => field.visible?.(form) ?? true);

export const getFieldError = (
  form: MembershipApplicationForm,
  field: QuestionField,
) => {
  if (isBlank(form[field.id])) {
    return field.optional
      ? null
      : (field.requiredMessage ?? 'Responda para continuar.');
  }

  return field.validate?.(form) ?? null;
};

export const getQuestionError = (
  form: MembershipApplicationForm,
  question: Question,
) => {
  for (const field of getVisibleFields(form, question)) {
    const error = getFieldError(form, field);
    if (error) return error;
  }

  return null;
};

/**
 * Index of the first step holding an unanswered field, or the step count when
 * everything is answered — which is exactly the review position.
 */
export const getFirstIncompleteIndex = (form: MembershipApplicationForm) => {
  const index = questions.findIndex(
    (question) => getQuestionError(form, question) !== null,
  );

  return index === -1 ? questions.length : index;
};

export const getFormErrors = (form: MembershipApplicationForm) => {
  const errors: FormErrors = {};

  questions.forEach((question) => {
    getVisibleFields(form, question).forEach((field) => {
      const error = getFieldError(form, field);
      if (error) errors[field.id] = error;
    });
  });

  return errors;
};

export const getAnswerLabel = (
  form: MembershipApplicationForm,
  field: QuestionField,
): string | null => {
  const value = form[field.id];
  if (isBlank(value)) return null;

  if (field.kind === 'choice') {
    return value === 'yes' || value === true ? 'Sim' : 'Não';
  }

  const option =
    field.chips?.find((chip) => chip.value === value) ??
    field.cards?.find((card) => card.value === value);

  return option
    ? 'label' in option
      ? option.label
      : option.title
    : `${value}`;
};

export type ReviewRow = {
  error: string | null;
  /** Step to jump to when the row is tapped. */
  index: number;
  label: string;
  section: string;
  value: string | null;
};

export const getReviewRows = (form: MembershipApplicationForm): ReviewRow[] =>
  questions.flatMap((question, index) =>
    getVisibleFields(form, question).map((field) => ({
      error: getFieldError(form, field),
      index,
      label: field.reviewLabel,
      section: question.section,
      value: getAnswerLabel(form, field),
    })),
  );

