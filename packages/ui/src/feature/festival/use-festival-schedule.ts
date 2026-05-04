"use client";

import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../../supabase-provider";
import { getFestivalSchedulePageData } from "./api";
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
  const queryKey = festivalKeys.bySlug(festivalSlug);

  const query = useQuery({
    queryKey,
    queryFn: () =>
      getFestivalSchedulePageData({
        festivalSlug,
        supabase,
        userId,
      }),
    gcTime: Infinity,
    initialData,
  });

  useFestivalScheduleRealtime(query.data?.festival.id, queryKey);

  return query;
}
