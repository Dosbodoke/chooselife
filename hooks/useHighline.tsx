import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { Functions } from "~/utils/database.types";
import { supabase } from "~/lib/supabase";

export type Highline = Functions["get_highline"]["Returns"][0];

export const useHighline = () => {
  const [highlightedMarker, setHighlightedMarker] = useState<Highline | null>(
    null
  );
  const [clusterMarkers, setClusterMarkers] = useState<Highline[] | null>(null);

  const {
    data: highlines,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["highlines"],
    queryFn: async () => {
      const result = await supabase.rpc("get_highline");
      return result.data || [];
    },
  });

  return {
    highlines: highlines || [],
    highlightedMarker,
    clusterMarkers,
    setHighlightedMarker,
    setClusterMarkers,
    isLoading,
    error,
  };
};
