import React from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  GlassField,
  NativeSwitchRow,
  SelectCards,
  SelectChips,
} from '~/components/organizations/onboarding/controls';
import { _layoutAnimation } from '~/utils/constants';
import {
  bloodTypeOptions,
  firstAidOptions,
  highlineExperienceOptions,
  maritalStatusOptions,
  maskCep,
  maskCpf,
  maskDate,
  maskPhone,
  relationshipOptions,
  type FormErrors,
  type MembershipApplicationForm,
  type YesNoValue,
} from '~/components/organizations/onboarding/form';
import { Text } from '~/components/ui/text';

type StepFieldsProps = {
  cepFailed: boolean;
  cepLoading: boolean;
  errors: FormErrors;
  onCepChange: (value: string) => void;
  step: number;
};

function FieldWrap({
  children,
  index,
}: {
  children: React.ReactNode;
  index: number;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(250 + index * 60).duration(300)}
      layout={_layoutAnimation}
    >
      {children}
    </Animated.View>
  );
}

function SwitchQuestion({
  choice,
  description,
  error,
  label,
  onChange,
}: {
  choice: YesNoValue;
  description?: string;
  error?: string;
  label: string;
  onChange: (value: YesNoValue) => void;
}) {
  return (
    <NativeSwitchRow
      description={description}
      error={error}
      label={label}
      onChange={(value) => onChange(value ? 'yes' : 'no')}
      value={choice === 'yes'}
    />
  );
}

function PersonalInfoFields({ errors }: { errors: FormErrors }) {
  const { control } = useFormContext<MembershipApplicationForm>();

  return (
    <View className="gap-4">
      <FieldWrap index={0}>
        <Controller
          control={control}
          name="full_name"
          render={({ field: { onChange, value } }) => (
            <GlassField
              accessibilityLabel="Nome completo"
              error={errors.full_name}
              label="Nome completo"
              onChangeText={onChange}
              required
              textContentType="name"
              value={value}
            />
          )}
        />
      </FieldWrap>
      <FieldWrap index={1}>
        <Controller
          control={control}
          name="birth_date"
          render={({ field: { onChange, value } }) => (
            <GlassField
              accessibilityLabel="Data de nascimento"
              error={errors.birth_date}
              keyboardType="number-pad"
              label="Data de nascimento"
              mask={maskDate}
              onChangeText={onChange}
              placeholder="DD/MM/AAAA"
              required
              value={value}
            />
          )}
        />
      </FieldWrap>
      <FieldWrap index={2}>
        <Controller
          control={control}
          name="birthplace"
          render={({ field: { onChange, value } }) => (
            <GlassField
              accessibilityLabel="Local de nascimento"
              error={errors.birthplace}
              label="Local de nascimento"
              onChangeText={onChange}
              placeholder="Cidade e Estado"
              required
              value={value}
            />
          )}
        />
      </FieldWrap>
      <FieldWrap index={3}>
        <Controller
          control={control}
          name="nationality"
          render={({ field: { onChange, value } }) => (
            <GlassField
              accessibilityLabel="Nacionalidade"
              error={errors.nationality}
              label="Nacionalidade"
              onChangeText={onChange}
              required
              value={value}
            />
          )}
        />
      </FieldWrap>
      <FieldWrap index={4}>
        <Controller
          control={control}
          name="marital_status"
          render={({ field: { onChange, value } }) => (
            <SelectChips
              error={errors.marital_status}
              label="Estado civil"
              onChange={onChange}
              options={maritalStatusOptions}
              required
              value={value}
            />
          )}
        />
      </FieldWrap>
      <FieldWrap index={5}>
        <Controller
          control={control}
          name="profession"
          render={({ field: { onChange, value } }) => (
            <GlassField
              accessibilityLabel="Profissão"
              error={errors.profession}
              label="Profissão"
              onChangeText={onChange}
              required
              value={value}
            />
          )}
        />
      </FieldWrap>
    </View>
  );
}

function DocumentsFields({ errors }: { errors: FormErrors }) {
  const { control } = useFormContext<MembershipApplicationForm>();

  return (
    <View className="gap-4">
      <FieldWrap index={0}>
        <Controller
          control={control}
          name="cpf"
          render={({ field: { onChange, value } }) => (
            <GlassField
              accessibilityLabel="CPF"
              error={errors.cpf}
              keyboardType="number-pad"
              label="CPF"
              mask={maskCpf}
              onChangeText={onChange}
              required
              value={value}
            />
          )}
        />
      </FieldWrap>
      <FieldWrap index={1}>
        <Controller
          control={control}
          name="id_document_number"
          render={({ field: { onChange, value } }) => (
            <GlassField
              accessibilityLabel="RG ou CIN"
              error={errors.id_document_number}
              label="RG/CIN"
              onChangeText={onChange}
              required
              value={value}
            />
          )}
        />
      </FieldWrap>
      <FieldWrap index={2}>
        <Controller
          control={control}
          name="id_document_issuer"
          render={({ field: { onChange, value } }) => (
            <GlassField
              accessibilityLabel="Órgão expedidor"
              autoCapitalize="characters"
              error={errors.id_document_issuer}
              label="Órgão expedidor"
              onChangeText={onChange}
              required
              value={value}
            />
          )}
        />
      </FieldWrap>
    </View>
  );
}

