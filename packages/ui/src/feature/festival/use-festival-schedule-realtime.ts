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

    let invalidateTimeout: ReturnType<typeof setTimeout> | undefined;
    const invalidateSchedule = () => {
      if (invalidateTimeout) return;

      invalidateTimeout = setTimeout(() => {
        invalidateTimeout = undefined;
        void queryClient.invalidateQueries({ queryKey });
      }, 1_000);
    };

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
        invalidateSchedule,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "festival_schedule_slot",
          filter: `festival_id=eq.${festivalId}`,
        },
        invalidateSchedule,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "festival_schedule_revision",
          filter: `festival_id=eq.${festivalId}`,
        },
        invalidateSchedule,
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`Festival schedule Realtime subscription ${status}`);
        }
      });

    return () => {
      if (invalidateTimeout) {
        clearTimeout(invalidateTimeout);
      }
      void supabase.removeChannel(channel);
    };
  }, [festivalId, queryClient, queryKey, supabase]);
}
