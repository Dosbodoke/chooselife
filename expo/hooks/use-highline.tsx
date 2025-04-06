import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { useAuth } from '~/context/auth';
import { supabase } from '~/lib/supabase';
import type { Functions } from '~/utils/database.types';

export type Highline = Functions['get_highline']['Returns'][number];

export type HighlineCategory =
  | 'favorites'
  | 'big line'
  | 'rigged'
  | 'unrigged'
  | 'planned';

export interface UseHighlineListParams {
  id?: undefined;
  searchTerm?: string;
}

export interface UseHighlineSingleParams {
  id: string;
  searchTerm?: never;
}

export type UseHighlineListResult = {
  highlines: Highline[];
  isLoading: boolean;
  error: unknown;
  selectedCategory: HighlineCategory | null;
  setSelectedCategory: (value: HighlineCategory | null) => void;
};

export type UseHighlineSingleResult = {
  highline: Highline | null;
  isPending: boolean;
  error: unknown;
};

export const highlineKeyFactory = {
  detail: (id: string, userId?: string) =>
    ['highline', id, 'detail', userId] as const,
  favorite: (id: string) => ['highline', id, 'favorite'] as const,
  list: (userId?: string) => ['highlines', userId] as const,
};

const CACHE_TIME_FAVORITES = Infinity;
const CACHE_TIME_DEFAULT = 1000 * 60 * 60; // 1 hour

// Function overloads
export function useHighline(
  params: UseHighlineSingleParams,
): UseHighlineSingleResult;
export function useHighline(
  params: UseHighlineListParams,
): UseHighlineListResult;

