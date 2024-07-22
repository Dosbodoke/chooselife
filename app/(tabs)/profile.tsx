import { View, Text, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card, CardContent } from "~/components/ui/card";
import { H1, H2, H3, Lead, Muted, P } from "~/components/ui/typography";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { supabase } from "~/lib/supabase";
import { useEffect, useState } from "react";
import { Database } from "~/utils/database.types";
import { useSession } from "~/context/auth";

export default function Profile() {
  const { user } = useSession();

  const [profile, setProfile] = useState<
    Database["public"]["Tables"]["profiles"]["Row"] | null
  >(null);
  const [stats, setStats] = useState<{
    total_distance_walked: number;
    total_cadenas: number;
    total_full_lines: number;
  } | null>(null);

  useEffect(() => {
    getProfile();
  }, [user]);

  async function getProfile() {
    if (!user) return;
    try {
      const profile = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile.data) {
        setProfile(profile.data);
      }

      const stats = await supabase
        .rpc("profile_stats", {
          username: `@${profile.data?.username}`,
        })
        .single();

      if (stats.data) {
        setStats(stats.data);
      }

      // if (error && status !== 406) {
      //   throw error;
      // }
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert(error.message);
      }
    }
  }

  if (!profile) {
    return (
      <SafeAreaView className="flex-1">
        <Text>Faça login</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1">
      <View className="flex gap-4 pt-4 px-2">
        <UserHeader profile={profile} username={`${profile?.username}`} />
        <Stats
          total_cadenas={stats?.total_cadenas || 0}
          total_distance_walked={stats?.total_distance_walked || 0}
          total_full_lines={stats?.total_full_lines || 0}
        />
      </View>
    </SafeAreaView>
  );
}

const UserHeader = ({
  profile,
  username,
}: {
  profile: Database["public"]["Tables"]["profiles"]["Row"] | null;
  username: string;
}) => {
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
          <ProfileAvatar />
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
          <ProfileAvatar />
          <View className="flex flex-1">
            <H3 numberOfLines={1}>{profile.name}</H3>
            <Muted className="text-lg">{username}</Muted>
          </View>
        </View>
        <P>{profile.description}</P>
      </CardContent>
    </Card>
  );
};

const ProfileAvatar = () => {
  return (
    <Avatar
      alt="Zach Nugent's Avatar"
      className="w-full h-full max-w-24 max-h-24"
    >
      <AvatarImage source={{ uri: "https://github.com/mrzachnugent.png" }} />
      <AvatarFallback>
        <Text>ZN</Text>
      </AvatarFallback>
    </Avatar>
  );
};

const Stats = ({
  total_distance_walked,
  total_cadenas,
  total_full_lines,
}: {
  total_distance_walked: number;
  total_cadenas: number;
  total_full_lines: number;
}) => {
  const displayDistanceInKM = total_distance_walked > 10000;

  return (
    <Card>
      <CardContent className="flex flex-row justify-evenly items-center px-2 py-4 sm:gap-8">
        <View className="flex items-center justify-center gap-2">
          <H2 className="font-extrabold">
            {displayDistanceInKM
              ? total_distance_walked / 1000
              : total_distance_walked}
            <Text>{displayDistanceInKM ? "km" : "m"}</Text>
          </H2>
          <Lead className="text-base">Walked</Lead>
        </View>

        <View className="bg-gray-200 w-px h-full"></View>

        <View className="flex items-center justify-center gap-2">
          <H2 className="font-extrabold">{total_cadenas}</H2>
          <Lead className="text-base">Cadenas</Lead>
        </View>

        <View className="bg-gray-200 w-px h-full"></View>

        <View className="flex items-center justify-center gap-2">
          <H2 className="font-extrabold">{total_full_lines}</H2>
          <Lead className="text-base">Full lines</Lead>
        </View>
      </CardContent>
    </Card>
  );
};

function UserNotFound({ username }: { username: string }) {
  return (
    <View className="mx-auto max-w-screen-xl px-4 py-8 lg:px-6 lg:py-16">
      <View className="mx-auto max-w-screen-sm text-center">
        <P className="mb-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
          FOO
        </P>
        <P className="mb-4 text-lg font-light text-gray-500 dark:text-gray-400">
          usuário @{username} não existe
        </P>
        <View className="my-4 flex justify-center gap-4">
          <Text>foo</Text>
        </View>
      </View>
    </View>
  );
}
