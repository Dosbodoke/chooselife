import { useEffect, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "expo-sqlite/kv-store";
import { SafeAreaView } from "react-native-safe-area-context";

import { KeyboardAwareScrollView } from "~/components/KeyboardAwareScrollView";
import { Button, buttonTextVariants } from "~/components/ui/button";
import { Input, PasswordInput } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/auth";
import { GoogleIcon } from "~/lib/icons/Google";
import { AppleIcon } from "~/lib/icons/Apple";
import { useColorScheme } from "~/lib/useColorScheme";
import { Separator } from "~/components/ui/separator";
import ChooselifeIcon from "~/lib/icons/chooselife-icon";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { cn } from "~/lib/utils";

type LastUsedLoginMethod = "apple" | "google" | "email";

const Page = () => {
  const [lastLoginMethod, setLastLoginMethod] =
    useState<LastUsedLoginMethod | null>(null);

  const saveLoginMethod = async (method: LastUsedLoginMethod) => {
    try {
      await AsyncStorage.setItem("lastLoginMethod", method);
    } catch (error) {
      console.error("Failed to save the login method:", error);
    }
  };

  const loadLastLoginMethod = async () => {
    try {
      const method = await AsyncStorage.getItem("lastLoginMethod");
      setLastLoginMethod(method as LastUsedLoginMethod);
    } catch (error) {
      console.error("Failed to load the login method:", error);
    }
  };

  useEffect(() => {
    loadLastLoginMethod();
  }, []);

  return (
    <SafeAreaView className="flex-1">
      <KeyboardAwareScrollView
        contentContainerClassName="px-6 pt-3 pb-8 gap-4"
        keyboardShouldPersistTaps="handled"
      >
        <LogoSection />
        <View>
          <OAuthButtons
            lastLoginMethod={lastLoginMethod}
            saveLoginMethod={saveLoginMethod}
          />
          <MethodSeparator />
          <EmailLoginSection
            lastLoginMethod={lastLoginMethod}
            saveLoginMethod={saveLoginMethod}
          />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const LogoSection = () => {
  return (
    <View className="items-center gap-2 pt-8">
      <ChooselifeIcon width={96} height={96} className="fill-foreground" />
      <Text className="text-center">
        O único aplicativo feito para Highliners
      </Text>
    </View>
  );
};

const OAuthButtons = ({
  lastLoginMethod,
  saveLoginMethod,
}: {
  lastLoginMethod: LastUsedLoginMethod | null;
  saveLoginMethod: (method: LastUsedLoginMethod) => Promise<void>;
}) => {
  const { performOAuth } = useAuth();
  const router = useRouter();
  const { colorScheme } = useColorScheme();

  const handleLogin = async (method: "apple" | "google") => {
    const { success } = await performOAuth(method);
    if (success) {
      await saveLoginMethod(method);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)");
      }
    }
  };

  return (
    <View className="gap-2">
      {lastLoginMethod ? (
        <View className="flex-row items-center gap-2 justify-center">
          <GreenDot />
          <Text className="text-sm text-muted-foreground">
            Utilizado por último
          </Text>
        </View>
      ) : null}

      <Button
        onPress={() => handleLogin("apple")}
        variant="outline"
        className="flex-row gap-3 items-center"
      >
        <View className="h-6 w-6">
          <AppleIcon fill={colorScheme === "dark" ? "#FFFFFF" : "#000000"} />
        </View>
        <Text className="text-primary">Continuar com Apple</Text>
        {lastLoginMethod === "apple" ? (
          <View className="absolute right-4 top-1/2 translate-y-1/2  w-2 h-2 rounded-full bg-green-500" />
        ) : null}
      </Button>
      <Button
        onPress={() => handleLogin("google")}
        variant="outline"
        className="relative flex-row gap-3 items-center"
      >
        <View className="h-6 w-6">
          <GoogleIcon />
        </View>
        <Text className="text-primary">Continuar com Google</Text>
        {lastLoginMethod === "google" ? (
          <View className="absolute right-4 top-1/2 translate-y-1/2  w-2 h-2 rounded-full bg-green-500" />
        ) : null}
      </Button>
    </View>
  );
};

const EmailLoginSection = ({
  lastLoginMethod,
  saveLoginMethod,
}: {
  lastLoginMethod: LastUsedLoginMethod | null;
  saveLoginMethod: (method: LastUsedLoginMethod) => Promise<void>;
}) => {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  return (
    <View className="gap-4">
      <Input
        placeholder="Seu email"
        value={email}
        onChangeText={(text) => setEmail(text)}
        keyboardType="email-address"
        aria-labelledby="inputLabel"
        aria-errormessage="inputError"
      />
      <PasswordInput
        id="password"
        placeholder="Sua senha"
        value={password}
        onChangeText={(text) => setPassword(text)}
      />
      <Button
        onPress={async () => {
          try {
            setIsLoading(true);
            const response = await login(email, password);
            if (response.success) {
              await saveLoginMethod("email");
              router.back();
            } else {
              setError(response.errorMessage || "");
            }
          } finally {
            setIsLoading(false);
          }
        }}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator
            className={cn(buttonTextVariants({ variant: "default" }))}
          />
        ) : (
          <Text>Entrar com email</Text>
        )}
        {lastLoginMethod === "email" ? (
          <View className="absolute right-4 top-1/2 translate-y-1/2  w-2 h-2 rounded-full bg-green-500" />
        ) : null}
      </Button>

      {error ? (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <Text className="text-red-500 text-center">{error}</Text>
        </Animated.View>
      ) : null}

      <View>
        <Text className="text-center">Não tem uma conta?</Text>
        <TouchableOpacity>
          <Text className="text-blue-600 text-center hover:underline">
            Criar uma
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const MethodSeparator = () => {
  return (
    <View className="flex-row items-center gap-3 my-6">
      <Separator className="flex-1" />
      <Text className="text-sm text-muted-foreground">ou</Text>
      <Separator className="flex-1" />
    </View>
  );
};

const GreenDot = () => {
  return <View className="w-2 h-2 rounded-full bg-green-500" />;
};

export default Page;