function AddressContactFields({
  cepFailed,
  cepLoading,
  errors,
  onCepChange,
}: {
  cepFailed: boolean;
  cepLoading: boolean;
  errors: FormErrors;
  onCepChange: (value: string) => void;
}) {
  const { control } = useFormContext<MembershipApplicationForm>();

  return (
    <View className="gap-4">
      <FieldWrap index={0}>
        <Controller
          control={control}
          name="postal_code"
          render={({ field: { value } }) => (
            <GlassField
              accessibilityLabel="CEP"
              error={errors.postal_code}
              keyboardType="number-pad"
              label="CEP"
              mask={maskCep}
              onChangeText={onCepChange}
              required
              rightSlot={
                cepLoading ? <ActivityIndicator color="#6D28D9" /> : null
              }
              value={value}
            />
          )}
        />
      </FieldWrap>
      {cepFailed ? (
        <Text className="text-amber-700 text-xs">
          CEP não encontrado — preencha manualmente
        </Text>
      ) : null}
      <FieldWrap index={1}>
        <Controller
          control={control}
          name="address_line"
          render={({ field: { onChange, value } }) => (
            <GlassField
              accessibilityLabel="Endereço"
              error={errors.address_line}
              label="Endereço"
              onChangeText={onChange}
              placeholder="Rua, número, bairro"
              required
              value={value}
            />
          )}
        />
      </FieldWrap>
      <FieldWrap index={2}>
        <Controller
          control={control}
          name="city"
          render={({ field: { onChange, value } }) => (
            <GlassField
              accessibilityLabel="Cidade"
              error={errors.city}
              label="Cidade"
              onChangeText={onChange}
              required
              value={value}
            />
          )}
        />
      </FieldWrap>
      <FieldWrap index={3}>
        <Controller
          control={control}
          name="state"
          render={({ field: { onChange, value } }) => (
            <GlassField
              accessibilityLabel="UF"
              autoCapitalize="characters"
              error={errors.state}
              label="UF"
              mask={(next) => next.slice(0, 2).toUpperCase()}
              onChangeText={onChange}
              required
              value={value}
            />
          )}
        />
      </FieldWrap>
      <FieldWrap index={4}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <GlassField
              accessibilityLabel="E-mail"
              autoCapitalize="none"
              error={errors.email}
              keyboardType="email-address"
              label="E-mail"
              onChangeText={onChange}
              required
              textContentType="emailAddress"
              value={value}
            />
          )}
        />
      </FieldWrap>
      <FieldWrap index={5}>
        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, value } }) => (
            <GlassField
              accessibilityLabel="Celular"
              error={errors.phone}
              keyboardType="number-pad"
              label="Celular"
              mask={maskPhone}
              onChangeText={onChange}
              required
              value={value}
            />
          )}
        />
      </FieldWrap>
    </View>
  );
}

function HealthFields({ errors }: { errors: FormErrors }) {
  const { control, setValue } = useFormContext<MembershipApplicationForm>();
  const allergiesChoice = useWatch({ control, name: 'allergies_choice' });
  const dietaryChoice = useWatch({ control, name: 'dietary_choice' });

  return (
    <View className="gap-4">
      <FieldWrap index={0}>
        <Controller
          control={control}
          name="blood_type"
          render={({ field: { onChange, value } }) => (
            <SelectChips
              columns={4}
              label="Tipo sanguíneo"
              onChange={onChange}
              options={bloodTypeOptions}
              value={value}
            />
          )}
        />
      </FieldWrap>
      <FieldWrap index={1}>
        <SwitchQuestion
          choice={allergiesChoice}
          description="Alergias a medicamentos, alimentos ou picadas."
          error={errors.allergies_choice}
          label="Alergias"
          onChange={(choice) =>
            setValue('allergies_choice', choice, {
              shouldDirty: true,
              shouldTouch: true,
            })
          }
        />
      </FieldWrap>
      {allergiesChoice === 'yes' ? (
        <FieldWrap index={2}>
          <Controller
            control={control}
            name="allergies"
            render={({ field: { onChange, value } }) => (
              <GlassField
                accessibilityLabel="Descrição das alergias"
                error={errors.allergies}
                label="Descreva"
                multiline
                onChangeText={onChange}
                placeholder="Descreva..."
                required
                value={value}
              />
            )}
          />
        </FieldWrap>
      ) : null}
      <FieldWrap index={3}>
        <SwitchQuestion
          choice={dietaryChoice}
          error={errors.dietary_choice}
          label="Restrição alimentar"
          onChange={(choice) =>
            setValue('dietary_choice', choice, {
              shouldDirty: true,
              shouldTouch: true,
            })
          }
        />
      </FieldWrap>
      {dietaryChoice === 'yes' ? (
        <FieldWrap index={4}>
          <Controller
            control={control}
            name="dietary_restrictions"
            render={({ field: { onChange, value } }) => (
              <GlassField
                accessibilityLabel="Descrição da restrição alimentar"
                error={errors.dietary_restrictions}
                label="Descreva"
                multiline
                onChangeText={onChange}
                placeholder="Descreva..."
                required
                value={value}
              />
            )}
          />
        </FieldWrap>
      ) : null}
    </View>
  );
}

