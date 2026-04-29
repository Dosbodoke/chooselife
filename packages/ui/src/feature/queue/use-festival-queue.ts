"use client";

import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../../supabase-provider";
import { getFestivalQueuePageData } from "./api";
import { queueKeys } from "./keys";
import type { FestivalQueuePageData } from "./types";
import { useFestivalQueueRealtime } from "./use-festival-queue-realtime";

export interface UseFestivalQueueOptions {
  festivalSlug: string;
  initialData?: FestivalQueuePageData;
}

export function useFestivalQueue({
  festivalSlug,
  initialData,
}: UseFestivalQueueOptions) {
  const { supabase, userId } = useSupabase();
  const queryKey = queueKeys.bySlug(festivalSlug);

  const query = useQuery({
    queryKey,
    queryFn: () =>
      getFestivalQueuePageData({
        festivalSlug,
        supabase,
        userId,
      }),
    initialData,
  });

  useFestivalQueueRealtime(query.data?.festival.id, queryKey);

  return query;
}
