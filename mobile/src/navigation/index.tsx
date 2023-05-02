import React from 'react';
import { View, ActivityIndicator } from 'react-native';

import { useProfile } from '@src/hooks/useProfile';

import AuthRoutes from './auth.routes';
import TabRoutes from './tab.routes';

const Routes: React.FC = () => {
  const { profile, isLoaded } = useProfile();

  if (!isLoaded) {
    return (
      <View className="flex flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#666" />
      </View>
    );
  }

  return profile ? <TabRoutes /> : <AuthRoutes />;
};

export default Routes;
