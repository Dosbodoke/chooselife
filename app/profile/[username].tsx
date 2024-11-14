import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { Text } from "~/components/ui/text";
import { Card, CardContent } from "~/components/ui/card";
import { H1, H2, H3, Lead, Muted, P } from "~/components/ui/typography";
import { SupabaseAvatar } from "~/components/ui/avatar";
import { supabase } from "~/lib/supabase";
import { Database } from "~/utils/database.types";
import { Button } from "~/components/ui/button";
import { LucideIcon } from "~/lib/icons/lucide-icon";

export default function Profile() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();

  const { data: profile, isPending: profilePending } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      if (!username) throw new Error("No username provided");
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();
      return data;
    },
    enabled: !!username,
  });

  const { data: stats } = useQuery({
    queryKey: ["profile", username, "stats"],
    queryFn: async () => {
      if (!profile) throw new Error("Profile doesn't exists");
      const stats = await supabase
        .rpc("profile_stats", {
          username: `@${profile.username}`,
        })
        .single();

      return stats.data;
    },
    enabled: !!profile,
  });

  if (profilePending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!profile) {
    return <UserNotFound username={username ?? ""} />;
  }

  return (
    <SafeAreaView className="flex-1 gap-4 pt-4 px-2">
      <View className="flex-row items-center">
        <TouchableOpacity
          className="p-2 rounded-full items-center justify-center"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)")
          }
        >
          <LucideIcon name="ChevronLeft" className="text-primary size-6" />
        </TouchableOpacity>
        <Text className="text-primary font-semibold text-xl">{username}</Text>
      </View>
      <UserHeader profile={profile} username={`${profile?.username}`} />
      <Stats
        total_cadenas={stats?.total_cadenas || 0}
        total_distance_walked={stats?.total_distance_walked || 0}
        total_full_lines={stats?.total_full_lines || 0}
      />
    </SafeAreaView>
  );
}

const UserHeader: React.FC<{
  profile: Database["public"]["Tables"]["profiles"]["Row"] | null;
  username: string;
}> = ({ profile, username }) => {
  function calculateAge(birthday: string) {
    const birthdate = new Date(birthday);
    const today = new Date();

    // Get the difference between today and the user's birthdate
    let age = today.getFullYear() - birthdate.getFullYear();

    // Check if the current month is before the user's birth month,
    // or if it is their birth month but today is earlier than their actual birthday
    if (
      today.getMonth() < birthdate.getMonth() ||
      (today.getMonth() == birthdate.getMonth() &&
        today.getDate() < birthdate.getDate())
    ) {
      age--;
    }

    return age;
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="flex flex-row gap-4 overflow-hidden px-2 py-4">
          <SupabaseAvatar name={""} profilePicture={""} />
          <View className="flex gap-3">
            <H1>{username}</H1>
            <View className="rounded-lg bg-red-50 p-2 text-center text-sm text-red-500 dark:bg-red-100 dark:text-red-700 md:p-4">
              <Text>Usuário não é verificado</Text>
            </View>
          </View>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex gap-4 overflow-hidden px-2 py-4">
        <View className="flex flex-row mt-4 gap-4">
          <SupabaseAvatar
            name={profile.name ?? ""}
            profilePicture={profile.profile_picture ?? ""}
          />
          <View className="flex flex-1">
            <H3 numberOfLines={1}>{profile.name}</H3>
            {profile.birthday ? (
              <View className="flex-row gap-1">
                <LucideIcon
                  name="Calendar"
                  className="size-4 text-muted-foreground"
                />
                <Muted>{calculateAge(profile.birthday)}</Muted>
              </View>
            ) : null}
          </View>
        </View>
        <P>{profile.description}</P>
      </CardContent>
    </Card>
  );
};

const Stats: React.FC<{
  total_distance_walked: number;
  total_cadenas: number;
  total_full_lines: number;
}> = ({ total_distance_walked, total_cadenas, total_full_lines }) => {
  const displayDistanceInKM = total_distance_walked > 10000;

  return (
    <Card>
      <CardContent className="flex flex-row justify-evenly items-center px-2 py-4 sm:gap-8">
        <View className="flex items-center justify-center gap-2">
          <View className="flex-row">
            <Text className="text-3xl font-extrabold">
              {displayDistanceInKM
                ? total_distance_walked / 1000
                : total_distance_walked}
            </Text>
            <Text className="text-3xl font-extrabold text-muted-foreground">
              {displayDistanceInKM ? "km" : "m"}
            </Text>
          </View>
          <Lead className="text-base">Walked</Lead>
        </View>

        <View className="bg-gray-200 w-px h-full"></View>

        <View className="flex items-center justify-center gap-2">
          <Text className="text-3xl font-extrabold">{total_cadenas}</Text>
          <Lead className="text-base">Cadenas</Lead>
        </View>

        <View className="bg-gray-200 w-px h-full"></View>

        <View className="flex items-center justify-center gap-2">
          <Text className="text-3xl font-extrabold">{total_full_lines}</Text>
          <Lead className="text-base">Full lines</Lead>
        </View>
      </CardContent>
    </Card>
  );
};

const UserNotFound: React.FC<{ username: string }> = ({ username }) => {
  const router = useRouter();

  const canGoBack = router.canGoBack();

  return (
    <SafeAreaView className="flex-1">
      <View className="flex items-center justify-center h-full gap-4">
        <H2>usuário {username} não existe</H2>
        <Button
          onPress={() => {
            if (canGoBack) {
              router.back();
            }
          }}
        >
          <Text>{canGoBack ? "Voltar" : "Ir para página inicial"}</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
};
