import * as Linking from "expo-linking";
import {
  Link,
  useLocalSearchParams,
  useNavigation,
  usePathname,
} from "expo-router";
import React, { useLayoutEffect } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";
import { Button } from "~/components/ui/button";
import { H1, Lead } from "~/components/ui/typography";
import { Text } from "~/components/ui/text";
import { FavoriteHighline } from "~/components/highline/favorite-button";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useAuth } from "~/context/auth";

const { width } = Dimensions.get("window");
const IMG_HEIGHT = 300;

export default function HighlinePage() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: highline, isPending } = useQuery({
    queryKey: ["highline", id],
    queryFn: async () => {
      const result = await supabase.rpc("get_highline", {
        searchid: [id as string],
        userid: user?.id,
      });
      return result.data && result.data.length > 0 ? result.data[0] : null;
    },
    enabled: !!id,
  });
  const navigation = useNavigation();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "",
      headerTransparent: true,

      headerBackground: () => (
        <Animated.View
          style={[headerAnimatedStyle, styles.header]}
        ></Animated.View>
      ),
      headerRight: () => (
        <View style={styles.bar}>
          <TouchableOpacity style={styles.roundButton} onPress={shareListing}>
            <Ionicons name="share-outline" size={22} color={"#000"} />
          </TouchableOpacity>
          <FavoriteHighline
            isFavorite={!!highline?.is_favorite}
            id={highline?.id}
          />
        </View>
      ),
      headerLeft: () => (
        <TouchableOpacity
          style={styles.roundButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={"#000"} />
        </TouchableOpacity>
      ),
    });
  }, [highline]);

  const scrollOffset = useScrollViewOffset(scrollRef);

  const imageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [-IMG_HEIGHT, 0, IMG_HEIGHT, IMG_HEIGHT],
            [-IMG_HEIGHT / 2, 0, IMG_HEIGHT * 0.75]
          ),
        },
        {
          scale: interpolate(
            scrollOffset.value,
            [-IMG_HEIGHT, 0, IMG_HEIGHT],
            [2, 1, 1]
          ),
        },
      ],
    };
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(scrollOffset.value, [0, IMG_HEIGHT / 1.5], [0, 1]),
    };
  }, []);

  return (
    <View className="flex-1">
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        ref={scrollRef}
        scrollEventThrottle={16}
      >
        {isPending ? (
          <View>
            <Text>LOADING...</Text>
          </View>
        ) : (
          <>
            <Animated.Image
              source={{
                uri: highline?.cover_image
                  ? supabase.storage
                      .from("images")
                      .getPublicUrl(highline.cover_image).data.publicUrl
                  : "",
              }}
              style={[{ height: IMG_HEIGHT, width: width }, imageAnimatedStyle]}
              resizeMode="cover"
            />

            <View className="p-6 gap-2">
              <View>
                <H1>{highline?.name}</H1>
                <Lead>foo in bar</Lead>
              </View>
              <View className="flex flex-row gap-4">
                <Link href={`/highline/${id}/register`} asChild>
                  <Button>
                    <Text className="text-primary-foreground">
                      Registrar rolê
                    </Text>
                  </Button>
                </Link>
                <Button variant="outline">
                  <Text className="text-primary">Adicionar ao mapa</Text>
                </Button>
              </View>

              <Separator className="my-4" />

              <Tabs value="comments" onValueChange={() => {}}>
                <TabsList className="flex flex-row">
                  <TabsTrigger value="info">
                    <Text>Informações</Text>
                  </TabsTrigger>
                  <TabsTrigger value="comment">
                    <Text>Comentários</Text>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="info">
                  <View className="flex flex-row gap-2 items-center">
                    <Text className="text-muted-foreground">Altura:</Text>
                    <Text className="font-medium text-primary">
                      {highline?.height}m
                    </Text>
                  </View>
                  <View className="flex flex-row gap-2 items-center">
                    <Text className="text-muted-foreground">Comprimento:</Text>
                    <Text className="font-medium text-primary">
                      {highline?.lenght}m
                    </Text>
                  </View>
                  <View className="flex flex-row gap-2 items-center">
                    <Text className="text-muted-foreground">
                      Fita principal:
                    </Text>
                    <Text className="font-medium text-primary">
                      {highline?.main_webbing}
                    </Text>
                  </View>
                  <View className="flex flex-row gap-2 items-center">
                    <Text className="text-muted-foreground">Fita backup:</Text>
                    <Text className="font-medium text-primary">
                      {highline?.backup_webbing}
                    </Text>
                  </View>
                </TabsContent>
                <TabsContent value="comments">
                  <Text>BAR CONTENT</Text>
                </TabsContent>
              </Tabs>
            </View>
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 50,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    color: "#000",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  header: {
    backgroundColor: "#fff",
    height: 100,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#222222",
  },
});
