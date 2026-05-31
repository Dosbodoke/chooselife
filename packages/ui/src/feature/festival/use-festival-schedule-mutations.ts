"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../../supabase-provider";
import { bookFestivalScheduleSlot, cancelFestivalScheduleBooking } from "./api";
import { festivalKeys } from "./keys";
import type {
  BookFestivalScheduleSlotInput,
  BookFestivalScheduleSlotResult,
  CancelFestivalScheduleBookingInput,
  CancelFestivalScheduleBookingResult,
  FestivalScheduleMutationResult,
} from "./types";

interface MutationHookOptions<TResult extends FestivalScheduleMutationResult> {
  festivalSlug: string;
  onSuccess?: (result: TResult) => void;
}

export function useBookFestivalScheduleSlot(
  options: MutationHookOptions<BookFestivalScheduleSlotResult>,
) {
  const queryClient = useQueryClient();
  const { supabase, userId } = useSupabase();

  return useMutation({
    mutationFn: (input: BookFestivalScheduleSlotInput) =>
      bookFestivalScheduleSlot({ input, supabase }),
    onSuccess: async (result) => {
      if (result.success) {
        await queryClient.invalidateQueries({
          queryKey: festivalKeys.bySlug(options.festivalSlug, userId),
        });
      }

      options.onSuccess?.(result);
    },
  });
}

export function useCancelFestivalScheduleBooking(
  options: MutationHookOptions<CancelFestivalScheduleBookingResult>,
) {
  const queryClient = useQueryClient();
  const { supabase, userId } = useSupabase();

  return useMutation({
    mutationFn: (input: CancelFestivalScheduleBookingInput) =>
      cancelFestivalScheduleBooking({ input, supabase }),
    onSuccess: async (result) => {
      if (result.success) {
        await queryClient.invalidateQueries({
          queryKey: festivalKeys.bySlug(options.festivalSlug, userId),
        });
      }

      options.onSuccess?.(result);
    },
  });
}
