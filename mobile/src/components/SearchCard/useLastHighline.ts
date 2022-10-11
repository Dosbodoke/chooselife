import { useState, useEffect } from 'react';

export interface ILastHighline {
  id: string;
  name: string;
  length: number;
  height: number;
}

const useLastHighline = () => {
  const [lastHighline, setLastHighline] = useState<[ILastHighline, ILastHighline]>();

  const getLastTwoVisitedHighlines = async () => {
    const lastHighlines: [ILastHighline, ILastHighline] = [
      { id: '1', name: 'Pangaré Figueiredo', height: 15, length: 42 },
      { id: '2', name: 'Varal de Cabaré', height: 24, length: 84 },
    ];
    setLastHighline(lastHighlines);
  };

  useEffect(() => {
    getLastTwoVisitedHighlines();
  }, []);

  return lastHighline;
};

export default useLastHighline;
