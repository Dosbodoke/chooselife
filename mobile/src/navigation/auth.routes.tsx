import React from 'react';
import { SignIn } from '@src/screens';

import { createStackNavigator } from '@react-navigation/stack';

const AuthStack = createStackNavigator();

const AuthRoutes: React.FC = () => (
  <AuthStack.Navigator>
    <AuthStack.Screen name="SignIn" component={SignIn} />
  </AuthStack.Navigator>
);

export default AuthRoutes;
