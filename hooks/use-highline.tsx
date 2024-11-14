import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase";
import { useAuth } from "~/context/auth";
import type { Functions } from "~/utils/database.types";

export type Highline = Functions["get_highline"]["Returns"][0];

export const useHighline = ({ id }: { id: string }) => {
  const { session, loading: sessionLoading } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: highline,
    isPending,
    error,
  } = useQuery<Highline | null>({
    queryKey: ["highline", id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_highline", {
        searchid: [id],
        userid: session?.user.id,
      });
      return data && data.length > 0 ? data[0] : null;
    },
    initialData: () =>
      queryClient
        .getQueryData<Highline[]>(["highlines"])
        ?.find((hl) => hl.id === id),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(["highlines"])?.dataUpdatedAt,
    enabled: !!id && !sessionLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    highline,
    isPending,
    error,
  };
};
