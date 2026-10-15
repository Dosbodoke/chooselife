import { BadgeCheckIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

import { useIsaAccount } from './use-isa-account';

/** Shown on a profile whose owner connected their ISA account. */
export const IsaBadge: React.FC<{ profileId: string }> = ({ profileId }) => {
  const { t } = useTranslation();
  const { data: isaAccount } = useIsaAccount(profileId);

  if (!isaAccount) return null;

  return (
    <View className="flex-row items-center gap-1">
      <Icon as={BadgeCheckIcon} className="size-4 text-primary" />
      <Text variant="muted">
        {t('app.profile.[username].isaMember', { isaId: isaAccount.isa_id })}
      </Text>
    </View>
  );
};
