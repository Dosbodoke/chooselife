"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../../supabase-provider";
import {
  addFestivalQueueManualEntry,
  callNextFestivalQueue,
  joinFestivalQueue,
  leaveFestivalQueue,
  removeFestivalQueueEntry,
} from "./api";
import { queueKeys } from "./keys";
import type {
  AddFestivalQueueManualEntryInput,
  AddFestivalQueueManualEntryResult,
  CallNextFestivalQueueInput,
  CallNextFestivalQueueResult,
  FestivalQueueMutationResult,
  JoinFestivalQueueInput,
  JoinFestivalQueueResult,
  LeaveFestivalQueueInput,
  LeaveFestivalQueueResult,
  RemoveFestivalQueueEntryInput,
  RemoveFestivalQueueEntryResult,
} from "./types";

interface MutationHookOptions<TResult extends FestivalQueueMutationResult> {
  festivalSlug: string;
  onSuccess?: (result: TResult) => void;
}

export function useJoinFestivalQueue(
  options: MutationHookOptions<JoinFestivalQueueResult>,
) {
  const queryClient = useQueryClient();
  const { supabase, userId } = useSupabase();

  return useMutation({
    mutationFn: (input: JoinFestivalQueueInput) =>
      joinFestivalQueue({ input, supabase, userId }),
    onSuccess: async (result) => {
      if (result.success) {
        await queryClient.invalidateQueries({
          queryKey: queueKeys.bySlug(options.festivalSlug),
        });
      }

      options.onSuccess?.(result);
    },
  });
}

export function useAddFestivalQueueManualEntry(
  options: MutationHookOptions<AddFestivalQueueManualEntryResult>,
) {
  const queryClient = useQueryClient();
  const { supabase, userId } = useSupabase();

  return useMutation({
    mutationFn: (input: AddFestivalQueueManualEntryInput) =>
      addFestivalQueueManualEntry({ input, supabase, userId }),
    onSuccess: async (result) => {
      if (result.success) {
        await queryClient.invalidateQueries({
          queryKey: queueKeys.bySlug(options.festivalSlug),
        });
      }

      options.onSuccess?.(result);
    },
  });
}

export function useLeaveFestivalQueue(
  options: MutationHookOptions<LeaveFestivalQueueResult>,
) {
  const queryClient = useQueryClient();
  const { supabase, userId } = useSupabase();

  return useMutation({
    mutationFn: (input: LeaveFestivalQueueInput) =>
      leaveFestivalQueue({ input, supabase, userId }),
    onSuccess: async (result) => {
      if (result.success) {
        await queryClient.invalidateQueries({
          queryKey: queueKeys.bySlug(options.festivalSlug),
        });
      }

      options.onSuccess?.(result);
    },
  });
}

export function useCallNextFestivalQueue(
  options: MutationHookOptions<CallNextFestivalQueueResult>,
) {
  const queryClient = useQueryClient();
  const { supabase } = useSupabase();

  return useMutation({
    mutationFn: (input: CallNextFestivalQueueInput) =>
      callNextFestivalQueue({ input, supabase }),
    onSuccess: async (result) => {
      if (result.success) {
        await queryClient.invalidateQueries({
          queryKey: queueKeys.bySlug(options.festivalSlug),
        });
      }

      options.onSuccess?.(result);
    },
  });
}

export function useRemoveFestivalQueueEntry(
  options: MutationHookOptions<RemoveFestivalQueueEntryResult>,
) {
  const queryClient = useQueryClient();
  const { supabase, userId } = useSupabase();

  return useMutation({
    mutationFn: (input: RemoveFestivalQueueEntryInput) =>
      removeFestivalQueueEntry({ input, supabase, userId }),
    onSuccess: async (result) => {
      if (result.success) {
        await queryClient.invalidateQueries({
          queryKey: queueKeys.bySlug(options.festivalSlug),
        });
      }

      options.onSuccess?.(result);
    },
  });
}
