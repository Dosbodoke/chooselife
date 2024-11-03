import { Link } from "expo-router";
import { View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

import { Text } from "~/components/ui/text";
import { Button } from "~/components/ui/button";
import { H2, Muted } from "~/components/ui/typography";
import { useAuth } from "~/context/auth";
import { supabase } from "~/lib/supabase";
import { Separator } from "~/components/ui/separator";
import { SelectTheme } from "~/components/settings/select-theme";

function getShortName(fullName: string) {
  const nameParts = fullName.trim().split(/\s+/);
  const shortName = nameParts
    .filter((part) => part.length > 0) // Exclude empty parts in case of multiple spaces
    .map((part) => part[0].toUpperCase()) // Get the first letter and convert to uppercase
    .filter((letter, index, array) => index === 0 || index === array.length - 1) // Get first and last initials
    .join("");
  return shortName;
}

export default function SettingsPage() {
  const { profile, logout } = useAuth();

  if (profile) {
    return (
      <SafeAreaView className="flex-1">
        <View className="flex gap-4 p-4 pt-8">
          <Link href={`profile/${profile.username}`} asChild>
            <TouchableOpacity className="flex flex-row gap-4">
              <Avatar className="h-16 w-16" alt="Foto do perfil">
                <AvatarImage
                  source={{
                    uri: supabase.storage
                      .from("images")
                      .getPublicUrl(profile.profile_picture || "").data
                      .publicUrl,
                  }}
                />
                <AvatarFallback>
                  <Text>{getShortName(profile.name || "")}</Text>
                </AvatarFallback>
              </Avatar>
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
