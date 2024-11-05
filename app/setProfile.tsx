import React, { useState } from "react";
import {
  Keyboard,
  Pressable,
  TextInput,
  View,
  Image,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  FadeIn,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
} from "react-native-reanimated";
import { PostgrestError } from "@supabase/supabase-js";
import {
  Controller,
  SubmitHandler,
  useForm,
  UseFormReturn,
} from "react-hook-form";
import { z } from "zod";
import DatePicker from "react-native-date-picker";

import { supabase } from "~/lib/supabase";
import { useAuth } from "~/context/auth";

import HighlineIllustration from "~/lib/icons/highline-illustration";
import { KeyboardAwareScrollView } from "~/components/KeyboardAwareScrollView";
import { H2, H3, Muted } from "~/components/ui/typography";
import { Text } from "~/components/ui/text";
import { useColorScheme } from "~/lib/useColorScheme";
import { Onboarding } from "~/components/onboard";
import { SupabaseAvatar } from "~/components/ui/avatar";
import { Textarea } from "~/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "~/lib/utils";
import { LucideIcon } from "~/lib/icons/lucide-icon";
import { Input } from "~/components/ui/input";

// Define Zod schema for form validation
const profileSchema = z.object({
  username: z
    .string()
    .min(3, "O nome de usuário deve ter pelo menos 3 caracteres."),
  name: z.string().min(1, "Preencha o seu nome"),
  profilePicture: z.string().optional(),
  description: z.string().optional(),
  birthday: z.string().optional(),
});

// Define TypeScript type based on Zod schema
type ProfileFormData = z.infer<typeof profileSchema>;

