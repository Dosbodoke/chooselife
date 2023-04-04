import React from 'react';
import { View, ActivityIndicator } from 'react-native';

import { useAuth } from '@src/contexts/auth';

import RootRoutes from './app.routes';
import AuthRoutes from './auth.routes';

const Routes: React.FC = () => {
  const { signed, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#666" />
      </View>
    );
  }

  return signed ? <RootRoutes /> : <AuthRoutes />;
};

export default Routes;
