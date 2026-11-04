import {
  PhotoError,
  photoProgress,
  preparePhotoUpload,
  type LocalPhoto,
  type PendingPhoto,
  type PhotoProgress,
} from '~/features/photos/photo-file';

// ============================================================================
// Commit lifecycle
// ============================================================================

export interface WebbingPhotoDeps {
  readAsset(uri: string): Promise<ArrayBuffer>;
  /** Uploads under the owner-scoped bucket path; returns the stored key. */
  upload(
    key: string,
    body: ArrayBuffer,
    contentType: string,
    onProgress?: (sent: number) => void,
  ): Promise<string>;
  remove(path: string): Promise<void>;
  /** Owner-scoped row update. Returns Supabase-style `{ data, error }`; may throw. */
  updateImagePath(path: string | null): Promise<{
    data: { image_path: string | null } | null;
    error: { code?: string | null; message: string } | null;
  }>;
  /** Owner-scoped read-back; must throw when the read fails. */
  readImagePath(): Promise<string | null>;
  createId(): string;
}

export interface SaveWebbingPhotoInput {
  webbingId: number;
  /** The path committed before this attempt (what a failure must keep). */
  previousPath: string | null;
  /** New photo, or null to remove the personal photo. */
  asset: LocalPhoto | null;
  /** Uploaded object from an earlier unconfirmed attempt, if any. */
  pending?: PendingPhoto | null;
  onProgress?: (progress: PhotoProgress) => void;
  deps: WebbingPhotoDeps;
}

function isDefinitive(error: { code?: string | null }) {
  return !!error.code && /^([0-9A-Z]{5}|PGRST\d+)$/.test(error.code);
}

const quietly = (promise: Promise<void>) => promise.catch(() => undefined);

/**
 * Upload (optional) and commit a personal photo for an existing webbing.
 *
 * Never deletes a newly uploaded object unless the row provably does not
 * reference it, and only removes the previous object after the new key is
 * committed. Returns the committed `image_path`.
 */
export async function saveWebbingPhoto({
  webbingId,
  previousPath,
  asset,
  pending = null,
  onProgress,
  deps,
}: SaveWebbingPhotoInput): Promise<string | null> {
  let committedBefore = previousPath;

  if (pending) {
    const reconciled = await reconcile(
      pending.path,
      committedBefore,
      deps,
      pending.sourceUri,
    );
    if (reconciled.committed) {
      if (committedBefore && committedBefore !== pending.path) {
        await quietly(deps.remove(committedBefore));
      }
      // A retry of the same photo is already done; anything else still runs.
      if ((asset?.uri ?? null) === pending.sourceUri) return pending.path;
    }
    committedBefore = reconciled.current;
  }

  let newPath: string | null = null;
  if (asset) {
    onProgress?.(photoProgress('preparing'));
    const { body, contentType, extension } = await preparePhotoUpload(
      asset,
      deps.readAsset,
    );
    onProgress?.(photoProgress('sending'));
    try {
      newPath = await deps.upload(
        `${webbingId}/${deps.createId()}.${extension}`,
        body,
        contentType,
        (sent) => onProgress?.(photoProgress('sending', sent)),
      );
    } catch {
      throw new PhotoError('upload-failed', 'Photo could not be uploaded');
    }
    onProgress?.(photoProgress('saving'));
  }

  let response: Awaited<
    ReturnType<WebbingPhotoDeps['updateImagePath']>
  > | null = null;
  try {
    response = await deps.updateImagePath(newPath);
  } catch {
    response = null;
  }

  let committed: string | null;
  if (response?.data && !response.error) {
    committed = response.data.image_path;
  } else if (response?.error && isDefinitive(response.error)) {
    if (newPath) await quietly(deps.remove(newPath));
    throw new PhotoError('rejected', 'Photo could not be saved');
  } else {
    // The response was lost: read back before deciding anything.
    const reconciled = await reconcile(
      newPath,
      committedBefore,
      deps,
      asset?.uri ?? null,
    );
    if (!reconciled.committed) {
      throw new PhotoError('upload-failed', 'Photo could not be saved');
    }
    committed = newPath;
  }

  if (committedBefore && committedBefore !== committed) {
    await quietly(deps.remove(committedBefore));
  }
  return committed;
}

/**
 * Decide whether `target` is committed. Cleans up `target` only when the row
 * still holds the previous path; preserves objects on read failure or when a
 * different path was committed concurrently.
 */
async function reconcile(
  target: string | null,
  previousPath: string | null,
  deps: WebbingPhotoDeps,
  sourceUri: string | null = null,
): Promise<{ committed: boolean; current: string | null }> {
  let current: string | null;
  try {
    current = await deps.readImagePath();
  } catch {
    throw new PhotoError(
      'unconfirmed',
      'We could not confirm whether the photo was saved',
      target ? { path: target, sourceUri } : null,
    );
  }
  if (current === target) return { committed: true, current };
  if (current === previousPath) {
    if (target) await quietly(deps.remove(target));
    return { committed: false, current };
  }
  throw new PhotoError('conflict', 'This photo was changed elsewhere');
}
