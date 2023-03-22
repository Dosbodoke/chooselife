import { useCallback, useState } from 'react';
import { HeartOutlinedSvg, HeartFilledSvg } from '@src/assets';

type UseIsFavorite = [React.FC, () => void];

function useIsFavorite(initialValue = false): UseIsFavorite {
  const [isFavorite, setIsFavorite] = useState<boolean>(initialValue);

  const toggleFavorite = useCallback(() => {
    // TODO: Integrate with API
    setIsFavorite((prev) => !prev);
  }, []);

  const HeartIcon: React.FC = () => {
    return <>{isFavorite ? <HeartFilledSvg /> : <HeartOutlinedSvg />}</>;
  };

  return [HeartIcon, toggleFavorite];
}

export default useIsFavorite;
