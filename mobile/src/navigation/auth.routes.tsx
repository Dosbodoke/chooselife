import React from 'react';
import { SignIn, SignUp } from '@src/screens';

import { createStackNavigator } from '@react-navigation/stack';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

const AuthStack = createStackNavigator<AuthStackParamList>();

const AuthRoutes: React.FC = () => (
  <AuthStack.Navigator initialRouteName="SignIn" screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="SignIn" component={SignIn} />
    <AuthStack.Screen name="SignUp" component={SignUp} />
  </AuthStack.Navigator>
);

export default AuthRoutes;
