import type {
  QueuedHighlineSubmission,
  RegistrationError,
  RegistrationImage,
} from './state';
import { createHighlineId } from './state';

export const submitHighlineRegistrationMutationKey = [
  'submit-highline-registration',
] as const;

export type SubmissionIdentifiers = {
  highlineId: string;
  imageId: string | null;
};

export type SerializedSubmissionVariables = {
  submissionId: string;
  sourceDraftId: string;
  ownerId: string;
  highlineId: string;
  imageId: string | null;
  anchorA: [number, number];
  anchorB: [number, number];
  form: {
    name: string;
    height: number | null;
    length: number | null;
    description: string;
    image: SerializedImage | null;
  };
};

export type SerializedImage = Omit<
  RegistrationImage,
  'base64' | 'remoteKey'
> & {
  base64: null;
  remoteKey: string | null;
};

export type HighlineInsert = {
  id: string;
  name: string;
  height: number;
  length: number;
  description: string;
  cover_image: string | null;
  anchor_a: `POINT(${number} ${number})`;
  anchor_b: `POINT(${number} ${number})`;
};

export type SubmissionDependencies = {
  readImage: (localUri: string) => Promise<ArrayBuffer | Uint8Array>;
  uploadImage: (
    bucket: string,
    key: string,
    body: ArrayBuffer | Uint8Array,
    contentType: string,
  ) => Promise<string>;
  insertHighline: (payload: HighlineInsert) => Promise<{
    data: { id: string } | null;
    error: {
      code?: string | null;
      message: string;
      status?: number | null;
    } | null;
  }>;
  deleteImage?: (bucket: string, key: string) => Promise<void>;
};

export type SubmissionResult = {
  highlineId: string;
  replayed: boolean;
};

export class HighlineSubmissionError
  extends Error
  implements RegistrationError
{
  readonly code: string;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(
    error: RegistrationError & { status?: number },
    options?: ErrorOptions,
  ) {
    super(error.message, options);
    this.name = 'HighlineSubmissionError';
    this.code = error.code;
    this.retryable = error.retryable;
    this.status = error.status;
  }
}

export function createSubmissionIdentifiers(
  submission: QueuedHighlineSubmission,
  allocated: Partial<SubmissionIdentifiers> = {},
): SubmissionIdentifiers {
  const highlineId =
    submission.highlineId || allocated.highlineId || createStableUuid();
  const image = submission.form.image;

  if (!image) {
    return { highlineId, imageId: null };
  }

  const imageId =
    submission.imageId ||
    allocated.imageId ||
    image.remoteKey ||
    image.imageId ||
    `${highlineId}.${extensionForMimeType(image.mimeType)}`;

  return { highlineId, imageId };
}

export function serializeSubmissionVariables(
  submission: QueuedHighlineSubmission,
): SerializedSubmissionVariables {
  const { highlineId, imageId } = requirePersistedIdentifiers(submission);
  const image = serializeImage(submission.form.image, imageId);

  return {
    submissionId: submission.submissionId,
    sourceDraftId: submission.sourceDraftId,
    ownerId: submission.ownerId,
    highlineId,
    imageId,
    anchorA: [...submission.anchorA],
    anchorB: [...submission.anchorB],
    form: {
      name: submission.form.name ?? '',
      height: submission.form.height ?? null,
      length: submission.form.length ?? null,
      description: submission.form.description ?? '',
      image,
    },
  };
}

export function buildHighlineInsert(
  submission: QueuedHighlineSubmission | SerializedSubmissionVariables,
): HighlineInsert {
  const highlineId = submission.highlineId;
  if (!highlineId) {
    throw new HighlineSubmissionError({
      code: 'IDENTIFIERS_MISSING',
      message: 'A stable highline identifier is required before submission.',
      retryable: false,
    });
  }

  const { name, height, length, description, image } = submission.form;
  if (image && !submission.imageId) {
    throw new HighlineSubmissionError({
      code: 'IDENTIFIERS_MISSING',
      message: 'A stable image identifier is required before submission.',
      retryable: false,
    });
  }
  if (
    height === null ||
    length === null ||
    !Number.isFinite(height) ||
    !Number.isFinite(length) ||
    !name.trim()
  ) {
    throw new HighlineSubmissionError({
      code: 'INVALID_FORM',
      message: 'The highline form is incomplete.',
      retryable: false,
    });
  }

  return {
    id: highlineId,
    name: name.trim(),
    height,
    length,
    description,
    cover_image: image ? submission.imageId : null,
    anchor_a: positionToPostGISPoint(submission.anchorA),
    anchor_b: positionToPostGISPoint(submission.anchorB),
  };
}

export async function submitHighlineRegistration(
  submission: QueuedHighlineSubmission | SerializedSubmissionVariables,
  dependencies: SubmissionDependencies,
): Promise<SubmissionResult> {
  const variables = isSerializedSubmission(submission)
    ? submission
    : serializeSubmissionVariables(submission);
  const insert = buildHighlineInsert(variables);
  const image = variables.form.image;
  let uploadedImage = false;

  if (image) {
    if (!image.localUri || !variables.imageId) {
      throw new HighlineSubmissionError({
        code: 'IMAGE_NOT_STAGED',
        message: 'The selected image is not available for offline submission.',
        retryable: false,
      });
    }

    try {
      const body = await dependencies.readImage(image.localUri);
      await dependencies.uploadImage(
        'images',
        variables.imageId,
        body,
        image.mimeType ?? 'image/jpeg',
      );
      uploadedImage = true;
    } catch (error) {
      throw toSubmissionError(error);
    }
  }

  let response: Awaited<ReturnType<SubmissionDependencies['insertHighline']>>;
  try {
    response = await dependencies.insertHighline(insert);
  } catch (error) {
    throw toSubmissionError(error);
  }

  if (response.error) {
    if (response.error.code === '23505') {
      return { highlineId: variables.highlineId, replayed: true };
    }

    const submissionError = toSubmissionError(response.error);
    if (uploadedImage && !submissionError.retryable && variables.imageId) {
      await safelyDeleteImage(dependencies.deleteImage, variables.imageId);
    }
    throw submissionError;
  }

  return {
    highlineId: response.data?.id ?? variables.highlineId,
    replayed: false,
  };
}

