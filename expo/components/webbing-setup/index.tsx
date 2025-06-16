import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';

import { useRiggingForm } from '~/context/rig-form';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Text } from '~/components/ui/text';
import { WebList } from '~/components/webbing-setup/sortable-webbing-list';
import { WebForm } from '~/components/webbing-setup/web-form';

import { SetupCanva, type WebbingValidationErrors } from './setup-canvas';

const DAMPING = 14;
export const _layoutAnimation = LinearTransition.springify().damping(DAMPING);
export const _exitingAnimation = FadeOut.springify().damping(DAMPING);
export const _enteringAnimation = FadeInDown.springify().damping(DAMPING);
const AnimatedCard = Animated.createAnimatedComponent(Card);

export const WebbingSetup: React.FC = () => {
  const { t } = useTranslation();
  const {
    form,
    main,
    backup,
    focusedWebbing,
    highlineLength,
    setFocusedWebbing,
    handleNewSection,
  } = useRiggingForm();

  const [webbingValidationErrors, setWebbingValidationErrors] =
    useState<WebbingValidationErrors>({});

  return (
    <AnimatedCard layout={_layoutAnimation} className="w-full">
      <CardHeader className="gap-3">
        <CardTitle>{t('components.webbing-setup.equipments.title')}</CardTitle>
        <View className="flex-row flex-wrap justify-between">
          <View className="flex-row gap-1 items-baseline">
            <View className="w-6 h-2 bg-red-500" />
            <Text className="text-muted-foreground">
              {t('components.webbing-setup.equipments.main')}
            </Text>
          </View>

          <View className="flex-row gap-1 items-baseline">
            <View className="w-6 h-2 bg-blue-500" />
            <Text className="text-muted-foreground">
              {t('components.webbing-setup.equipments.backup')}
            </Text>
          </View>

          <View className="flex-row gap-1 items-baseline">
            <View className="w-4 h-2 bg-black" />
            <Text className="text-muted-foreground">
              {t('components.webbing-setup.equipments.loop')}
            </Text>
          </View>

          <View className="flex-row gap-1 items-baseline">
            <View className="w-4 h-2 bg-green-500" />
            <Text className="text-muted-foreground">
              {t('components.webbing-setup.equipments.connection')}
            </Text>
          </View>
        </View>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden">
        <SetupCanva
          form={form}
          mainSections={main.fields}
          backupSections={backup.fields}
          focusedWebbing={focusedWebbing}
          highlineLength={highlineLength}
          setFocusedWebbing={setFocusedWebbing}
          onValidationError={setWebbingValidationErrors}
        />
      </CardContent>

      <CardFooter className="border-border border-t pt-4">
        {focusedWebbing ? (
          <WebForm />
        ) : (
          <WebList
            backupSections={backup.fields}
            mainSections={main.fields}
            errorMessages={webbingValidationErrors}
            setFocusedWebbing={setFocusedWebbing}
            swapMain={main.swap}
            swapBackup={backup.swap}
            handleNewSection={handleNewSection}
          />
        )}
      </CardFooter>
    </AnimatedCard>
  );
};
