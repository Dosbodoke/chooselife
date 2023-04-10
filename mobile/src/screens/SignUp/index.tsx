import { useState } from 'react';
import { View, StatusBar, SafeAreaView, Text, TouchableOpacity } from 'react-native';
import { useSignUp } from '@clerk/clerk-expo';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import { ChooselifeSvg } from '@src/assets';
import { SignUpScreenProps } from '@src/navigation/types';

import Verification from './Verification';
import AuthForm from './AuthForm';

const SignUp = ({ navigation }: SignUpScreenProps) => {
  const { isLoaded, signUp, setActive } = useSignUp();
  const [pendingVerification, setPendingVerification] = useState(false);

  // start the sign up process.
  const onSignUpPress = async (
    emailAddress: string,
    password: string,
    handleError: (error: string) => void
  ) => {
    if (!isLoaded) {
      return;
    }

    try {
      await signUp.create({
        emailAddress,
        password,
      });

      // send the email.
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });

      // change the UI to our pending section.
      setPendingVerification(true);
    } catch (err: any) {
      if (err.errors[0].code === 'form_identifier_exists') {
        handleError('Email já cadastrado, tente outro');
      }
    }
  };

  // This verifies the user using email code that is delivered.
  const onPressVerify = async (code: string, handleError: (error: string) => void) => {
    if (!isLoaded) {
      return;
    }

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      await setActive({ session: completeSignUp.createdSessionId });
    } catch (err: any) {
      if (err.errors[0]?.code === 'form_code_incorrect') {
        handleError('Código incorreto!');
      }
    }
  };

  return (
    <KeyboardAwareScrollView
      showsVerticalScrollIndicator={false}
      extraHeight={140}
      className="flex flex-1 bg-white px-2">
      <StatusBar barStyle="dark-content" />
      <SafeAreaView />
      <View className="my-10 mx-auto h-44 w-44">
        <ChooselifeSvg />
      </View>
      {pendingVerification ? (
        <Verification onPressVerify={onPressVerify} />
      ) : (
        <AuthForm onSignUpPress={onSignUpPress} />
      )}
      <TouchableOpacity
        className="mt-4 flex flex-row justify-center"
        onPress={() => navigation.replace('LogIn')}>
        <Text className="text-gray-500">Já tem uma conta?</Text>
        <Text className="ml-1 font-bold text-blue-600">entre aqui</Text>
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
};

export default SignUp;
