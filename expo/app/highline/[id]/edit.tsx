import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useHighline } from '~/hooks/use-highline';

import { HighlineForm } from '~/components/highline/highline-form';
import { HighlineNotFound } from '~/components/highline/not-found';

const EditHighlineScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { highline, isPending } = useHighline({ id });

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!highline) return <HighlineNotFound />;

  return <HighlineForm highline={highline} />;
};

export default EditHighlineScreen;
