export const MAX_WEBBING_PHOTO_BYTES = 10 * 1024 * 1024;

export type WebbingPhotoErrorCode =
  /** Not a JPEG/PNG (including GIF, WebP, HEIC or an unknown type). */
  | 'unsupported-type'
  /** An animated PNG. */
  | 'animated'
  /** The bytes do not match the reported type, or the file is malformed. */
  | 'invalid-image'
  | 'too-large'
  | 'unreadable'
  | 'upload-failed'
  /** The database definitively refused the new path; the old photo is kept. */
  | 'rejected'
  /** The save could not be confirmed; reconcile before retrying. */
  | 'unconfirmed'
  /** Another change committed a different photo meanwhile. */
  | 'conflict';

export class WebbingPhotoError extends Error {
  constructor(
    readonly code: WebbingPhotoErrorCode,
    message: string,
    /** Uploaded object whose commit is unknown; pass back on retry. */
    readonly pendingPath: string | null = null,
  ) {
    super(message);
    this.name = 'WebbingPhotoError';
  }
}

const ALLOWED = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
} as const;
export type StaticPhotoType = keyof typeof ALLOWED;

/** Only JPEG and PNG are accepted; the extension is never trusted. */
export function getStaticPhotoType(
  mimeType: string | null | undefined,
): StaticPhotoType {
  const type =
    mimeType?.toLowerCase().trim() === 'image/jpg'
      ? 'image/jpeg'
      : mimeType?.toLowerCase().trim();
  if (type === 'image/jpeg' || type === 'image/png') return type;
  throw new WebbingPhotoError('unsupported-type', 'Choose a JPEG or PNG photo');
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Check the actual bytes: size bound, signature matching the reported type,
 * and, for PNG, a bounded chunk walk that rejects animation (acTL) and
 * truncated or malformed chunks.
 */
export function validateStaticPhoto(
  bytes: Uint8Array,
  mimeType: string | null | undefined,
): { contentType: StaticPhotoType; extension: 'jpg' | 'png' } {
  const contentType = getStaticPhotoType(mimeType);
  if (bytes.byteLength > MAX_WEBBING_PHOTO_BYTES) {
    throw new WebbingPhotoError('too-large', 'Photo exceeds 10 MB');
  }
  if (contentType === 'image/jpeg') {
    if (
      !(
        bytes.length >= 4 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
      )
    ) {
      throw new WebbingPhotoError('invalid-image', 'Photo is not a valid JPEG');
    }
  } else {
    validatePng(bytes);
  }
  return { contentType, extension: ALLOWED[contentType] };
}

function validatePng(bytes: Uint8Array) {
  const invalid = () =>
    new WebbingPhotoError('invalid-image', 'Photo is not a valid PNG');
  if (
    bytes.length < PNG_SIGNATURE.length ||
    PNG_SIGNATURE.some((b, i) => bytes[i] !== b)
  ) {
    throw invalid();
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = PNG_SIGNATURE.length;
  let first = true;
  // Each chunk is length(4) + type(4) + data(length) + crc(4).
  for (let guard = 0; guard < 100_000; guard++) {
    if (offset + 8 > bytes.length) throw invalid();
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );
    const end = offset + 12 + length;
    if (length > 0x7fffffff || end > bytes.length) throw invalid();
    if (first && type !== 'IHDR') throw invalid();
    first = false;
    if (type === 'acTL') {
      throw new WebbingPhotoError(
        'animated',
        'Animated images are not supported',
      );
    }
    if (type === 'IEND') return;
    offset = end;
  }
  throw invalid();
}

// ============================================================================
// Commit lifecycle
// ============================================================================

export interface PhotoAsset {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
}

export interface WebbingPhotoDeps {
  readAsset(uri: string): Promise<ArrayBuffer>;
  /** Uploads under the owner-scoped bucket path; returns the stored key. */
  upload(key: string, body: ArrayBuffer, contentType: string): Promise<string>;
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
  asset: PhotoAsset | null;
  /** Uploaded object from an earlier unconfirmed attempt, if any. */
  pendingPath?: string | null;
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
  pendingPath = null,
  deps,
}: SaveWebbingPhotoInput): Promise<string | null> {
  let committedBefore = previousPath;

  if (pendingPath) {
    const reconciled = await reconcile(pendingPath, committedBefore, deps);
    if (reconciled.committed) {
      if (committedBefore && committedBefore !== pendingPath) {
        await quietly(deps.remove(committedBefore));
      }
      return pendingPath;
    }
    committedBefore = reconciled.current;
  }

  let newPath: string | null = null;
  if (asset) {
    if (asset.fileSize && asset.fileSize > MAX_WEBBING_PHOTO_BYTES) {
      throw new WebbingPhotoError('too-large', 'Photo exceeds 10 MB');
    }
    const declared = getStaticPhotoType(asset.mimeType);
    let body: ArrayBuffer;
    try {
      body = await deps.readAsset(asset.uri);
    } catch {
      throw new WebbingPhotoError(
        'unreadable',
        'Could not read selected photo',
      );
    }
    const { contentType, extension } = validateStaticPhoto(
      new Uint8Array(body),
      declared,
    );
    try {
      newPath = await deps.upload(
        `${webbingId}/${deps.createId()}.${extension}`,
        body,
        contentType,
      );
    } catch {
      throw new WebbingPhotoError(
        'upload-failed',
        'Photo could not be uploaded',
      );
    }
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
    throw new WebbingPhotoError('rejected', 'Photo could not be saved');
  } else {
    // The response was lost: read back before deciding anything.
    const reconciled = await reconcile(newPath, committedBefore, deps);
    if (!reconciled.committed) {
      throw new WebbingPhotoError('upload-failed', 'Photo could not be saved');
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
): Promise<{ committed: boolean; current: string | null }> {
  let current: string | null;
  try {
    current = await deps.readImagePath();
  } catch {
    throw new WebbingPhotoError(
      'unconfirmed',
      'We could not confirm whether the photo was saved',
      target,
    );
  }
  if (current === target) return { committed: true, current };
  if (current === previousPath) {
    if (target) await quietly(deps.remove(target));
    return { committed: false, current };
  }
  throw new WebbingPhotoError('conflict', 'This photo was changed elsewhere');
}
