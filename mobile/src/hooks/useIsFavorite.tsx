import { useCallback, useState } from 'react';
import { HeartOutlinedSvg, HeartFilledSvg } from '@src/assets';

import { trpc } from '@src/utils/trpc';
import { useQueryClient } from '@tanstack/react-query';
import { getQueryKey } from '@trpc/react-query';

// Return the heart icon a function to toggle the favorite, and if it is loading
type UseIsFavorite = [React.FC<HeartStyledProps>, () => void, boolean];

interface HeartStyledProps {
  strokeColor: '#000' | '#fff';
  strokeWidth?: number; // default 1
}

function useIsFavorite(highlineId: string): UseIsFavorite {
  const qc = useQueryClient();

  const { data: isFavorite, isLoading } = trpc.highline.checkIsFavorited.useQuery({ highlineId });

  const checkIsFavoriteKey = getQueryKey(trpc.highline.checkIsFavorited, { highlineId }, 'query');

  const favoriteMutation = trpc.highline.favorite.useMutation({
    onMutate: () => {
      qc.setQueryData(checkIsFavoriteKey, () => true);
    },
    onError: () => {
      qc.setQueryData(checkIsFavoriteKey, () => false);
    },
  });

  const unfavoriteMutation = trpc.highline.unfavorite.useMutation({
    onMutate: () => {
      qc.setQueryData(checkIsFavoriteKey, () => false);
    },
    onError: () => {
      qc.setQueryData(checkIsFavoriteKey, () => true);
    },
  });

  function toggleFavorite() {
    if (favoriteMutation.isLoading || unfavoriteMutation.isLoading) return;
    if (isFavorite) {
      unfavoriteMutation.mutate({ highlineId });
    } else {
      favoriteMutation.mutate({ highlineId });
    }
  }

  const HeartIcon: React.FC<HeartStyledProps> = ({ strokeColor, strokeWidth }) => {
    return (
      <>
        {isFavorite ? (
          <HeartFilledSvg />
        ) : (
          <HeartOutlinedSvg stroke={strokeColor} strokeWidth={strokeWidth} />
        )}
      </>
    );
  };

  return [HeartIcon, toggleFavorite, isLoading];
}

export default useIsFavorite;
