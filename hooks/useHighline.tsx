import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import type { Functions } from "~/utils/database.types";
import { supabase } from "~/lib/supabase";
import { useAuth } from "~/context/auth";

export type Highline = Functions["get_highline"]["Returns"][0];

export const useHighline = ({ searchTerm }: { searchTerm: string }) => {
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

  // Filter highlines based on the search term
  const filteredHighlines = useMemo(() => {
    if (!searchTerm) return highlines || [];
    return (highlines || []).filter((highline) =>
      highline.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [highlines, searchTerm]);

  return {
    highlines: filteredHighlines,
    highlightedMarker,
    clusterMarkers,
    setHighlightedMarker,
    setClusterMarkers,
    isPending,
    error,
  };
};
