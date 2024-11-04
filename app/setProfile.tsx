import React, { useState } from "react";
import { ActivityIndicator, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { PostgrestError } from "@supabase/supabase-js";

import { supabase } from "~/lib/supabase";
import { useAuth } from "~/context/auth";

import HighlineIllustration from "~/lib/icons/highline-illustration";
import { KeyboardAwareScrollView } from "~/components/KeyboardAwareScrollView";
import { H2, H3, Muted } from "~/components/ui/typography";
import { Button, buttonTextVariants } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { useColorScheme } from "~/lib/useColorScheme";
import { cn } from "~/lib/utils";

export default function SetProfile() {
  const colorSchema = useColorScheme();
  const { session, setProfile } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUsernameChange = (text: string) => {
    const trimmedText = text.trim();
    setUsername(trimmedText);

    // Validate username length on each text change
    if (trimmedText.length > 0 && trimmedText.length < 3) {
      setError("O nome de usuário deve ter pelo menos 3 caracteres.");
    } else {
      setError(""); // Clear error if validation passes
    }
  };

  const handleSaveProfile = async () => {
    if (!session) return;
    if (!username) {
      setError("Escolha um nome para continuar.");
      return;
    }

    try {
      setIsLoading(true);
      const { data, error: upsertError } = await supabase
        .from("profiles")
        .upsert({
          id: session.user.id,
          username: `@${username}`,
        })
        .select()
        .single();

      if (upsertError) {
        throw upsertError;
      }

      setProfile(data);
      router.replace("/");
    } catch (error) {
      // Duplicated key error, means that the username already exists
      if (error && (error as PostgrestError).code === "23505") {
        setError("Nome já escolhido, tente outro");
      } else {
        setError("Erro ao salvar o perfil. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAwareScrollView
        contentContainerClassName="px-6 py-8 gap-4"
        keyboardShouldPersistTaps="handled"
      >
        <H2 className="text-center border-0">Estamos quase lá!</H2>
        <HighlineIllustration
          mode={colorSchema.colorScheme}
          className="w-full h-auto"
        />

        <View>
          <H3 className="text-center">Primeiro, escolha um nome</H3>
          <Muted className="text-center">
            É assim que você será identificado no app
          </Muted>
        </View>

        <View className="flex-row items-center justify-center gap-1 my-4">
          <Text className="text-muted-foreground font-semibold text-3xl">
            @
          </Text>
          <TextInput
            value={username}
            onChangeText={handleUsernameChange}
            placeholder="Seu username"
            autoCapitalize="none"
            returnKeyType="done"
            className="text-foreground placeholder:text-muted-foreground border-b-hairline"
          />
        </View>

        {error ? (
          <Animated.View entering={FadeIn} exiting={FadeOut} className="mb-4">
            <Text className="text-red-500 text-center">{error}</Text>
          </Animated.View>
        ) : null}

        <Button
          variant="default"
          onPress={handleSaveProfile}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator
              className={cn(buttonTextVariants({ variant: "default" }))}
            />
          ) : (
            <Text>Continuar</Text>
          )}
        </Button>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
