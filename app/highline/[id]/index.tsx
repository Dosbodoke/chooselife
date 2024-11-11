import * as Linking from "expo-linking";
import { Link, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useState, useRef, useMemo } from "react";
import {
  View,
  TouchableOpacity,
  Share,
  ScrollView,
  Image,
  type LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "~/context/auth";
import { supabase } from "~/lib/supabase";
import { FavoriteHighline } from "~/components/highline/favorite-button";
import Info from "~/components/highline/info";
import { HighlineSkeleton } from "~/components/highline/skeleton";

import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "~/components/ui/text";
import { MarkerCL } from "~/lib/icons/MarkerCL";
import { LucideIcon } from "~/lib/icons/lucide-icon";
import { Ranking } from "~/components/ranking";

type HighlineTabs = "details" | "ranking";

export default function HighlinePage() {
  const [tab, setTab] = useState<HighlineTabs>("details");
  const bottomActionsHeightRef = useRef(0);
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
      const url = Linking.createURL(`highline/${highline.id}`);
      const message = `🚀 Confira esse Highline incrível no APP Chooselife: "${highline.name}"!\n\nBaixe o app para explorar mais locais, rankings e atividades exclusivas no mundo das highlines.\n\n🔗 Acesse agora: ${url}`;

      await Share.share({
        title: "Veja no Chooselife",
        message, // Usamos "message" para compatibilidade com Android e iOS
      });
    } catch (err) {
      console.log("Erro ao compartilhar a highline:", err);
    }
  };

  const tabs = useMemo(
    () => [
      {
        id: "details",
        label: "Detalhes",
        content: <Info />,
      },
      {
        id: "ranking",
        label: "Ranking",
        content: <Ranking highlines_ids={[highline?.id || ""]} />,
      },
    ],
    [highline?.id]
  );

  if (isPending) {
    return <HighlineSkeleton />;
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
      <ScrollView
        contentContainerStyle={{
          paddingBottom: bottomActionsHeightRef.current + 26,
        }}
      >
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

        <View className="px-4 pt-4 gap-6 flex-1">
          <Tabs
            className="flex-1"
            value={tab}
            onValueChange={(val) => setTab(val as HighlineTabs)}
          >
            <TabsList className="flex-row">
              {tabs.map((tabItem) => (
                <TabsTrigger
                  key={tabItem.id}
                  className="rounded-lg flex-1"
                  value={tabItem.id as HighlineTabs}
                >
                  <Text>{tabItem.label}</Text>
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((tabItem) => (
              <TabsContent
                key={tabItem.id}
                className="flex-1 mt-6"
                value={tabItem.id as HighlineTabs}
              >
                {tabItem.content}
              </TabsContent>
            ))}
          </Tabs>
        </View>
      </ScrollView>

      {tab === "details" ? (
        <BottomActions
          hasLocation={!!highline.anchor_a_lat}
          onLayout={(event) => {
            bottomActionsHeightRef.current = event.nativeEvent.layout.height;
          }}
        />
      ) : null}
    </>
  );
}

const BottomActions = ({
  hasLocation,
  onLayout,
}: {
  hasLocation: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
}) => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  return (
    <View
      onLayout={onLayout}
      className="absolute bottom-0 flex flex-row gap-4 w-full bg-background px-2 pt-4 border-t border-muted"
      style={{
        paddingBottom: insets.bottom,
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,

        elevation: 4,
      }}
    >
      <Link className="flex-1" href={`/?focusedMarker=${id}`} asChild>
        <Button className="flex-1 flex-row gap-2 items-start" variant="outline">
          {hasLocation ? (
            <>
              <LucideIcon name="Earth" className="size-6 text-primary" />
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
  );
};
