"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../../supabase-provider";

export function useFestivalQueueRealtime(
  festivalId: string | undefined,
  queryKey: readonly unknown[],
) {
  const queryClient = useQueryClient();
  const { supabase } = useSupabase();

  useEffect(() => {
    if (!festivalId) return;

    const channel = supabase
      .channel(`festival-queue:${festivalId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "festival_queue_entry",
          filter: `festival_id=eq.${festivalId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [festivalId, queryClient, queryKey, supabase]);
}
