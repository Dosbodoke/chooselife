import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ImagePickerAsset } from 'expo-image-picker';
import { v4 as uuid } from 'uuid';

import { useAuth } from '~/context/auth';
import { deleteFromR2, uploadToR2 } from '~/lib/r2';
import { supabase } from '~/lib/supabase';

import { useWebbingsKeyFactory, type WebbingWithUsage } from './use-webbings';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export function useWebbingPhoto(webbing: WebbingWithUsage) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (asset: ImagePickerAsset | null) => {
      if (!profile || profile.id !== webbing.user_id) {
        throw new Error('Not the webbing owner');
      }
      let uploadedPath: string | null = null;
      if (asset) {
        if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) {
          throw new Error('Photo exceeds 10 MB');
        }
        const response = await fetch(asset.uri);
        if (!response.ok) throw new Error('Could not read selected photo');
        const body = await response.arrayBuffer();
        if (body.byteLength > MAX_PHOTO_BYTES)
          throw new Error('Photo exceeds 10 MB');
        const contentType = asset.mimeType || 'image/jpeg';
        if (!contentType.startsWith('image/')) throw new Error('Invalid image');
        const extension =
          contentType.slice('image/'.length).replace(/[^a-z0-9]/gi, '') ||
          'jpeg';
        uploadedPath = await uploadToR2(
          'webbings',
          `${webbing.id}/${uuid()}.${extension}`,
          body,
          contentType,
        );
      }

      const { data, error } = await supabase
        .from('webbing')
        .update({ image_path: uploadedPath })
        .eq('id', webbing.id)
        .eq('user_id', profile.id)
        .select('image_path')
        .single();

      if (error) {
        if (uploadedPath)
          await deleteFromR2('webbings', uploadedPath).catch(() => undefined);
        throw error;
      }
      // Commit the row first so a failed save never removes the current photo.
      if (webbing.image_path && webbing.image_path !== data.image_path) {
        await deleteFromR2('webbings', webbing.image_path).catch(
          () => undefined,
        );
      }
      return data.image_path;
    },
    onSuccess: (imagePath) => {
      queryClient.setQueryData<WebbingWithUsage[]>(
        useWebbingsKeyFactory.webbings(),
        (current) =>
          current?.map((item) =>
            item.id === webbing.id ? { ...item, image_path: imagePath } : item,
          ),
      );
      queryClient.setQueryData<WebbingWithUsage | null>(
        useWebbingsKeyFactory.webbing(webbing.id),
        (current) =>
          current ? { ...current, image_path: imagePath } : current,
      );
      void queryClient.invalidateQueries({
        queryKey: useWebbingsKeyFactory.webbings(),
      });
    },
  });
}
