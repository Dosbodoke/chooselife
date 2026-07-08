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

export const steps = [
  {
    title: 'Sobre você',
    subtitle: 'Comece pelos dados básicos para a associação te identificar.',
  },
  {
    title: 'Documentos',
    subtitle: 'Informe os documentos usados no cadastro oficial.',
  },
  {
    title: 'Endereço e contato',
    subtitle: 'O CEP preenche parte do endereço automaticamente.',
  },
  {
    title: 'Saúde',
    subtitle: 'Usamos apenas em emergências nos eventos.',
  },
  {
    title: 'Experiência',
    subtitle: 'Conte sua relação com highline e segurança.',
  },
  {
    title: 'Contato de emergência',
    subtitle: 'Uma pessoa para acionarmos se algo acontecer.',
  },
] as const;

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

const digitsOnly = (value: string) => value.replace(/\D/g, '');

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
  profileBirthday,
  profileName,
}: {
  acceptedTermsAt?: string;
  application: MembershipApplication | null;
  email?: string | null;
  profileBirthday?: string | null;
  profileName?: string | null;
}): MembershipApplicationForm => ({
  accepted_terms_at:
    application?.accepted_terms_at ?? acceptedTermsAt ?? null,
  address_line: application?.address_line ?? '',
  allergies: application?.allergies ?? '',
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
  phone: maskPhone(application?.phone ?? ''),
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

const requiredText = (
  errors: FormErrors,
  field: FormField,
  value: string,
  message = 'Campo obrigatório.',
) => {
  if (!value.trim()) errors[field] = message;
};

export const getStepErrors = (
  form: MembershipApplicationForm,
  step: number,
) => {
  const errors: FormErrors = {};

  if (step === 0) {
    requiredText(errors, 'full_name', form.full_name);
    if (!displayDateToIso(form.birth_date)) {
      errors.birth_date = 'Informe uma data válida.';
    }
    if (!form.marital_status) errors.marital_status = 'Selecione uma opção.';
    requiredText(errors, 'profession', form.profession);
  }

  if (step === 1) {
    if (!isValidCpf(form.cpf)) errors.cpf = 'Informe um CPF válido.';
    requiredText(errors, 'id_document_issuer', form.id_document_issuer);
  }

  if (step === 2) {
    if (digitsOnly(form.postal_code).length !== 8) {
      errors.postal_code = 'Informe um CEP com 8 dígitos.';
    }
    requiredText(errors, 'city', form.city);
    if (form.state.trim().length !== 2) errors.state = 'Informe a UF.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Informe um e-mail válido.';
    }
    if (form.phone && ![10, 11].includes(digitsOnly(form.phone).length)) {
      errors.phone = 'Informe um celular com DDD.';
    }
  }

  if (step === 3) {
    if (!form.allergies_choice) errors.allergies_choice = 'Escolha uma opção.';
    if (form.allergies_choice === 'yes') {
      requiredText(
        errors,
        'allergies',
        form.allergies,
        'Descreva as alergias.',
      );
    }
    if (!form.dietary_choice) errors.dietary_choice = 'Escolha uma opção.';
    if (form.dietary_choice === 'yes') {
      requiredText(
        errors,
        'dietary_restrictions',
        form.dietary_restrictions,
        'Descreva a restrição alimentar.',
      );
    }
  }

  if (step === 4) {
    if (!form.highline_experience) {
      errors.highline_experience = 'Selecione seu nível.';
    }
    if (form.has_rescue_course === null) {
      errors.has_rescue_course = 'Escolha uma opção.';
    }
    if (!form.first_aid_course) {
      errors.first_aid_course = 'Selecione uma opção.';
    }
  }

  if (step === 5) {
    requiredText(errors, 'emergency_contact_name', form.emergency_contact_name);
    if (!form.emergency_contact_relationship) {
      errors.emergency_contact_relationship = 'Selecione uma opção.';
    }
    if (![10, 11].includes(digitsOnly(form.emergency_contact_phone).length)) {
      errors.emergency_contact_phone = 'Informe um telefone com DDD.';
    }
  }

  return errors;
};

export const isStepValid = (form: MembershipApplicationForm, step: number) =>
  Object.keys(getStepErrors(form, step)).length === 0;

export const getFirstIncompleteStep = (form: MembershipApplicationForm) => {
  const firstInvalid = steps.findIndex((_, index) => !isStepValid(form, index));
  return firstInvalid === -1 ? 0 : firstInvalid;
};
