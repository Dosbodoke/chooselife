import { useState, useEffect } from 'react';

import database, { Highline } from '../../database';

export interface ILastHighline {
  id: string;
  name: string;
  length: number;
  height: number;
}

const useLastHighline = () => {
  const [lastHighline, setLastHighline] = useState<Highline[]>();

  const getLastTwoVisitedHighlines = async () => {
    const lastHighlines: Highline[] = database.highline.slice(0, 2);
    setLastHighline(lastHighlines);
  };

  useEffect(() => {
    getLastTwoVisitedHighlines();
  }, []);

  return lastHighline;
};

export default useLastHighline;
