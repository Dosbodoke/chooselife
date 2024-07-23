import { useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useAuth } from "~/context/auth";
import { GoogleIcon } from "~/lib/icons/Google";
import { AppleIcon } from "~/lib/icons/Apple";

const Page = () => {
  const { signIn, performOAuth } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <View className="flex-1 p-6">
      <View className="gap-4">
        <Input
          placeholder="Seu email"
          value={email}
          onChangeText={(text) => setEmail(text)}
          keyboardType="email-address"
          aria-labelledbyledBy="Email"
          aria-errormessage="Email inválido"
        />
        <Input
          placeholder="Sua senha"
          value={password}
          onChangeText={(text) => setPassword(text)}
          secureTextEntry
          aria-labelledbyledBy="Senha"
          aria-errormessage="Senha invalida"
        />
        <Button
          onPress={async () => {
            const { data } = await signIn(email, password);
            if (data) {
              router.back();
            }
          }}
        >
          <Text className="text-primary-foreground">Entrar</Text>
        </Button>
      </View>

      <View className="flex-row gap-3 items-center my-8">
        <View
          className="flex-1 border-b-muted-foreground"
          style={{
            borderBottomWidth: StyleSheet.hairlineWidth,
          }}
        />
        <Text className="text-muted-foreground text-base">ou</Text>
        <View
          className="border-b-muted-foreground flex-1"
          style={{
            borderBottomWidth: StyleSheet.hairlineWidth,
          }}
        />
      </View>

      <View className="gap-5">
        <Button variant="outline" className="flex flex-row gap-2 items-center">
          <View className="size-6">
            <AppleIcon className="fill-black dark:fill-white opacity-100" />
          </View>
          <Text className="text-primary">Continuar com Apple</Text>
        </Button>

        <Button
          onPress={async () => {
            const { data } = await performOAuth();
            if (data) {
              router.back();
            }
          }}
          variant="outline"
          className="flex flex-row gap-2 items-center"
        >
          <View className="size-6">
            <GoogleIcon />
          </View>
          <Text className="text-primary">Continuar com Google</Text>
        </Button>
      </View>
    </View>
  );
};

export default Page;
