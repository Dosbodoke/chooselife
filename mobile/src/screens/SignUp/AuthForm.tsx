import { View, Text, TouchableOpacity } from 'react-native';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, SubmitHandler, Controller, SubmitErrorHandler } from 'react-hook-form';

import { TextInput, PrimaryButton } from '@src/components';

interface Props {
  onSignUpPress: (
    emailAddress: string,
    password: string,
    handleError: (error: string) => void
  ) => void;
}

const validationSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  });

type ValidationSchema = z.infer<typeof validationSchema>;

const AuthForm = ({ onSignUpPress }: Props) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<ValidationSchema>({
    mode: 'onTouched',
    resolver: zodResolver(validationSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  function handleSubmitError(error: string) {
    setError('email', {
      message: error,
    });
  }

  const onSubmit: SubmitHandler<ValidationSchema> = (data) => {
    onSignUpPress(data.email, data.password, handleSubmitError);
  };

  //TO-DO: Handle onInvalid
  const onInvalid: SubmitErrorHandler<ValidationSchema> = (errors) => console.log({ errors });

  return (
    <View>
      <Text className="text-2xl font-bold">Crie sua conta</Text>
      <Text className="mt-2 text-gray-500">
        Participe da maior e mais conectada comunidade de Highline
      </Text>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value }, fieldState: { isTouched, isDirty } }) => {
          return (
            <TextInput
              keyboardType="email-address"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              touched={isTouched}
              error={errors.email?.message}
              isDirty={isDirty}
              label="Email"
              accessibilityHint="email"
              autoCapitalize="none"
            />
          );
        }}
      />
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value }, fieldState: { isTouched, isDirty } }) => {
          return (
            <TextInput
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              touched={isTouched}
              error={errors.password?.message}
              isDirty={isDirty}
              secureTextEntry={true}
              label="Senha"
              accessibilityHint="password"
            />
          );
        }}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { onChange, onBlur, value }, fieldState: { isTouched, isDirty } }) => {
          return (
            <TextInput
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              touched={isTouched}
              error={errors.confirmPassword?.message}
              isDirty={isDirty}
              secureTextEntry={true}
              label="Confirmar senha"
              accessibilityHint="Confirm password"
            />
          );
        }}
      />
      <View className="mt-4">
        <PrimaryButton label="Criar conta" onPress={handleSubmit(onSubmit, onInvalid)} />
      </View>
    </View>
  );
};

export default AuthForm;
