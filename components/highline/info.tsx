import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/auth";
import { supabase } from "~/lib/supabase";
import { H1, Lead } from "../ui/typography";

export default function Info() {
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: highline } = useQuery({
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

  if (!highline) return null;

  return (
    <View className="gap-2 flex-1">
      <View>
        <H1>{highline.name}</H1>
        {highline.description ? <Lead>{highline.description}</Lead> : null}
      </View>

      <InfoItem label={"Altura"} value={highline.height.toString()} />
      <InfoItem label={"Comprimento"} value={highline.lenght.toString()} />
      <InfoItem label={"Fita principal"} value={highline.main_webbing} />
      <InfoItem label={"Fita backup"} value={highline.backup_webbing} />
    </View>
  );
}

const InfoItem = ({ label, value }: { label: string; value: string }) => {
  return (
    <View className="flex flex-row gap-2 items-center">
      <Text className="text-muted-foreground">{label}:</Text>
      <View className="flex-1 bg-border h-[1px]"></View>
      <Text className="font-medium text-primary">{value}</Text>
    </View>
  );
};
