import React from 'react';
import { View, ActivityIndicator } from 'react-native';

import { useProfile } from '@src/hooks/useProfile';

import RootRoutes from './app.routes';
import AuthRoutes from './auth.routes';

const Routes: React.FC = () => {
  const { data, isLoading } = useProfile();

  if (isLoading) {
    return (
      <View className="flex flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#666" />
      </View>
    );
  }

  return data ? <RootRoutes /> : <AuthRoutes />;
};

export default Routes;
