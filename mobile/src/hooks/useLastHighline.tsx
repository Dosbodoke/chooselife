import { useAsyncStorage } from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { useState, useEffect } from 'react';

const storageHighlineSchema = z
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

export type StorageHighline = z.infer<typeof storageHighlineSchema>;

const useLastHighline = (readItem?: boolean) => {
  const [lastHighline, setLastHighline] = useState<StorageHighline[] | null>(null);
  const { getItem, removeItem, setItem } = useAsyncStorage('@lastHighline');

  async function readAndParseItemFromStorage(): Promise<StorageHighline[] | null> {
    try {
      const item = await getItem();
      if (item !== null) {
        const parsed = JSON.parse(item);
        parsed.forEach((i: any) => storageHighlineSchema.parse(i));
        return parsed;
      }
    } catch (error) {
      await removeItem();
      console.error(error);
    }
    return null;
  }

  async function updateStorageWithNewHighline(newHighline: StorageHighline) {
    try {
      const highlines = await readAndParseItemFromStorage();
      const updatedStorage = [newHighline];
      if (highlines !== null && highlines.length !== 0) {
        const differentVisitedHighline = highlines.find((h) => h.id !== newHighline.id);
        if (differentVisitedHighline) updatedStorage.push(differentVisitedHighline);
      }
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
