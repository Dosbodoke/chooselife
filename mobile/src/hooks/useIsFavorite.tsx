import { useCallback, useState } from 'react';
import { HeartOutlinedSvg, HeartFilledSvg } from '@src/assets';

type UseIsFavorite = [React.FC<HeartStyledProps>, () => void];

interface HeartStyledProps {
  strokeColor: '#000' | '#fff';
  strokeWidth?: number; // default 1
}

function useIsFavorite(initialValue = false): UseIsFavorite {
  const [isFavorite, setIsFavorite] = useState<boolean>(initialValue);

  const toggleFavorite = useCallback(() => {
    // TODO: Integrate with API
    setIsFavorite((prev) => !prev);
  }, []);

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
