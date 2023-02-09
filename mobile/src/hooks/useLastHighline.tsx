import { useAsyncStorage } from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { useState, useEffect } from 'react';

const highline = z
  .object({
    id: z.string(),
    name: z.string(),
    length: z.number(),
    height: z.number(),
    coords: z
      .array(
        z.object({
          latitude: z.number(),
          longitude: z.number(),
        })
      )
      .length(2),
  })
  .strict();

type Highline = z.infer<typeof highline>;

const useLastHighline = (readItem?: boolean) => {
  const [lastHighline, setLastHighline] = useState<Highline[] | null>(null);
  const { getItem, removeItem, setItem } = useAsyncStorage('lastHighline');

  async function readAndParseItemFromStorage(): Promise<Highline[] | null> {
    try {
      const item = await getItem();
      if (item !== null) {
        const parsed = JSON.parse(item);
        parsed.forEach((i: any) => highline.parse(i));
        return parsed;
      }
    } catch (error) {
      await removeItem();
      console.error(error);
    }
    return null;
  }

  async function updateStorageWithNewHighline(newHighline: Highline) {
    try {
      const highlines = await readAndParseItemFromStorage();
      if (highlines === null) return;

      const updatedStorage = [newHighline];
      const differentVisitedHighline = highlines.find((h) => h.id !== newHighline.id);
      if (differentVisitedHighline) updatedStorage.push(differentVisitedHighline);
      await setItem(JSON.stringify(updatedStorage));
    } catch (error) {
      console.error(
        'Got the following erorr when trying to update storage with new highline: ',
        error
      );
    }
  }

  useEffect(() => {
    if (!readItem) return;
    (async function () {
      const highlines = await readAndParseItemFromStorage();
      if (highlines !== null) setLastHighline(highlines);
    })();
  }, []);

  return { lastHighline, updateStorageWithNewHighline };
};

export default useLastHighline;
