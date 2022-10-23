import database, { Highline } from '@src/database';
import { useState, useEffect } from 'react';

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
