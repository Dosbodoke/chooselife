import AsyncStorage from 'expo-sqlite/kv-store';

import {
  AnchorPosition,
  createEmptyRegistrationState,
  HIGHLINE_REGISTRATION_STATE_VERSION,
  HighlineRegistrationState,
  QueuedHighlineSubmission,
  RegistrationDraft,
  RegistrationError,
  RegistrationForm,
  RegistrationImage,
  RegistrationStage,
} from './model';

export const HIGHLINE_REGISTRATION_STORAGE_PREFIX =
  'highline-registration:v1:';

export type RegistrationStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export function createRegistrationStorageKey(ownerId: string): string {
  if (!ownerId) throw new Error('An owner ID is required for registration state');
  return `${HIGHLINE_REGISTRATION_STORAGE_PREFIX}${encodeURIComponent(ownerId)}`;
}

export async function loadRegistrationState(
  ownerId: string,
  storage: RegistrationStorage = AsyncStorage,
): Promise<HighlineRegistrationState> {
  const serialized = await storage.getItem(createRegistrationStorageKey(ownerId));
  if (!serialized) return createEmptyRegistrationState(ownerId);

  try {
    const value: unknown = JSON.parse(serialized);
    return normalizeRegistrationState(value, ownerId);
  } catch {
    return createEmptyRegistrationState(ownerId);
  }
}

export async function saveRegistrationState(
  ownerId: string,
  state: HighlineRegistrationState,
  storage: RegistrationStorage = AsyncStorage,
): Promise<void> {
  if (state.ownerId !== ownerId) {
    throw new Error('Registration state owner does not match storage owner');
  }
  if (state.version !== HIGHLINE_REGISTRATION_STATE_VERSION) {
    throw new Error('Unsupported registration state version');
  }

  await storage.setItem(
    createRegistrationStorageKey(ownerId),
    JSON.stringify(stripStagedImageBytes(state)),
  );
}

export async function clearRegistrationState(
  ownerId: string,
  storage: RegistrationStorage = AsyncStorage,
): Promise<void> {
  await storage.removeItem(createRegistrationStorageKey(ownerId));
}

export function normalizeRegistrationState(
  value: unknown,
  ownerId: string,
): HighlineRegistrationState {
  if (!isRecord(value)) return createEmptyRegistrationState(ownerId);
  if (value.version !== HIGHLINE_REGISTRATION_STATE_VERSION) {
    return createEmptyRegistrationState(ownerId);
  }
  if (value.ownerId !== ownerId) return createEmptyRegistrationState(ownerId);

  const activeDraft = normalizeDraft(value.activeDraft, ownerId);
  const submissions = Array.isArray(value.submissions)
    ? value.submissions.flatMap((item) => {
        const submission = normalizeSubmission(item, ownerId);
        return submission ? [submission] : [];
      })
    : [];

  return {
    version: HIGHLINE_REGISTRATION_STATE_VERSION,
    ownerId,
    activeDraft,
    submissions,
  };
}

function normalizeDraft(
  value: unknown,
  ownerId: string,
): RegistrationDraft | null {
  if (value === null) return null;
  if (!isRecord(value)) return null;
  if (value.ownerId !== ownerId || value.status !== 'draft') return null;
  if (typeof value.draftId !== 'string' || !value.draftId) return null;
  if (!isRegistrationStage(value.stage)) return null;
  if (!isNullableString(value.exitedAt)) return null;

  const form = normalizeForm(value.form);
  if (!form) return null;

  return {
    draftId: value.draftId,
    ownerId,
    status: 'draft',
    stage: value.stage,
    adjustingAnchor: isAdjustingAnchor(value.adjustingAnchor)
      ? value.adjustingAnchor
      : null,
    anchorA: normalizeAnchor(value.anchorA),
    anchorB: normalizeAnchor(value.anchorB),
    form,
    createdAt: stringOrEmpty(value.createdAt),
    updatedAt: stringOrEmpty(value.updatedAt),
    exitedAt: value.exitedAt,
  };
}

