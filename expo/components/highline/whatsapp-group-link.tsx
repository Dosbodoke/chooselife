import * as Linking from 'expo-linking';
import { ExternalLinkIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from 'react-native';

import { WhatsAppIcon } from '~/lib/icons/WhatsApp';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

/** Pill under the highline description that opens its WhatsApp group. */
export const WhatsAppGroupLink: React.FC<{ url: string }> = ({ url }) => {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(url)}
      activeOpacity={0.7}
      accessibilityRole="link"
      className="self-start flex-row items-center gap-2 rounded-full bg-white px-3.5 py-2"
    >
      <WhatsAppIcon width={16} height={16} />
      <Text className="text-sm font-semibold text-foreground">
        {t('components.highline.info.whatsappGroup')}
      </Text>
      <Icon as={ExternalLinkIcon} className="size-3.5 text-muted-foreground" />
    </TouchableOpacity>
  );
};
