import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PhotoError,
  readLocalPhoto,
  type LocalPhoto,
  type PendingPhoto,
  type PhotoProgress,
} from '~/features/photos/photo-file';
import {
  saveWebbingPhoto,
  type WebbingPhotoDeps,
} from '~/features/webbing/photo-upload';
import { useRef } from 'react';
import { v4 as uuid } from 'uuid';

import { useAuth } from '~/context/auth';
import { deleteFromR2, uploadToR2 } from '~/lib/r2';
import { supabase } from '~/lib/supabase';

import { webbingKeys, type WebbingWithUsage } from './use-webbings';

/** Native storage and owner-scoped row wiring for `saveWebbingPhoto`. */
export function createWebbingPhotoDeps(
  webbingId: number,
  ownerId: string,
): WebbingPhotoDeps {
  return {
    readAsset: readLocalPhoto,
    upload: (key, body, contentType, onProgress) =>
      uploadToR2('webbings', key, body, contentType, onProgress),
    remove: (path) => deleteFromR2('webbings', path),
    updateImagePath: async (path) =>
      supabase
        .from('webbing')
        .update({ image_path: path })
        .eq('id', webbingId)
        .eq('user_id', ownerId)
        .select('image_path')
        .single(),
    readImagePath: async () => {
      const { data, error } = await supabase
        .from('webbing')
        .select('image_path')
        .eq('id', webbingId)
        .eq('user_id', ownerId)
        .single();
      if (error) throw error;
      return data.image_path;
    },
    createId: uuid,
  };
}

/** Write a committed path into the owner's cached inventory. */
export function setCachedWebbingPhoto(
  queryClient: ReturnType<typeof useQueryClient>,
  ownerId: string,
  webbingId: number,
  imagePath: string | null,
) {
  queryClient.setQueryData<WebbingWithUsage[]>(
    webbingKeys.webbings(ownerId),
    (current) =>
      current?.map((item) =>
        item.id === webbingId ? { ...item, image_path: imagePath } : item,
      ),
  );
  queryClient.setQueryData<WebbingWithUsage | null>(
    webbingKeys.webbing(ownerId, webbingId),
    (current) => (current ? { ...current, image_path: imagePath } : current),
  );
  void queryClient.invalidateQueries({
    queryKey: webbingKeys.webbings(ownerId),
  });
}

export interface WebbingPhotoChange {
  /** The new photo, or null to remove the personal photo. */
  asset: LocalPhoto | null;
  onProgress?: (progress: PhotoProgress) => void;
}

/** Save or remove an owned webbing's personal photo. */
export function useWebbingPhoto(webbing: WebbingWithUsage) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  // Uploaded object from an unconfirmed attempt; reconciled before retrying.
  const pending = useRef<PendingPhoto | null>(null);

  return useMutation({
    mutationFn: async ({ asset, onProgress }: WebbingPhotoChange) => {
      if (!profile || profile.id !== webbing.user_id) {
        throw new Error('Not the webbing owner');
      }
      try {
        const imagePath = await saveWebbingPhoto({
          webbingId: webbing.id,
          previousPath: webbing.image_path,
          asset,
          pending: pending.current,
          onProgress,
          deps: createWebbingPhotoDeps(webbing.id, profile.id),
        });
        pending.current = null;
        return imagePath;
      } catch (error) {
        if (error instanceof PhotoError) {
          if (error.code === 'unconfirmed') pending.current = error.pending;
          if (error.code === 'conflict') {
            pending.current = null;
            void queryClient.invalidateQueries({
              queryKey: webbingKeys.webbings(profile.id),
            });
          }
        }
        throw error;
      }
    },
    onSuccess: (imagePath) => {
      if (profile) {
        setCachedWebbingPhoto(queryClient, profile.id, webbing.id, imagePath);
      }
    },
  });
}
