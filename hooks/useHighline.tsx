import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { Functions } from "~/utils/database.types";
import { supabase } from "~/lib/supabase";
import { useAuth } from "~/context/auth";

export type Highline = Functions["get_highline"]["Returns"][0];

export const useHighline = () => {
  const { session, loading: sessionLoading } = useAuth();

  const [highlightedMarker, setHighlightedMarker] = useState<Highline | null>(
    null
  );
  const [clusterMarkers, setClusterMarkers] = useState<Highline[]>([]);

  const {
    data: highlines,
    isPending,
    error,
  } = useQuery({
    queryKey: ["highlines"],
    queryFn: async () => {
      const result = await supabase.rpc("get_highline", {
        ...(session?.user?.id ? { userid: session.user.id } : {}),
      });
      return result.data || [];
    },
    enabled: !sessionLoading,
  });

  return {
    highlines: highlines || [],
    highlightedMarker,
    clusterMarkers,
    setHighlightedMarker,
    setClusterMarkers,
    isPending,
    error,
  };
};