// Implementation signature must accept both parameter types
export function useHighline(
  params: UseHighlineSingleParams | UseHighlineListParams,
): UseHighlineSingleResult | UseHighlineListResult {
  const { session, sessionLoading } = useAuth();
  const queryClient = useQueryClient();

  // If an `id` is provided, run a single highline query:
  if ('id' in params && params.id) {
    const { id } = params;

    // Create separate queries for favorite and non-favorite items
    const detailKey = highlineKeyFactory.detail(id, session?.user?.id);
    const favoriteKey = highlineKeyFactory.favorite(id);

    const {
      data: highline,
      isLoading: isPending,
      error,
    } = useQuery<Highline | null>({
      queryKey: detailKey,
      queryFn: async () => {
        const { data } = await supabase.rpc('get_highline', {
          searchid: [id],
          userid: session?.user.id,
        });
        console.log({ data });
        const result = data && data.length > 0 ? data[0] : null;

        if (result?.is_favorite) {
          queryClient.setQueryData(favoriteKey, result);
        }

        return result;
      },
      initialData: () => {
        const favoriteData = queryClient.getQueryData<Highline>(favoriteKey);
        if (favoriteData) return favoriteData;

        return (
          queryClient
            .getQueryData<Highline[]>(highlineKeyFactory.list(session?.user.id))
            ?.find((hl) => hl.id === id) ?? null
        );
      },
      initialDataUpdatedAt: () => {
        return queryClient.getQueryState(
          highlineKeyFactory.list(session?.user.id),
        )?.dataUpdatedAt;
      },
      enabled: !!id && !sessionLoading,
      staleTime: 5 * 60 * 1000,
      gcTime: CACHE_TIME_DEFAULT,
    });

    useQuery({
      queryKey: favoriteKey,
      queryFn: () => highline,
      enabled: !!highline?.is_favorite,
      gcTime: CACHE_TIME_FAVORITES,
      staleTime: Infinity,
    });

    return { highline, isPending, error };
  }

  // Highline List Query
  const { searchTerm } = params;
  const {
    data: highlines,
    isLoading,
    error,
  } = useQuery<Highline[]>({
    queryKey: highlineKeyFactory.list(session?.user?.id),
    queryFn: async () => {
      const { data } = await supabase.rpc('get_highline', {
        ...(session?.user?.id ? { userid: session.user.id } : {}),
      });
      const results = data || [];

      results.forEach((highline) => {
        if (highline.is_favorite) {
          queryClient.setQueryData(
            highlineKeyFactory.favorite(highline.id),
            highline,
          );
        }
      });

      return results;
    },
    enabled: !sessionLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: CACHE_TIME_DEFAULT,
  });

  const [selectedCategory, setSelectedCategory] =
    useState<HighlineCategory | null>(null);

  const filteredHighlines = useMemo(() => {
    if (!highlines) return [];
    let filtered = highlines;

    if (searchTerm) {
      filtered = filtered.filter((highline) =>
        highline.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    if (selectedCategory) {
      switch (selectedCategory) {
        case 'favorites':
          filtered = filtered.filter((highline) => highline.is_favorite);
          break;
        case 'big line':
          filtered = filtered.filter((highline) => highline.length > 300);
          break;
        case 'rigged':
          filtered = filtered.filter(
            (highline) => highline.status === 'rigged',
          );
          break;
        case 'unrigged':
          filtered = filtered.filter(
            (highline) => highline.status === 'unrigged',
          );
          break;
        case 'planned':
          filtered = filtered.filter(
            (highline) => highline.status === 'planned',
          );
          break;
        default:
          break;
      }
    }

    return filtered;
  }, [highlines, searchTerm, selectedCategory]);

  return {
    highlines: filteredHighlines,
    isLoading,
    error,
    selectedCategory,
    setSelectedCategory,
  };
}

export type ToggleFavoriteVariables = {
  id: string;
  isFavorite: boolean;
};
export function useToggleFavoriteMutation() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<
    void,
    Error,
    ToggleFavoriteVariables,
    {
      previousRegular: Highline | undefined;
      previousFavorite: Highline | undefined;
      wasAddingFavorite: boolean;
    }
  >({
    mutationFn: async ({ id, isFavorite }) => {
      if (!session?.user) {
        // Redirect to login if user is not authenticated.
        router.push(`/(modals)/login?redirect_to=highline/${id}`);
        throw new Error('User not logged in');
      }
      if (isFavorite) {
        // Delete from favorites
        const { error } = await supabase
          .from('favorite_highline')
          .delete()
          .match({ highline_id: id, profile_id: session.user.id });
        if (error) throw new Error(error.message);
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('favorite_highline')
          .insert({ highline_id: id, profile_id: session.user.id });
        if (error) throw new Error(error.message);
      }
    },
    onMutate: async ({ id, isFavorite }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: highlineKeyFactory.detail(id),
      });
      await queryClient.cancelQueries({
        queryKey: highlineKeyFactory.favorite(id),
      });

      // Snapshot previous cache states.
      const previousRegular = queryClient.getQueryData<Highline>(
        highlineKeyFactory.detail(id),
      );
      const previousFavorite = queryClient.getQueryData<Highline>(
        highlineKeyFactory.favorite(id),
      );

      // Optimistically update the highline's favorite status.
      const updatedHighline = {
        ...(previousRegular || previousFavorite),
        is_favorite: !isFavorite,
      };
      queryClient.setQueryData(highlineKeyFactory.detail(id), updatedHighline);
      if (!isFavorite) {
        queryClient.setQueryData(
          highlineKeyFactory.favorite(id),
          updatedHighline,
        );
      } else {
        queryClient.removeQueries({
          queryKey: highlineKeyFactory.favorite(id),
        });
      }

      // Also update the highline in the list cache.
      queryClient.setQueriesData<Highline[]>(
        { queryKey: highlineKeyFactory.list() },
        (old) => {
          if (!old) return old;
          return old.map((highline) =>
            highline.id === id
              ? { ...highline, is_favorite: !isFavorite }
              : highline,
          );
        },
      );

      // Return context for potential rollback.
      return {
        previousRegular,
        previousFavorite,
        wasAddingFavorite: !isFavorite,
      };
    },
    onError: (error, variables, context) => {
      if (context) {
        // Roll back optimistic update on error.
        queryClient.setQueryData(
          highlineKeyFactory.detail(variables.id),
          context.previousRegular,
        );
        if (context.previousFavorite) {
          queryClient.setQueryData(
            highlineKeyFactory.favorite(variables.id),
            context.previousFavorite,
          );
        }
        queryClient.setQueriesData<Highline[]>(
          { queryKey: highlineKeyFactory.list() },
          (old) => {
            if (!old) return old;
            return old.map((highline) =>
              highline.id === variables.id
                ? { ...highline, is_favorite: variables.isFavorite }
                : highline,
            );
          },
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      // Always invalidate queries to ensure fresh data.
      queryClient.invalidateQueries({
        queryKey: highlineKeyFactory.detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: highlineKeyFactory.favorite(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: highlineKeyFactory.list() });
    },
  });
}
