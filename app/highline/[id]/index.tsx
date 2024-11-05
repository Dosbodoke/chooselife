import * as Linking from "expo-linking";
import { Link, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useState } from "react";
import { View, TouchableOpacity, Share, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";
import { Button } from "~/components/ui/button";
import { H1, Lead } from "~/components/ui/typography";
import { FavoriteHighline } from "~/components/highline/favorite-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useAuth } from "~/context/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "~/components/ui/text";
import Info from "~/components/highline/info";
import { MarkerCL } from "~/lib/icons/MarkerCL";
import { LucideIcon } from "~/lib/icons/lucide-icon";

export default function HighlinePage() {
  const [tab, setTab] = useState("info");
  const insets = useSafeAreaInsets();

  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: highline, isPending } = useQuery({
    queryKey: ["highline", id],
    queryFn: async () => {
      const result = await supabase.rpc("get_highline", {
        searchid: [id as string],
        userid: session?.user.id,
      });
      return result.data && result.data.length > 0 ? result.data[0] : null;
    },
    enabled: !!id,
  });
  const navigation = useNavigation();

  const shareListing = async () => {
    if (!highline) return;
    try {
      await Share.share({
        title: highline?.name,
        url: Linking.createURL(`highline/${highline.id}`),
      });
    } catch (err) {
      console.log(err);
    }
  };

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>CARREGANDO...</Text>
      </View>
    );
  }

  if (!highline) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Highline não existe</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView contentContainerClassName="flex-1">
        <View
          className="absolute px-4 flex-row justify-between w-full top-0 z-50"
          style={{
            paddingTop: insets.top,
          }}
        >
          <TouchableOpacity
            className="size-10 rounded-full bg-white items-center justify-center"
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color={"#000"} />
          </TouchableOpacity>
          <View className="flex-row items-center justify-center gap-3">
            <TouchableOpacity
              className="size-10 rounded-full bg-white items-center justify-center"
              onPress={shareListing}
            >
              <Ionicons name="share-outline" size={22} color={"#000"} />
            </TouchableOpacity>
            <FavoriteHighline
              isFavorite={!!highline?.is_favorite}
              id={highline?.id}
            />
          </View>
        </View>
        <Image
          className="w-full h-96"
          source={{
            uri: highline?.cover_image
              ? supabase.storage
                  .from("images")
                  .getPublicUrl(highline.cover_image).data.publicUrl
              : "",
          }}
          resizeMode="cover"
        />

        <View className="p-4 gap-6">
          <View>
            <H1>{highline?.name}</H1>
            {highline?.description ? <Lead>{highline.description}</Lead> : null}
          </View>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex-row mb-6">
              <TabsTrigger className="rounded-lg" value="info">
                <Text>Informações</Text>
              </TabsTrigger>
              <TabsTrigger className="rounded-lg" value="comments">
                <Text>Comentários</Text>
              </TabsTrigger>
              <TabsTrigger className="rounded-lg" value="rakning">
                <Text>Ranking</Text>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="info">
              <Info />
            </TabsContent>
            <TabsContent value="comments">
              <Text>BAR CONTENT</Text>
            </TabsContent>
          </Tabs>
        </View>
      </ScrollView>

      {/* BOTTOM ACTIONS */}
      <View
        className="absolute bottom-0 flex flex-row gap-4 w-full p-2 pt-4 border-t border-muted"
        style={{
          paddingBottom: insets.bottom,
        }}
      >
        <Link
          className="flex-1"
          href={`/?focusedMarker=${highline.id}`}
          asChild
        >
          <Button
            className="flex-1 flex-row gap-2 items-center"
            variant="outline"
          >
            {highline.anchor_a_lat ? (
              <>
                <LucideIcon name="Earth" className="size-4 text-primary" />
                <Text className="text-primary">Ver no mapa</Text>
              </>
            ) : (
              <>
                <View className="size-8 text-primary">
                  <MarkerCL props={{}} active={false} />
                </View>
                <Text className="text-primary">Adicionar ao mapa</Text>
              </>
            )}
          </Button>
        </Link>

        <Link className="flex-1" href={`/highline/${id}/register`} asChild>
          <Button>
            <Text className="text-primary-foreground">Registrar rolê</Text>
          </Button>
        </Link>
      </View>
    </>
  );
}
