import { Link } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '~/context/auth';

import { SelectTheme } from '~/components/settings/select-theme';
import { SupabaseAvatar } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { Text } from '~/components/ui/text';
import { H2, Muted } from '~/components/ui/typography';

export default function SettingsPage() {
  const { profile, session, logout } = useAuth();

  if (!session) {
    return (
      <SafeAreaView className="flex-1">
        <View className="p-4 gap-4 flex justify-end h-full">
          <Separator />

          <SelectTheme />

          <Separator />
          <Link href={`/login?redirect_to=settings`} asChild>
            <Button className="w-fit bg-primary text-center py-4 text-primary-foreground">
              <Text>Entrar</Text>
            </Button>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  if (profile && profile.username) {
    return (
      <SafeAreaView className="flex-1">
        <View className="flex gap-4 p-4 pt-8">
          <Link
            href={{
              pathname: '/profile/[username]',
              params: { username: profile.username },
            }}
            asChild
          >
            <TouchableOpacity className="flex flex-row gap-4">
              <SupabaseAvatar
                profilePicture={profile.profile_picture || ''}
                name={profile.name || ''}
              />
              <View>
                <H2>{profile.name}</H2>
                <Muted>Mostrar perfil</Muted>
              </View>
            </TouchableOpacity>
          </Link>

          <Separator />

          <SelectTheme />

          <Separator />

          <Button variant="link" onPress={logout}>
            <Text className="text-foreground underline">Sair da conta</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }
}
