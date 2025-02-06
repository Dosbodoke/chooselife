import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useAuth } from '~/context/auth';
import { supabase } from '~/lib/supabase';
import type { Functions } from '~/utils/database.types';

export type Highline = Functions['get_highline']['Returns'][0];

export type HighlineCategory =
  | 'favorites'
  | 'big line'
  | 'rigged'
  | 'unrigged'
  | 'planned';

export const useHighlineList = ({ searchTerm }: { searchTerm?: string }) => {
  const { session, loading: sessionLoading } = useAuth();

  const [selectedCategory, setSelectedCategory] =
    useState<HighlineCategory | null>(null);
  const [highlightedMarker, setHighlightedMarker] = useState<Highline | null>(
    null,
  );
  const [clusterMarkers, setClusterMarkers] = useState<Highline[]>([]);

  const {
    data: highlines,
    isLoading,
    error,
  } = useQuery<Highline[]>({
    queryKey: ['highlines'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_highline', {
        ...(session?.user?.id ? { userid: session.user.id } : {}),
      });
      return data || [];
    },
    enabled: !sessionLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Combine filtering based on both the search term and the selected category
  const filteredHighlines = useMemo(() => {
    if (!highlines) return [];

    let filtered = highlines;

    // Filter by search term if provided
    if (searchTerm) {
      filtered = filtered.filter((highline) =>
        highline.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Filter by selected category if any
    if (selectedCategory) {
      switch (selectedCategory) {
        case 'favorites':
          // Assumes a boolean "isFavorited" property on highline
          filtered = filtered.filter((highline) => highline.is_favorite);
          break;
        case 'big line':
          // Assumes a "length" property in meters
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
    highlightedMarker,
    clusterMarkers,
    setHighlightedMarker,
    setClusterMarkers,
    setSelectedCategory,
  };
};
