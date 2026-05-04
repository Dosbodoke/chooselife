"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../../supabase-provider";

export function useFestivalScheduleRealtime(
  festivalId: string | undefined,
  queryKey: readonly unknown[],
) {
  const queryClient = useQueryClient();
  const { supabase } = useSupabase();

  useEffect(() => {
    if (!festivalId) return;

    const channel = supabase
      .channel(`festival-schedule:${festivalId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "festival_schedule_window",
          filter: `festival_id=eq.${festivalId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "festival_schedule_slot",
          filter: `festival_id=eq.${festivalId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "festival_schedule_booking",
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
