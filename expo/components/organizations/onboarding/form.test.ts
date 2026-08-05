import {
  createInitialForm,
  formToDraft,
  getAnswerLabel,
  getFieldError,
  getFirstIncompleteIndex,
  getFormErrors,
  getQuestionError,
  getReviewRows,
  getVisibleFields,
  questions,
  type MembershipApplicationForm,
} from './form';

const findStep = (id: string) => {
  const question = questions.find((item) => item.id === id);
  if (!question) throw new Error(`Missing step ${id}`);
  return question;
};

const findField = (stepId: string, fieldId: keyof MembershipApplicationForm) => {
  const field = findStep(stepId).fields.find((item) => item.id === fieldId);
  if (!field) throw new Error(`Missing field ${fieldId} on step ${stepId}`);
  return field;
};

const createForm = () =>
  createInitialForm({
    acceptedTermsAt: '2026-08-04T12:00:00.000Z',
    application: null,
    email: 'ana@example.com',
    profileBirthday: '1992-04-12',
    profileName: 'Ana Silva',
  });

const completeForm = (): MembershipApplicationForm => ({
  ...createForm(),
  address_line: 'Rua das Flores, 100, Centro',
  allergies: '',
  allergies_choice: 'no',
  birthplace: 'Belo Horizonte, MG',
  city: 'Belo Horizonte',
  cpf: '529.982.247-25',
  dietary_choice: 'no',
  dietary_restrictions: '',
  emergency_contact_name: 'Rafael Souza',
  emergency_contact_phone: '(31) 99812-4400',
  emergency_contact_relationship: 'Amigo(a)',
  first_aid_course: 'none',
  has_rescue_course: false,
  highline_experience: 'beginner',
  id_document_issuer: 'SSP/MG',
  id_document_number: 'MG-1234567',
  marital_status: 'single',
  phone: '(31) 99812-4401',
  postal_code: '30130-000',
  profession: 'Designer',
  state: 'MG',
});

describe('membership onboarding steps', () => {
  it('keeps every step unconditional, so the count never shifts', () => {
    expect(questions).toHaveLength(18);
    // A conditional step would make "PERGUNTA x DE n" change mid-flow.
    expect(questions.some((step) => 'visible' in step)).toBe(false);

    const withAllergies = {
      ...completeForm(),
      allergies_choice: 'yes' as const,
    };
    expect(getFirstIncompleteIndex(withAllergies)).toBe(
      questions.indexOf(findStep('allergies')),
    );
  });

  it('reveals the allergy description on the same step as the choice', () => {
    const step = findStep('allergies');
    const answeredNo = { ...completeForm(), allergies_choice: 'no' as const };

    expect(getVisibleFields(answeredNo, step).map((field) => field.id)).toEqual([
      'allergies_choice',
    ]);
    expect(getQuestionError(answeredNo, step)).toBeNull();

    const answeredYes = { ...completeForm(), allergies_choice: 'yes' as const };
    expect(getVisibleFields(answeredYes, step).map((field) => field.id)).toEqual(
      ['allergies_choice', 'allergies'],
    );
    expect(getQuestionError(answeredYes, step)).toBe('Descreva as alergias.');
  });

  it('reveals the dietary description on the same step as the choice', () => {
    const step = findStep('dietary');
    const answeredYes = { ...completeForm(), dietary_choice: 'yes' as const };

    expect(getVisibleFields(answeredYes, step).map((field) => field.id)).toEqual(
      ['dietary_choice', 'dietary_restrictions'],
    );
    expect(getQuestionError(answeredYes, step)).toBe(
      'Descreva a restrição alimentar.',
    );
  });

  it('groups the whole address onto one step', () => {
    const step = findStep('address');

    expect(step.fields.map((field) => field.id)).toEqual([
      'postal_code',
      'address_line',
      'city',
      'state',
    ]);
    expect(getQuestionError({ ...completeForm(), city: '' }, step)).toBe(
      'Responda para continuar.',
    );
  });

  it('groups the emergency contact onto one step', () => {
    const step = findStep('emergency_contact');

    expect(step.fields.map((field) => field.id)).toEqual([
      'emergency_contact_name',
      'emergency_contact_relationship',
      'emergency_contact_phone',
    ]);
    expect(
      getQuestionError({ ...completeForm(), emergency_contact_phone: '31' }, step),
    ).toBe('Informe um telefone com DDD.');
  });

  it('starts a brand-new form with no health choice pre-answered', () => {
    const form = createForm();

    expect(form.allergies_choice).toBeNull();
    expect(form.dietary_choice).toBeNull();
    expect(getFieldError(form, findField('allergies', 'allergies_choice'))).toBe(
      'Escolha uma opção.',
    );
  });

  it('treats an explicit no as a valid rescue-course answer', () => {
    const field = findField('has_rescue_course', 'has_rescue_course');
    const form = completeForm();

    expect(getFieldError(form, field)).toBeNull();
    expect(getAnswerLabel(form, field)).toBe('Não');
    expect(
      getFieldError({ ...form, has_rescue_course: null }, field),
    ).toBe('Escolha uma opção.');
  });

  it('never blocks the flow on the optional blood type field', () => {
    const form = completeForm();

    expect(form.blood_type).toBeNull();
    expect(getQuestionError(form, findStep('blood_type'))).toBeNull();
  });

  it('validates formats only once a field has a value', () => {
    const cpf = findField('cpf', 'cpf');

    expect(getFieldError({ ...completeForm(), cpf: '' }, cpf)).toBe(
      'Responda para continuar.',
    );
    expect(
      getFieldError({ ...completeForm(), cpf: '111.111.111-11' }, cpf),
    ).toBe('Informe um CPF válido.');
    expect(getFieldError(completeForm(), cpf)).toBeNull();
  });

  it('points at the review position when every field is answered', () => {
    const form = completeForm();

    expect(getFormErrors(form)).toEqual({});
    expect(getFirstIncompleteIndex(form)).toBe(questions.length);
  });

  it('points at the step holding the first unanswered field', () => {
    const form = { ...completeForm(), state: '' };

    expect(getFirstIncompleteIndex(form)).toBe(
      questions.indexOf(findStep('address')),
    );
  });

  it('builds one review row per visible field, linked to its step', () => {
    const rows = getReviewRows(completeForm());
    const addressIndex = questions.indexOf(findStep('address'));

    expect(rows.filter((row) => row.index === addressIndex)).toHaveLength(4);
    expect(rows.find((row) => row.label === 'UF')?.value).toBe('MG');
    expect(rows.every((row) => row.error === null)).toBe(true);
    // The hidden allergy description must not produce a row.
    expect(rows.map((row) => row.label)).not.toContain('Alergias');
  });

  it('preserves an explicit no when creating the draft payload', () => {
    const form = { ...completeForm(), has_rescue_course: false };

    expect(formToDraft(form, 'organization-id', 'user-id')).toMatchObject({
      has_rescue_course: false,
      organization_id: 'organization-id',
      user_id: 'user-id',
    });
  });
});
