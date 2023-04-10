import React from 'react';
import { LogIn, SignUp } from '@src/screens';

import { createStackNavigator } from '@react-navigation/stack';

export type AuthStackParamList = {
  LogIn: undefined;
  SignUp: undefined;
};

const AuthStack = createStackNavigator<AuthStackParamList>();

const AuthRoutes: React.FC = () => (
  <AuthStack.Navigator initialRouteName="LogIn" screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="LogIn" component={LogIn} />
    <AuthStack.Screen name="SignUp" component={SignUp} />
  </AuthStack.Navigator>
);

export default AuthRoutes;
