import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  saveWebbingPhoto,
  WebbingPhotoError,
  type WebbingPhotoDeps,
} from '~/features/webbing/photo-upload';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useRef } from 'react';
import { v4 as uuid } from 'uuid';

import { useAuth } from '~/context/auth';
import { deleteFromR2, uploadToR2 } from '~/lib/r2';
import { supabase } from '~/lib/supabase';

import { webbingKeys, type WebbingWithUsage } from './use-webbings';

/** Image library options shared by registration and My Webbings. */
export const WEBBING_PHOTO_PICKER_OPTIONS = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [4, 3],
  quality: 0.8,
  exif: false,
} as const;

/** Native storage and owner-scoped row wiring for `saveWebbingPhoto`. */
export function createWebbingPhotoDeps(
  webbingId: number,
  ownerId: string,
): WebbingPhotoDeps {
  return {
    readAsset: async (uri) => {
      const response = await fetch(uri);
      if (!response.ok) throw new Error('Could not read selected photo');
      return response.arrayBuffer();
    },
    upload: (key, body, contentType) =>
      uploadToR2('webbings', key, body, contentType),
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

export function useWebbingPhoto(webbing: WebbingWithUsage) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  // Uploaded object from an unconfirmed attempt; reconciled before retrying.
  const pendingPath = useRef<string | null>(null);

  return useMutation({
    mutationFn: async (asset: ImagePickerAsset | null) => {
      if (!profile || profile.id !== webbing.user_id) {
        throw new Error('Not the webbing owner');
      }
      try {
        const imagePath = await saveWebbingPhoto({
          webbingId: webbing.id,
          previousPath: webbing.image_path,
          asset,
          pendingPath: pendingPath.current,
          deps: createWebbingPhotoDeps(webbing.id, profile.id),
        });
        pendingPath.current = null;
        return imagePath;
      } catch (error) {
        if (error instanceof WebbingPhotoError) {
          if (error.code === 'unconfirmed')
            pendingPath.current = error.pendingPath;
          if (error.code === 'conflict') {
            pendingPath.current = null;
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
