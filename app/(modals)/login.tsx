import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

import { useSession } from "~/context/auth";
import { useRouter } from "expo-router";

const Page = () => {
  const { signIn, performOAuth } = useSession();
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
            const response = await signIn(email, password);
            if (response?.data) {
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
        <Button
          variant="outline"
          disabled
          className="flex flex-row gap-2 items-center"
        >
          <Ionicons
            className="text-muted-foreground"
            name="logo-apple"
            size={24}
          />
          <Text className="text-primary">Continuar com Apple</Text>
        </Button>

        <Button
          onPress={performOAuth}
          variant="outline"
          className="flex flex-row gap-2 items-center"
        >
          <Ionicons
            className="text-muted-foreground"
            name="logo-google"
            size={24}
          />
          <Text className="text-primary">Continuar com Google</Text>
        </Button>
      </View>
    </View>
  );
};

export default Page;
