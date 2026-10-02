import { ActivityIndicator, View } from 'react-native';

import {
  GlassField,
  SelectCards,
  SelectChips,
} from '~/components/organizations/onboarding/controls';
import {
  getFieldError,
  getVisibleFields,
  type FormField,
  type MembershipApplicationForm,
  type Question,
  type QuestionField,
} from '~/components/organizations/onboarding/form';
import { Text } from '~/components/ui/text';

type QuestionCardProps = {
  /** Bumped whenever a lookup writes into `autofilled` fields. */
  autofillKey: number;
  cepFailed: boolean;
  cepLoading: boolean;
  counterLabel: string;
  /** Set once Continue has been pressed, which is when errors may show. */
  showErrors: boolean;
  form: MembershipApplicationForm;
  onChange: (field: FormField, value: unknown) => void;
  onSubmitEditing: () => void;
  question: Question;
};

/**
 * Renders one step. Mounted with a `key` of the step id so the native text state
 * inside GlassField is always seeded from the current value.
 */
export function QuestionCard({
  autofillKey,
  cepFailed,
  cepLoading,
  counterLabel,
  showErrors,
  form,
  onChange,
  onSubmitEditing,
  question,
}: QuestionCardProps) {
  const fields = getVisibleFields(form, question);
  // Single-field steps get the prominent error box under the control; on a
  // multi-field step the message has to sit with the field it belongs to.
  const single = question.fields.length === 1;
  const stepError = showErrors && single ? getFieldError(form, fields[0]) : null;

  return (
    <View>
      <Text className="text-blue-600 text-xs font-extrabold tracking-widest mb-3">
        {counterLabel}
      </Text>
      <Text
        accessibilityRole="header"
        className={`text-zinc-950 text-3xl font-extrabold leading-9 ${
          question.supporting ? '' : 'mb-7'
        }`}
      >
        {question.prompt}
      </Text>
      {question.supporting ? (
        <Text className="text-zinc-500 text-base leading-6 mt-2.5 mb-7">
          {question.supporting}
        </Text>
      ) : null}

      <View className="gap-4">
        {fields.map((field) => (
          <FieldControl
            // Autofilled fields remount on a new lookup so the native input
            // picks up the value; the field being typed in never remounts.
            key={field.autofilled ? `${field.id}-${autofillKey}` : field.id}
            cepLoading={cepLoading && field.id === 'postal_code'}
            error={
              showErrors && !single ? getFieldError(form, field) : undefined
            }
            field={field}
            onChange={(value) => onChange(field.id, value)}
            onSubmitEditing={onSubmitEditing}
            value={form[field.id]}
          />
        ))}
      </View>

      {cepFailed && question.id === 'address' ? (
        <Text className="text-amber-700 text-xs mt-3">
          CEP não encontrado — preencha o endereço manualmente.
        </Text>
      ) : null}

      {stepError ? (
        <View
          accessibilityLiveRegion="assertive"
          className="bg-red-50 rounded-xl p-3 mt-4"
        >
          <Text className="text-red-700 text-sm font-semibold">
            {stepError}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function FieldControl({
  cepLoading,
  error,
  field,
  onChange,
  onSubmitEditing,
  value,
}: {
  cepLoading: boolean;
  error?: string | null;
  field: QuestionField;
  onChange: (value: unknown) => void;
  onSubmitEditing: () => void;
  value: MembershipApplicationForm[FormField];
}) {
  if (field.kind === 'text' || field.kind === 'textarea') {
    return (
      <GlassField
        accessibilityLabel={field.label ?? field.reviewLabel}
        autoCapitalize={field.autoCapitalize}
        error={error ?? undefined}
        keyboardType={field.keyboardType}
        label={field.label}
        mask={field.mask}
        multiline={field.kind === 'textarea'}
        onChangeText={onChange}
        onSubmitEditing={onSubmitEditing}
        placeholder={field.placeholder}
        returnKeyType="done"
        rightSlot={cepLoading ? <ActivityIndicator color="#6D28D9" /> : null}
        textContentType={field.textContentType}
        value={typeof value === 'string' ? value : ''}
      />
    );
  }

  if (field.kind === 'chips') {
    return (
      <SelectChips
        columns={field.columns}
        error={error ?? undefined}
        label={field.label}
        onChange={onChange}
        options={field.chips ?? []}
        value={typeof value === 'string' ? value : null}
      />
    );
  }

  // `cards` and `choice` share the same option-row control; `choice` fields
  // additionally map the yes/no option back to the field's own value shape.
  const selected =
    field.kind === 'choice' && field.asBoolean
      ? value === true
        ? 'yes'
        : value === false
          ? 'no'
          : null
      : typeof value === 'string'
        ? value
        : null;

  return (
    <SelectCards
      error={error ?? undefined}
      label={field.label}
      onChange={(next) =>
        onChange(field.kind === 'choice' && field.asBoolean ? next === 'yes' : next)
      }
      options={field.cards ?? []}
      value={selected}
    />
  );
}
