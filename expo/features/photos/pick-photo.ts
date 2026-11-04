import * as ImagePicker from 'expo-image-picker';

import {
  checkLocalPhoto,
  PhotoError,
  type LocalPhoto,
  type PhotoErrorCode,
} from './photo-file';

/** Crop and compression per surface; validation is the same everywhere. */
export interface PhotoSpec {
  aspect: [number, number];
  quality: number;
}

export const PHOTO_SPECS = {
  highlineCover: { aspect: [16, 9], quality: 0.7 },
  webbing: { aspect: [4, 3], quality: 0.8 },
} satisfies Record<string, PhotoSpec>;

export type PickPhotoResult =
  | { kind: 'picked'; photo: LocalPhoto }
  | { kind: 'canceled' }
  | { kind: 'invalid'; code: PhotoErrorCode };

/** Open the library and check type and size before anything is saved. */
export async function pickPhoto(spec: PhotoSpec): Promise<PickPhotoResult> {
  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: spec.aspect,
      quality: spec.quality,
      exif: false,
    });
  } catch {
    return { kind: 'invalid', code: 'unreadable' };
  }
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { kind: 'canceled' };
  const photo = {
    uri: asset.uri,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
  };
  try {
    checkLocalPhoto(photo);
  } catch (error) {
    return {
      kind: 'invalid',
      code: error instanceof PhotoError ? error.code : 'unreadable',
    };
  }
  return { kind: 'picked', photo };
}
