import {
  PhotoError,
  type PhotoErrorCode,
  type PhotoProgress,
} from '~/features/photos/photo-file';
import * as Haptics from 'expo-haptics';
import type { TFunction } from 'i18next';
import { useState } from 'react';

/**
 * Where a photo is in its save. Screens drive it from their own save; the
 * picker only renders it. `saved` stays until the next pick or save.
 */
export type PhotoTransfer =
  | { state: 'idle' }
  /** Waiting on something else first, such as the webbing row being created. */
  | { state: 'queued' }
  | ({ state: 'uploading' } & PhotoProgress)
  | { state: 'saved' }
  | { state: 'failed'; progress: number; message: string };

export const isTransferring = (transfer: PhotoTransfer) =>
  transfer.state === 'queued' || transfer.state === 'uploading';

const IDLE: PhotoTransfer = { state: 'idle' };

/** The translated message for any photo failure. */
export function photoErrorMessage(t: TFunction, error: unknown) {
  return t(`components.photo-picker.errors.${photoErrorCode(error)}`);
}

export function photoErrorCode(error: unknown): PhotoErrorCode {
  return error instanceof PhotoError ? error.code : 'upload-failed';
}

/** Transfer state plus the transitions a save reports, with their haptics. */
export function usePhotoTransfer() {
  const [transfer, setTransfer] = useState<PhotoTransfer>(IDLE);
  return {
    transfer,
    queue: () => setTransfer({ state: 'queued' }),
    report: (progress: PhotoProgress) =>
      setTransfer({ state: 'uploading', ...progress }),
    succeed: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTransfer({ state: 'saved' });
    },
    fail: (message: string) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // The bar stops where the upload did.
      setTransfer((current) => ({
        state: 'failed',
        message,
        progress: current.state === 'uploading' ? current.progress : 0,
      }));
    },
    reset: () => setTransfer(IDLE),
  };
}
