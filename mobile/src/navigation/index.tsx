import React from 'react';
import { View, ActivityIndicator } from 'react-native';

// import { useAuth } from '@src/contexts/auth';
import { useAuth } from '@clerk/clerk-expo';

import RootRoutes from './app.routes';
import AuthRoutes from './auth.routes';

const Routes: React.FC = () => {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View className="flex flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#666" />
      </View>
    );
  }

  return isSignedIn ? <RootRoutes /> : <AuthRoutes />;
};

export default Routes;