function normalizeSubmission(
  value: unknown,
  ownerId: string,
): QueuedHighlineSubmission | null {
  if (!isRecord(value)) return null;
  if (value.ownerId !== ownerId) return null;
  if (value.status !== 'pending' && value.status !== 'needs-attention') {
    return null;
  }
  if (
    typeof value.submissionId !== 'string' ||
    !value.submissionId ||
    typeof value.sourceDraftId !== 'string' ||
    !value.sourceDraftId
  ) {
    return null;
  }

  const anchorA = normalizeAnchor(value.anchorA);
  const anchorB = normalizeAnchor(value.anchorB);
  const form = normalizeForm(value.form);
  if (!anchorA || !anchorB || !form) return null;

  return {
    submissionId: value.submissionId,
    sourceDraftId: value.sourceDraftId,
    ownerId,
    status: value.status,
    anchorA,
    anchorB,
    form,
    highlineId: nullableStringOrNull(value.highlineId),
    imageId: nullableStringOrNull(value.imageId),
    createdAt: stringOrEmpty(value.createdAt),
    updatedAt: stringOrEmpty(value.updatedAt),
    submittedAt: nullableStringOrNull(value.submittedAt),
    attemptCount: nonNegativeInteger(value.attemptCount),
    lastAttemptAt: nullableStringOrNull(value.lastAttemptAt),
    nextAttemptAt: nullableStringOrNull(value.nextAttemptAt),
    lastError: normalizeError(value.lastError),
  };
}

function normalizeForm(value: unknown): RegistrationForm | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.name !== 'string' ||
    !isNullableNumber(value.height) ||
    !isNullableNumber(value.length) ||
    typeof value.description !== 'string'
  ) {
    return null;
  }

  const image = normalizeImage(value.image);
  if (value.image !== null && image === null) return null;

  return {
    name: value.name,
    height: value.height,
    length: value.length,
    description: value.description,
    image,
  };
}

function normalizeImage(value: unknown): RegistrationImage | null {
  if (value === null) return null;
  if (!isRecord(value)) return null;
  if (typeof value.imageId !== 'string' || typeof value.localUri !== 'string') {
    return null;
  }

  return {
    imageId: value.imageId,
    localUri: value.localUri,
    mimeType: nullableStringOrNull(value.mimeType),
    fileName: nullableStringOrNull(value.fileName),
    fileSize: nullableNumberOrNull(value.fileSize),
    width: nullableNumberOrNull(value.width),
    height: nullableNumberOrNull(value.height),
    // Base64 is accepted for compatibility with image pickers but is not
    // generated by this state layer. Submission should stage a durable copy.
    base64:
      typeof value.remoteKey === 'string' && value.remoteKey
        ? null
        : nullableStringOrNull(value.base64),
    remoteKey: nullableStringOrNull(value.remoteKey),
  };
}

function normalizeError(value: unknown): RegistrationError | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.code !== 'string' ||
    typeof value.message !== 'string' ||
    typeof value.retryable !== 'boolean'
  ) {
    return null;
  }

  return {
    code: value.code,
    message: value.message,
    retryable: value.retryable,
  };
}

function normalizeAnchor(value: unknown): AnchorPosition | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const longitude = value[0];
  const latitude = value[1];
  if (
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude)
  ) {
    return null;
  }

  return [longitude, latitude];
}

function isRegistrationStage(value: unknown): value is RegistrationStage {
  return (
    value === 'place-a' ||
    value === 'place-b' ||
    value === 'review' ||
    value === 'adjust'
  );
}

function isAdjustingAnchor(value: unknown): value is 'a' | 'b' {
  return value === 'a' || value === 'b';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function nullableStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function nullableNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : 0;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stripStagedImageBytes(
  state: HighlineRegistrationState,
): HighlineRegistrationState {
  const activeDraft = state.activeDraft
    ? {
        ...state.activeDraft,
        form: {
          ...state.activeDraft.form,
          image: stripStagedImage(state.activeDraft.form.image),
        },
      }
    : null;
  const submissions = state.submissions.map((submission) => ({
    ...submission,
    form: {
      ...submission.form,
      image: stripStagedImage(submission.form.image),
    },
  }));

  return { ...state, activeDraft, submissions };
}

function stripStagedImage(
  image: RegistrationImage | null,
): RegistrationImage | null {
  if (!image || !image.remoteKey || image.base64 === null) return image;
  return { ...image, base64: null };
}
