/**
 * Rules every user photo follows (Highline covers, webbing photos): static
 * JPEG or PNG, at most 10 MB, checked on pick and again on the actual bytes.
 */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export type PhotoErrorCode =
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

/** An uploaded object whose commit is unknown, and the photo it came from. */
export interface PendingPhoto {
  path: string;
  sourceUri: string | null;
}

export class PhotoError extends Error {
  constructor(
    readonly code: PhotoErrorCode,
    message: string,
    /** Uploaded object whose commit is unknown; pass back on retry. */
    readonly pending: PendingPhoto | null = null,
  ) {
    super(message);
    this.name = 'PhotoError';
  }
}

/** Codes where retrying the same photo can never succeed. */
export const isPhotoFileError = (code: PhotoErrorCode) =>
  code === 'unsupported-type' ||
  code === 'animated' ||
  code === 'invalid-image' ||
  code === 'too-large' ||
  code === 'unreadable';

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
} as const;
export type StaticPhotoType = keyof typeof EXTENSIONS;

/** A picked photo that hasn't been uploaded yet. */
export interface LocalPhoto {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
}

const unsupported = () =>
  new PhotoError('unsupported-type', 'Choose a JPEG or PNG photo');

/**
 * The declared type, normalized. Missing types return null so the bytes can
 * decide; the file extension is never trusted.
 */
function declaredType(
  mimeType: string | null | undefined,
): StaticPhotoType | null {
  const type = mimeType?.toLowerCase().trim();
  if (!type) return null;
  if (type === 'image/jpeg' || type === 'image/jpg') return 'image/jpeg';
  if (type === 'image/png') return 'image/png';
  throw unsupported();
}

/** Cheap checks on what the picker reports, before any bytes are read. */
export function checkLocalPhoto(photo: LocalPhoto) {
  declaredType(photo.mimeType);
  if (photo.fileSize && photo.fileSize > MAX_PHOTO_BYTES) {
    throw new PhotoError('too-large', 'Photo exceeds 10 MB');
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const isJpeg = (bytes: Uint8Array) =>
  bytes.length >= 3 &&
  bytes[0] === 0xff &&
  bytes[1] === 0xd8 &&
  bytes[2] === 0xff;
const isPng = (bytes: Uint8Array) =>
  bytes.length >= PNG_SIGNATURE.length &&
  PNG_SIGNATURE.every((b, i) => bytes[i] === b);

/**
 * Check the actual bytes: size bound, signature matching the reported type
 * (or, when none was reported, identifying it), and for PNG a bounded chunk
 * walk that rejects animation (acTL) and truncated or malformed chunks.
 */
export function validateStaticPhoto(
  bytes: Uint8Array,
  mimeType: string | null | undefined,
): { contentType: StaticPhotoType; extension: 'jpg' | 'png' } {
  const declared = declaredType(mimeType);
  if (bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new PhotoError('too-large', 'Photo exceeds 10 MB');
  }
  const contentType =
    declared ??
    (isJpeg(bytes) ? 'image/jpeg' : isPng(bytes) ? 'image/png' : null);
  if (!contentType) throw unsupported();
  if (contentType === 'image/jpeg') {
    if (!isJpeg(bytes)) {
      throw new PhotoError('invalid-image', 'Photo is not a valid JPEG');
    }
  } else {
    validatePng(bytes);
  }
  return { contentType, extension: EXTENSIONS[contentType] };
}

function validatePng(bytes: Uint8Array) {
  const invalid = () =>
    new PhotoError('invalid-image', 'Photo is not a valid PNG');
  if (!isPng(bytes)) throw invalid();
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
      throw new PhotoError('animated', 'Animated images are not supported');
    }
    if (type === 'IEND') return;
    offset = end;
  }
  throw invalid();
}

/** Read a picked photo's bytes from its local uri. */
export async function readLocalPhoto(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Could not read ${uri}`);
  return response.arrayBuffer();
}

/** Check, read and validate a picked photo before uploading it. */
export async function preparePhotoUpload(
  photo: LocalPhoto,
  read: (uri: string) => Promise<ArrayBuffer> = readLocalPhoto,
) {
  checkLocalPhoto(photo);
  let body: ArrayBuffer;
  try {
    body = await read(photo.uri);
  } catch {
    throw new PhotoError('unreadable', 'Could not read selected photo');
  }
  return { body, ...validateStaticPhoto(new Uint8Array(body), photo.mimeType) };
}

// ============================================================================
// Progress
// ============================================================================

export type PhotoUploadStep = 'preparing' | 'sending' | 'saving';

/** One monotonic 0–1 value across the steps, so a bar never jumps back. */
export interface PhotoProgress {
  step: PhotoUploadStep;
  progress: number;
}

/** Map a step (and, while sending, the share of bytes sent) to progress. */
export function photoProgress(step: PhotoUploadStep, sent = 0): PhotoProgress {
  if (step === 'preparing') return { step, progress: 0.04 };
  if (step === 'saving') return { step, progress: 0.96 };
  return { step, progress: 0.08 + 0.84 * Math.min(1, Math.max(0, sent)) };
}
