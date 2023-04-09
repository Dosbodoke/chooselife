import { useState } from 'react';
import { View, Text } from 'react-native';
import { z } from 'zod';
import { useForm, SubmitHandler, Controller, SubmitErrorHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { CheckBox, TextInput } from '@src/components';
import { TouchableOpacity } from 'react-native-gesture-handler';

const validationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const LogInWithEmail = () => {
  const [isChecked, setIsChecked] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof validationSchema>>({
    mode: 'onTouched',
    resolver: zodResolver(validationSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  return (
    <View>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value }, fieldState: { isTouched, isDirty } }) => {
          return (
            <TextInput
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              touched={isTouched}
              error={errors.email?.message}
              isDirty={isDirty}
              label="Email"
              accessibilityHint="email"
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
              label="Senha"
              accessibilityHint="password"
            />
          );
        }}
      />
      <View className="flex flex-row items-center justify-between">
        <CheckBox
          label="Lembrar senha"
          onToggle={() => setIsChecked(!isChecked)}
          isChecked={isChecked}
        />
        <TouchableOpacity>
          <Text className="text-blue-600">Esqueceu a senha?</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity className="mt-4 flex items-center justify-center rounded-lg bg-blue-600 py-3">
        <Text className="text-base text-white">Entrar</Text>
      </TouchableOpacity>
      <View className="mt-4 flex flex-row">
        <Text className="text-gray-500">Não tem conta?</Text>
        <Text className="ml-1 font-bold text-blue-600">Crie uma aqui</Text>
      </View>
    </View>
  );
};

export default LogInWithEmail;
