import { useState, useCallback } from 'react';
import { View, Text } from 'react-native';
import { z } from 'zod';
import { useForm, SubmitHandler, Controller, SubmitErrorHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSignIn } from '@clerk/clerk-expo';

import { SignInScreenProps } from '@src/navigation/types';
import { CheckBox, TextInput, PrimaryButton } from '@src/components';
import { TouchableOpacity } from 'react-native-gesture-handler';

interface Props {
  navigation: SignInScreenProps['navigation'];
}

const validationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const LogInWithEmail = ({ navigation }: Props) => {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [isChecked, setIsChecked] = useState(false);

  const onSignInPress = useCallback(async () => {
    if (!isLoaded) {
      return;
    }
    const values = getValues();
    try {
      const completeSignIn = await signIn.create({
        identifier: values.email,
        password: values.password,
      });
      // This is an important step,
      // This indicates the user is signed in
      await setActive({ session: completeSignIn.createdSessionId });
    } catch (err: any) {
      console.log(err);
    }
  }, []);

  const {
    control,
    getValues,
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
      <View className="mt-2 mb-4 flex flex-row items-center justify-between">
        <CheckBox
          label="Lembrar senha"
          onToggle={() => setIsChecked(!isChecked)}
          isChecked={isChecked}
        />
        <TouchableOpacity>
          <Text className="text-blue-600">Esqueceu a senha?</Text>
        </TouchableOpacity>
      </View>
      <PrimaryButton onPress={onSignInPress} label="Entrar" />
      <TouchableOpacity
        onPress={() => navigation.replace('SignUp')}
        className="mt-4 flex flex-row justify-center">
        <Text className="text-gray-500">Não tem conta?</Text>
        <Text className="ml-1 font-bold text-blue-600">Crie uma aqui</Text>
      </TouchableOpacity>
    </View>
  );
};

export default LogInWithEmail;
