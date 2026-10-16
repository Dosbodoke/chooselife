import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '~/components/ui/text';

import { IsaMark } from './isa-logo';
import { useIsaAccount } from './use-isa-account';

/** Shown on a profile whose owner connected their ISA account. */
export const IsaBadge: React.FC<{ profileId: string }> = ({ profileId }) => {
  const { t } = useTranslation();
  const { data: isaAccount } = useIsaAccount(profileId);

  if (!isaAccount) return null;

  return (
    <View className="flex-row items-center gap-1">
      <IsaMark width={22} height={8} />
      <Text variant="muted">
        {t('app.profile.[username].isaMember', { isaId: isaAccount.isa_id })}
      </Text>
    </View>
  );
};
