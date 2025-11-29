import { ENABLE_MEMBERSHIP_REGISTRATION } from '@chooselife/ui';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

export const BecomeMember = ({
  slug,
  ref,
}: {
  slug: string;
  ref?: React.RefObject<View | null>;
}) => {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View
      ref={ref}
      className="absolute bottom-0 left-0 w-full px-6 py-4 bg-white"
    >
      <Button onPress={() => router.push(`/organizations/${slug}/member`)}>
        <Text>{t('app.organizations.becomeMember')}</Text>
      </Button>
    </View>
  );
};