export default function SetProfile() {
  const colorSchema = useColorScheme();
  const router = useRouter();
  const { session, profile, setProfile } = useAuth();

  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    mode: "onChange",
    defaultValues: {
      username: "",
      name: profile?.name || "",
      profilePicture: profile?.profile_picture || undefined,
      description: profile?.description || "",
      birthday: profile?.birthday
        ? profile?.birthday
        : new Date().toDateString(),
    },
  });

  const handleSaveProfile: SubmitHandler<ProfileFormData> = async (data) => {
    if (!session) return;
    try {
      setIsLoading(true);
      const { data: profileData, error: upsertError } = await supabase
        .from("profiles")
        .upsert({
          id: session.user.id,
          username: `@${data.username}`,
          name: data.name,
          profile_picture: data.profilePicture,
          description: data.description,
          birthday: data.birthday,
        })
        .select()
        .single();

      if (upsertError) {
        throw upsertError;
      }

      setProfile(profileData);
      router.replace("/");
    } catch (error) {
      if ((error as PostgrestError).code === "23505") {
        form.setError("username", {
          message: "Nome já escolhido, tente outro",
        });
      } else {
        form.setError("root", {
          message: "Erro ao salvar o perfil. Tente novamente.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const validateUsername = async () => {
    try {
      setIsLoading(true);
      form.clearErrors("username");
      const username = form.getValues("username");

      const valid = await form.trigger("username");
      if (!valid) return false;

      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", `@${username.trim()}`)
        .single();

      // Check if the username is available
      if (error && error.code !== "PGRST116") {
        console.error("Erro ao verificar nome de usuário:", error);
        form.setError("username", {
          message: "Erro ao verificar disponibilidade. Tente novamente.",
        });
        return false;
      } else if (data) {
        form.setError("username", {
          message: "Nome já escolhido, tente outro.",
        });
        return false;
      }

      return true;
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    <UsernameForm key="username" form={form} />,
    <ProfileInfoForm key="profileInfo" form={form} />,
    <PrefferedTheme key="theme" />,
  ];

  const handleNextStep = async (newStep: number) => {
    // Move back
    if (newStep >= 0 && newStep < index) {
      setIndex((prevIndex) => prevIndex - 1);
      return;
    }

    // Validate the username in the first step
    if (index === 0) {
      const isUsernameValid = await validateUsername();
      if (!isUsernameValid) return;
    }

    // Validate the username in the first step
    if (index === 1) {
      const validName = await form.trigger("name");
      if (!validName) return;
    }

    // Move forward
    if (index < steps.length - 1) {
      setIndex((prevIndex) => prevIndex + 1);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAwareScrollView
        contentContainerClassName="min-h-screen px-6 py-8 gap-4"
        keyboardShouldPersistTaps="handled"
      >
        <H2 className="text-center border-0">Estamos quase lá!</H2>
        <HighlineIllustration
          mode={colorSchema.colorScheme}
          className="w-full h-auto"
        />

        {steps[index]}

        <View className="mt-auto">
          <Onboarding
            total={steps.length}
            selectedIndex={index}
            onIndexChange={handleNextStep}
            onFinish={form.handleSubmit(handleSaveProfile)}
            isLoading={isLoading}
          />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const UsernameForm = ({ form }: { form: UseFormReturn<ProfileFormData> }) => {
  return (
    <Animated.View
      className="gap-4"
      entering={FadeInRight}
      exiting={FadeOutLeft}
    >
      <View>
        <H3 className="text-center">Primeiro, escolha um nome</H3>
        <Muted className="text-center">
          É assim que você será identificado no app
        </Muted>
      </View>

      <Controller
        control={form.control}
        name="username"
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <View className="gap-2">
            <View className="flex-row items-center justify-center gap-1 my-4">
              <Text className="text-muted-foreground font-semibold text-3xl">
                @
              </Text>
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder="Seu username"
                autoCapitalize="none"
                returnKeyType="done"
                className={cn(
                  error?.message ? "border-red-500" : "border-muted-foreground",
                  "text-foreground placeholder:text-muted-foreground border-b-hairline"
                )}
              />
            </View>
            {error && (
              <Animated.View
                entering={FadeIn}
                exiting={FadeOut}
                className="mb-4"
              >
                <Text className="text-red-500 text-center">
                  {error.message}
                </Text>
              </Animated.View>
            )}
          </View>
        )}
      />
    </Animated.View>
  );
};

const ProfileInfoForm = ({
  form,
}: {
  form: UseFormReturn<ProfileFormData>;
}) => {
  const colorScheme = useColorScheme();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleDateChange = (date: Date) => {
    setShowDatePicker(false);
    console.log({ date, isoDate: date.toISOString() });
    if (date) {
      form.setValue("birthday", date.toISOString().split("T")[0]); // Set date in YYYY-MM-DD format
    }
  };

  return (
    <Animated.View
      className="gap-4"
      entering={FadeInRight}
      exiting={FadeOutLeft}
    >
      <View>
        <H3 className="text-center">Vamos montar seu perfil</H3>
        <Muted className="text-center">
          As pessoas poderão vé-lo. Capriche ✨
        </Muted>
      </View>

      <View className="gap-4">
        <Controller
          control={form.control}
          name="profilePicture"
          render={({ field: { value, onChange } }) => (
            <SupabaseAvatar
              name={form.getValues("name") || ""}
              profilePicture={value}
              onUpload={onChange}
            />
          )}
        />

        <Controller
          control={form.control}
          name="name"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <View>
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder="Seu nome"
                autoCapitalize="none"
                returnKeyType="done"
                className={cn(
                  error?.message ? "border-red-500" : "border-muted-foreground",
                  "text-foreground placeholder:text-muted-foreground border-b-hairline"
                )}
              />
              {error && (
                <Animated.View entering={FadeIn} exiting={FadeOut}>
                  <Text className="text-red-500">{error.message}</Text>
                </Animated.View>
              )}
            </View>
          )}
        />

        <Controller
          control={form.control}
          name="birthday"
          render={({ field: { value } }) => (
            <View className="gap-2">
              <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                <Input
                  label="Data de Nascimento:"
                  editable={false}
                  value={
                    value
                      ? new Date(value).toLocaleDateString("pt-BR")
                      : "Selecione a data"
                  }
                  placeholder="Selecione a data"
                />
              </TouchableOpacity>
              <DatePicker
                modal
                open={showDatePicker}
                mode="date"
                locale="pt-BR"
                date={value ? new Date(value) : new Date()}
                maximumDate={new Date()}
                onConfirm={(date) => {
                  setShowDatePicker(false);
                  handleDateChange(date);
                }}
                onCancel={() => {
                  setShowDatePicker(false);
                }}
                timeZoneOffsetInMinutes={0} // https://github.com/henninghall/react-native-date-picker/issues/841
                theme={colorScheme.colorScheme}
              />
            </View>
          )}
        />

        <Controller
          control={form.control}
          name="description"
          render={({ field: { onChange }, fieldState: { error } }) => (
            <Textarea
              keyboardType="default"
              returnKeyType="done"
              placeholder="Nos diga um pouco sobre você"
              blurOnSubmit={true}
              className={error && "border-destructive"}
              onSubmitEditing={() => Keyboard.dismiss()}
              onChangeText={onChange}
            />
          )}
        />
      </View>
    </Animated.View>
  );
};

const PrefferedTheme = () => {
  const items = [
    {
      id: "light",
      label: "Claro",
      image: require("~/assets/images/ui-light.webp"),
    },
    {
      id: "dark",
      label: "Escuro",
      image: require("~/assets/images/ui-dark.webp"),
    },
  ];

  const { colorScheme, setColorScheme } = useColorScheme();

  const handleSelect = async (theme: typeof colorScheme) => {
    setColorScheme(theme);
    await AsyncStorage.setItem("theme", theme);
  };

  return (
    <Animated.View
      className="gap-4"
      entering={FadeInRight}
      exiting={FadeOutLeft}
    >
      <View>
        <H3 className="text-center">Escolha um tema</H3>
        <Muted className="text-center">
          Selecione o tema de sua preferência para o aplicativo.
        </Muted>
      </View>

      <View className="flex-row gap-3 items-center w-full justify-center">
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => handleSelect(item.id as typeof colorScheme)}
            className={cn(
              "items-center justify-center overflow-hidden rounded-lg border w-28 shadow-lg",
              colorScheme === item.id
                ? "border-blue-500 bg-accent "
                : "border-border bg-muted"
            )}
          >
            <Image
              source={item.image}
              className="w-full h-auto rounded-lg rounded-b-none"
              resizeMode="cover"
            />
            <View className="flex-row items-center my-3">
              {colorScheme === item.id ? (
                <LucideIcon
                  name="Check"
                  className="w-4 h-4 text-accent-foreground"
                />
              ) : (
                <LucideIcon
                  name="Minus"
                  className="w-4 h-4 text-muted-foreground"
                />
              )}
              <Text
                className={cn(
                  "text-sm ml-1 font-medium",
                  colorScheme === item.id
                    ? "text-accent-foreground"
                    : "text-muted-foreground"
                )}
              >
                {item.label}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
};
