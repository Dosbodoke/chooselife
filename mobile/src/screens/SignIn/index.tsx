import { View, Button } from 'react-native';
import React from 'react';

import { useAuth } from '@src/contexts/auth';

const SignIn = () => {
  const { signIn } = useAuth();

  async function handleSignIn() {
    signIn();
  }

  return (
    <View className="flex items-center justify-center">
      <Button title="Sign in" onPress={handleSignIn} />
    </View>
  );
};

export default SignIn;
