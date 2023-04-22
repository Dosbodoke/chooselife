import { useAsyncStorage } from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import { z } from 'zod';
import { RouterOutput } from '@src/utils/trpc';

const storageHighlineSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  length: z.number(),
  height: z.number(),
  isRigged: z.boolean(),
  coords: z
    .array(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
      })
    )
    .length(2),
});

export type StorageHighline = NonNullable<RouterOutput['highline']['getById']> & {
  coords: {
    latitude: number;
    longitude: number;
  }[];
};

const useLastHighline = (readItem?: boolean) => {
  const [lastHighline, setLastHighline] = useState<StorageHighline[] | null>(null);
  const { getItem, removeItem, setItem } = useAsyncStorage('@lastHighline');

  async function readAndParseItemFromStorage(): Promise<StorageHighline[] | null> {
    try {
      const item = await getItem();
      if (!item) return null;
      const parsedItem = JSON.parse(item);
      if (!Array.isArray(parsedItem)) throw new Error('Item is not an array');
      // Check if all itens on Array has the right shape
      // if '.parse(item)' fails, it will throw an error
      parsedItem.forEach((item) => storageHighlineSchema.parse(item));
      return parsedItem;
    } catch (error) {
      // if there is an error, wipe the storage
      await removeItem();
    }
    return null;
  }

  async function updateStorageWithNewHighline(newHighline: StorageHighline) {
    try {
      const highlines = await readAndParseItemFromStorage();
      const updatedStorage = [newHighline];
      if (highlines !== null && highlines.length !== 0) {
        const differentVisitedHighline = highlines.find((h) => h.uuid !== newHighline.uuid);
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
