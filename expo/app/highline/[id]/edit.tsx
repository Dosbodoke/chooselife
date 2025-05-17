import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHighline } from '~/hooks/use-highline';

import { HighlineForm } from '~/components/highline/highline-form';
import { HighlineNotFound } from '~/components/highline/not-found';
import { Text } from '~/components/ui/text';

const EditHighlineScreen = () => {
  const insets = useSafeAreaInsets();
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

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Highline', // Optional title
          headerBackVisible: true, // This enables the back button
          headerBackTitle: 'Back',
          // Optional custom back button:
          headerLeft: (props) => <Text className="text-black">- Voltar</Text>,
        }}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={{
          paddingBottom: 32 + insets.bottom + insets.top, // pb-8 === 32px
        }}
        keyboardShouldPersistTaps="handled"
      >
        <HighlineForm highline={highline} />
      </KeyboardAwareScrollView>
    </>
  );
};

export default EditHighlineScreen;
