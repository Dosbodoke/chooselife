import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "~/lib/supabase";
import { useAuth } from "~/context/auth";
import type { Functions } from "~/utils/database.types";

export type Highline = Functions["get_highline"]["Returns"][0];

export const useHighlineList = ({ searchTerm }: { searchTerm?: string }) => {
  const { session, loading: sessionLoading } = useAuth();

  const [highlightedMarker, setHighlightedMarker] = useState<Highline | null>(
    null
  );
  const [clusterMarkers, setClusterMarkers] = useState<Highline[]>([]);

  const {
    data: highlines,
    isLoading,
    error,
  } = useQuery<Highline[]>({
    queryKey: ["highlines"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_highline", {
        ...(session?.user?.id ? { userid: session.user.id } : {}),
      });
      return data || [];
    },
    enabled: !sessionLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
    isLoading,
    error,
    highlightedMarker,
    clusterMarkers,
    setHighlightedMarker,
    setClusterMarkers,
  };
};