function ExperienceFields({ errors }: { errors: FormErrors }) {
  const { control } = useFormContext<MembershipApplicationForm>();

  return (
    <View className="gap-4">
      <FieldWrap index={0}>
        <View className="gap-3">
          <Text className="text-zinc-500 text-xs font-medium">
            Nível de highline <Text className="text-red-600">*</Text>
          </Text>
          <Controller
            control={control}
            name="highline_experience"
            render={({ field: { onChange, value } }) => (
              <SelectCards
                error={errors.highline_experience}
                onChange={onChange}
                options={highlineExperienceOptions}
                value={value}
              />
            )}
          />
        </View>
      </FieldWrap>
      <FieldWrap index={1}>
        <Controller
          control={control}
          name="has_rescue_course"
          render={({ field: { onChange, value } }) => (
            <NativeSwitchRow
              error={errors.has_rescue_course}
              label="Curso de resgate"
              description="Ative se você já fez um curso de resgate."
              onChange={onChange}
              value={value}
            />
          )}
        />
      </FieldWrap>
      <FieldWrap index={2}>
        <View className="gap-3">
          <Text className="text-zinc-500 text-xs font-medium">
            Primeiros socorros <Text className="text-red-600">*</Text>
          </Text>
          <Controller
            control={control}
            name="first_aid_course"
            render={({ field: { onChange, value } }) => (
              <SelectCards
                error={errors.first_aid_course}
                onChange={onChange}
                options={firstAidOptions}
                value={value}
              />
            )}
          />
        </View>
      </FieldWrap>
    </View>
  );
}

function EmergencyContactFields({ errors }: { errors: FormErrors }) {
  const { control } = useFormContext<MembershipApplicationForm>();

  return (
    <View className="gap-4">
      <FieldWrap index={0}>
        <Controller
          control={control}
          name="emergency_contact_name"
          render={({ field: { onChange, value } }) => (
            <GlassField
              accessibilityLabel="Nome do contato de emergência"
              error={errors.emergency_contact_name}
              label="Nome"
              onChangeText={onChange}
              required
              textContentType="name"
              value={value}
            />
          )}
        />
      </FieldWrap>
      <FieldWrap index={1}>
        <Controller
          control={control}
          name="emergency_contact_relationship"
          render={({ field: { onChange, value } }) => (
            <SelectChips
              error={errors.emergency_contact_relationship}
              label="Parentesco"
              onChange={onChange}
              options={relationshipOptions}
              required
              value={value}
            />
          )}
        />
      </FieldWrap>
      <FieldWrap index={2}>
        <Controller
          control={control}
          name="emergency_contact_phone"
          render={({ field: { onChange, value } }) => (
            <GlassField
              accessibilityLabel="Telefone do contato de emergência"
              error={errors.emergency_contact_phone}
              keyboardType="number-pad"
              label="Telefone"
              mask={maskPhone}
              onChangeText={onChange}
              required
              value={value}
            />
          )}
        />
      </FieldWrap>
    </View>
  );
}

export function StepFields({
  cepFailed,
  cepLoading,
  errors,
  onCepChange,
  step,
}: StepFieldsProps) {
  switch (step) {
    case 0:
      return <PersonalInfoFields errors={errors} />;
    case 1:
      return <DocumentsFields errors={errors} />;
    case 2:
      return (
        <AddressContactFields
          cepFailed={cepFailed}
          cepLoading={cepLoading}
          errors={errors}
          onCepChange={onCepChange}
        />
      );
    case 3:
      return <HealthFields errors={errors} />;
    case 4:
      return <ExperienceFields errors={errors} />;
    default:
      return <EmergencyContactFields errors={errors} />;
  }
}
