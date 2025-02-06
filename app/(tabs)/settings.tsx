import { Link } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '~/context/auth';

import { MyWebbings } from '~/components/settings/my-webbing';
import { SupabaseAvatar } from '~/components/supabase-avatar';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { H2, Muted } from '~/components/ui/typography';

export default function SettingsPage() {
  const { profile, session, logout } = useAuth();

  if (profile && profile.username) {
    return (
      <SafeAreaView className="justify-between flex-1 p-4 pt-8">
        <View className="gap-4">
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
                <Muted>Visualizar perfil</Muted>
              </View>
            </TouchableOpacity>
          </Link>

          <MyWebbings />
        </View>

        <View className="gap-4">
          <Button variant="link" onPress={logout}>
            <Text className="text-foreground underline">Sair da conta</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1">
      <View className="p-4 gap-4 flex justify-end h-full">
        <Link href={`/login?redirect_to=settings`} asChild>
          <Button className="w-fit bg-primary text-center py-4 text-primary-foreground">
            <Text>Entrar</Text>
          </Button>
        </Link>
      </View>
    </SafeAreaView>
  );
}
