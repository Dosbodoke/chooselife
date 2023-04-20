import { useCallback, useState } from 'react';
import { HeartOutlinedSvg, HeartFilledSvg } from '@src/assets';

import { trpc } from '@src/utils/trpc';

type UseIsFavorite = [React.FC<HeartStyledProps>, () => void];

interface HeartStyledProps {
  strokeColor: '#000' | '#fff';
  strokeWidth?: number; // default 1
}

function useIsFavorite(highlineId: string): UseIsFavorite {
  const [isFavorite, setIsFavorite] = useState<boolean | null>(null);

  const { refetch, isFetching } = trpc.highline.checkIsFavorited.useQuery(
    { highlineId },
    {
      onSuccess: (data) => setIsFavorite(!!data),
    }
  );

  const favoriteMutation = trpc.highline.favorite.useMutation({
    onSuccess: () => refetch(),
  });

  const unfavoriteMutation = trpc.highline.unfavorite.useMutation({
    onSuccess: () => refetch(),
  });

  const toggleFavorite = useCallback(() => {
    if (isFetching) return;
    if (isFavorite) {
      unfavoriteMutation.mutate({ highlineId });
    } else {
      favoriteMutation.mutate({ highlineId });
    }
  }, [isFavorite, isFetching]);

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

  return [HeartIcon, toggleFavorite];
}

export default useIsFavorite;
