import type * as ImagePicker from 'expo-image-picker';
import ReactNativeBlobUtil from 'react-native-blob-util';

import type { RegistrationImage } from './state';

const HIGHLINE_IMAGE_DIRECTORY = 'chooselife/highline-registration';

export async function stageHighlineImage(
  asset: ImagePicker.ImagePickerAsset,
  imageId = createImageId(),
): Promise<RegistrationImage> {
  const mimeType = asset.mimeType ?? 'image/jpeg';
  const extension = extensionForMimeType(mimeType);
  const normalizedImageId = imageId.includes('.')
    ? imageId
    : `${imageId}.${extension}`;
  const directory = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${HIGHLINE_IMAGE_DIRECTORY}`;
  const destination = `${directory}/${normalizedImageId}`;

  try {
    if (!(await ReactNativeBlobUtil.fs.exists(directory))) {
      await ReactNativeBlobUtil.fs.mkdir(directory);
    }
  } catch (error) {
    // Another picker callback may create the shared directory between the
    // exists check and mkdir. Preserve the file-system error otherwise.
    if (!isAlreadyExistingDirectory(error)) throw error;
  }
  if (asset.base64) {
    await ReactNativeBlobUtil.fs.writeFile(destination, asset.base64, 'base64');
  } else {
    await ReactNativeBlobUtil.fs.cp(asset.uri, destination);
  }

  return {
    imageId: normalizedImageId,
    localUri: `file://${destination}`,
    mimeType,
    fileName: asset.fileName ?? null,
    fileSize: asset.fileSize ?? null,
    width: asset.width ?? null,
    height: asset.height ?? null,
    base64: null,
    remoteKey: null,
  };
}

export async function removeStagedHighlineImage(
  image: Pick<RegistrationImage, 'localUri'> | null,
): Promise<void> {
  if (!image?.localUri) return;

  const path = image.localUri.replace(/^file:\/\//, '');
  try {
    await ReactNativeBlobUtil.fs.unlink(path);
  } catch {
    // The file may already have been reclaimed after a successful submission.
  }
}

function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/jpg':
    case 'image/jpeg':
    default:
      return 'jpg';
  }
}

function createImageId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();

  return `image-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 14)}`;
}

function isAlreadyExistingDirectory(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'EEXIST'
  );
}