export function classifySubmissionError(error: unknown): RegistrationError & {
  status?: number;
} {
  if (error instanceof HighlineSubmissionError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      status: error.status,
    };
  }

  const record = isRecord(error) ? error : null;
  const message =
    record && typeof record.message === 'string'
      ? record.message
      : error instanceof Error
        ? error.message
        : String(error);
  const status =
    record && typeof record.status === 'number' ? record.status : undefined;
  const code =
    record && typeof record.code === 'string' ? record.code : undefined;
  const normalized = message.toLowerCase();
  const networkFailure =
    error instanceof TypeError ||
    (typeof code === 'string' &&
      /network|econn|enet|eai_again|timeout|fetch|dns/i.test(code)) ||
    /network|offline|timed? ?out|timeout|fetch failed|connection|econn|dns|temporarily unavailable/.test(
      normalized,
    );
  const retryableStatus =
    status === 408 || status === 425 || status === 429 || (status ?? 0) >= 500;

  return {
    code:
      code ??
      (status
        ? `HTTP_${status}`
        : networkFailure
          ? 'NETWORK_ERROR'
          : 'SUBMISSION_FAILED'),
    message,
    retryable: networkFailure || retryableStatus,
    status,
  };
}

export function isTerminalSubmissionFailure(
  error: unknown,
  failureCount: number,
): boolean {
  const classified = classifySubmissionError(error);
  if (!classified.retryable) return true;

  // Offline requests are intentionally left pending. The online manager will
  // resume them after connectivity returns; only repeated server-side
  // failures should become an actionable needs-attention item.
  if (isNetworkLikeFailure(classified)) return false;
  return failureCount >= 3;
}

export function validateSubmissionOwner(
  variables: Pick<SerializedSubmissionVariables, 'ownerId'>,
  currentOwnerId: string | null,
): RegistrationError | null {
  if (!currentOwnerId) {
    return {
      code: 'AUTH_SESSION_UNAVAILABLE',
      message:
        'Authentication is not ready; this submission will remain pending until sign-in.',
      retryable: true,
    };
  }

  if (currentOwnerId !== variables.ownerId) {
    return {
      code: 'AUTH_OWNER_MISMATCH',
      message: 'The signed-in account does not own this saved submission.',
      retryable: false,
    };
  }

  return null;
}

function requirePersistedIdentifiers(
  submission: QueuedHighlineSubmission,
): SubmissionIdentifiers {
  if (
    !submission.highlineId ||
    (submission.form.image && !submission.imageId)
  ) {
    throw new HighlineSubmissionError({
      code: 'IDENTIFIERS_MISSING',
      message: 'Stable submission identifiers must be persisted before replay.',
      retryable: false,
    });
  }
  return {
    highlineId: submission.highlineId,
    imageId: submission.imageId,
  };
}

function serializeImage(
  image: RegistrationImage | null,
  imageId: string | null,
): SerializedImage | null {
  if (!image) return null;
  if (!image.localUri) {
    throw new HighlineSubmissionError({
      code: 'IMAGE_NOT_STAGED',
      message: 'The selected image is not staged in app-private storage.',
      retryable: false,
    });
  }

  return {
    imageId: image.imageId,
    localUri: image.localUri,
    mimeType: image.mimeType ?? null,
    fileName: image.fileName ?? null,
    fileSize: image.fileSize ?? null,
    width: image.width ?? null,
    height: image.height ?? null,
    base64: null,
    remoteKey: imageId,
  };
}

function isSerializedSubmission(
  submission: QueuedHighlineSubmission | SerializedSubmissionVariables,
): submission is SerializedSubmissionVariables {
  const image = submission.form.image;
  return (
    'submissionId' in submission &&
    'ownerId' in submission &&
    'highlineId' in submission &&
    submission.highlineId !== null &&
    (!image || image.base64 === null)
  );
}

function toSubmissionError(error: unknown): HighlineSubmissionError {
  return new HighlineSubmissionError(classifySubmissionError(error));
}

async function safelyDeleteImage(
  deleteImage: SubmissionDependencies['deleteImage'],
  imageId: string,
): Promise<void> {
  if (!deleteImage) return;
  try {
    await deleteImage('images', imageId);
  } catch {
    // Keep the original deterministic submission failure. A subsequent cleanup
    // pass can remove the stable key without hiding the actionable form error.
  }
}

function extensionForMimeType(mimeType: string | null): string {
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

function positionToPostGISPoint(
  position: [number, number],
): `POINT(${number} ${number})` {
  return `POINT(${position[0]} ${position[1]})`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNetworkLikeFailure(
  error: Pick<RegistrationError, 'code' | 'message'> & {
    status?: number;
  },
): boolean {
  if (typeof error.status === 'number' && error.status > 0) return false;

  return (
    error.code === 'NETWORK_ERROR' ||
    error.code === 'AUTH_SESSION_UNAVAILABLE' ||
    /network|econn|enet|eai_again|timeout|fetch|dns/i.test(error.code) ||
    /network|offline|timed? ?out|timeout|fetch failed|connection|econn|dns|temporarily unavailable/.test(
      error.message.toLowerCase(),
    )
  );
}

function createStableUuid(): string {
  return createHighlineId();
}
