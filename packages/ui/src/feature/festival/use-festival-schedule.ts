"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../../supabase-provider";
import {
  getFestivalSchedulePageData,
  sanitizeFestivalScheduleForOffline,
} from "./api";
import { festivalKeys } from "./keys";
import type { FestivalSchedulePageData } from "./types";
import { useFestivalScheduleRealtime } from "./use-festival-schedule-realtime";

export interface UseFestivalScheduleOptions {
  festivalSlug: string;
  initialData?: FestivalSchedulePageData;
}

export function useFestivalSchedule({
  festivalSlug,
  initialData,
}: UseFestivalScheduleOptions) {
  const { supabase, userId } = useSupabase();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => festivalKeys.bySlug(festivalSlug, userId),
    [festivalSlug, userId],
  );
  const publicQueryKey = useMemo(
    () => festivalKeys.publicBySlug(festivalSlug),
    [festivalSlug],
  );
  const publicSnapshot =
    queryClient.getQueryData<FestivalSchedulePageData>(publicQueryKey);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const data = await getFestivalSchedulePageData({
        festivalSlug,
        supabase,
        userId,
      });

      if (userId) {
        queryClient.setQueryDefaults(publicQueryKey, {
          gcTime: Infinity,
          meta: {
            persistOffline: true,
          },
        });
        queryClient.setQueryData(
          publicQueryKey,
          sanitizeFestivalScheduleForOffline(data),
        );
      }

      return data;
    },
    gcTime: Infinity,
    initialData: userId ? undefined : initialData,
    meta: {
      authScope: userId,
      persistOffline: !userId,
    },
    placeholderData: userId ? publicSnapshot : undefined,
  });

  useFestivalScheduleRealtime(query.data?.festival.id, queryKey);

  return query;
}
