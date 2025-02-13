import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Link } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '~/context/auth';
import { LucideIcon } from '~/lib/icons/lucide-icon';

import { LanguageSwitcher } from '~/components/language-switcher';
import { MyWebbings } from '~/components/settings/my-webbing';
import { SupabaseAvatar } from '~/components/supabase-avatar';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { Text } from '~/components/ui/text';
import { H2, Muted } from '~/components/ui/typography';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { profile, logout } = useAuth();

  if (profile && profile.username) {
    return (
      <SafeAreaView className="justify-between h-full w-full p-4 pt-8">
        <View className="gap-6">
          <Link
            href={{
              pathname: '/profile/[username]',
              params: { username: profile.username },
            }}
            asChild
          >
            <TouchableOpacity className="flex flex-row gap-4">
              <SupabaseAvatar profileID={profile.id} size={16} />
              <View className="flex-1">
                <H2 className="flex-shrink">{profile.name}</H2>
                <Muted>{t('app.(tabs).settings.viewProfile')}</Muted>
              </View>
            </TouchableOpacity>
          </Link>

          <MyWebbings />
        </View>

        <View className="gap-4">
          <ChangeLanguage />
          <Button variant="link" onPress={logout}>
            <Text className="text-foreground underline">
              {t('app.(tabs).settings.logOut')}
            </Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1">
      <View className="p-4 gap-4 flex justify-end h-full">
        <ChangeLanguage />
        <Link href={`/login?redirect_to=settings`} asChild>
          <Button className="w-fit bg-primary text-center py-4 text-primary-foreground">
            <Text>{t('app.(tabs).settings.logIn')}</Text>
          </Button>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const ChangeLanguage: React.FC = () => {
  const { t } = useTranslation();
  const bottomSheetModalRef = React.useRef<BottomSheetModal>(null);

  const openModal = () => {
    bottomSheetModalRef.current?.present({
      velocity: 200,
      stiffness: 200,
      damping: 80,
    });
  };

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  return (
    <>
      <TouchableOpacity className="gap-4" onPress={openModal}>
        <Separator></Separator>
        <View className="flex-row justify-between">
          <View className="flex-row gap-2">
            <LucideIcon
              name="Languages"
              className="size-6 text-muted-foreground"
            />
            <Text>{t('app.(tabs).settings.changeLanguage')}</Text>
          </View>
          <LucideIcon name="ChevronRight" className="size-6 text-foreground" />
        </View>
        <Separator></Separator>
      </TouchableOpacity>
      <BottomSheetModal
        ref={bottomSheetModalRef}
        backdropComponent={renderBackdrop}
        handleComponent={null}
        detached={true}
        bottomInset={46}
        enablePanDownToClose={true}
        style={{
          marginHorizontal: 24,
          elevation: 4,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 4,
          shadowOffset: {
            width: 1,
            height: 1,
          },
        }}
      >
        <BottomSheetView className="p-4 items-center gap-4">
          <LanguageSwitcher />
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
};
