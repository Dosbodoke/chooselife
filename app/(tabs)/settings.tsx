import { Link } from 'expo-router';
import i18next from 'i18next';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '~/context/auth';
import { LucideIcon } from '~/lib/icons/lucide-icon';

import { MyWebbings } from '~/components/settings/my-webbing';
import { SupabaseAvatar } from '~/components/supabase-avatar';
import { Button } from '~/components/ui/button';
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
              <View>
                <H2>{profile.name}</H2>
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

  const handleChangeLanguage = () => {
    i18next.changeLanguage('en-US');
  };

  return (
    <TouchableOpacity
      className="flex-row justify-between"
      onPress={handleChangeLanguage}
    >
      <View className="flex-row gap-1">
        <LucideIcon name="Languages" className="size-6 text-primary" />
        <Text>{t('app.(tabs).settings.changeLanguage')}</Text>
      </View>
      <LucideIcon name="ChevronRight" className="size-6 text-primary" />
    </TouchableOpacity>
  );
};
