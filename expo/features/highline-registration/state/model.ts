export const HIGHLINE_REGISTRATION_STATE_VERSION = 1 as const;

/** A GeoJSON/Mapbox position: longitude first, latitude second. */
export type AnchorPosition = [longitude: number, latitude: number];

export type RegistrationStatus = 'draft' | 'pending' | 'needs-attention';
export type QueuedSubmissionStatus = Exclude<
  RegistrationStatus,
  'draft'
>;
export type RegistrationStage =
  | 'place-a'
  | 'place-b'
  | 'review'
  | 'adjust';
export type AdjustingAnchor = 'a' | 'b';

/**
 * All image fields are JSON-safe. `localUri` may point at an app-managed
 * durable copy; `base64` is retained for pickers that provide it directly.
 */
export type RegistrationImage = {
  imageId: string;
  localUri: string;
  mimeType: string | null;
  fileName: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  base64: string | null;
  remoteKey: string | null;
};

export type RegistrationForm = {
  name: string;
  height: number | null;
  length: number | null;
  description: string;
  image: RegistrationImage | null;
};

export type RegistrationError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type RegistrationDraft = {
  draftId: string;
  ownerId: string;
  status: 'draft';
  stage: RegistrationStage;
  adjustingAnchor: AdjustingAnchor | null;
  anchorA: AnchorPosition | null;
  anchorB: AnchorPosition | null;
  form: RegistrationForm;
  createdAt: string;
  updatedAt: string;
  exitedAt: string | null;
};

export type QueuedHighlineSubmission = {
  submissionId: string;
  sourceDraftId: string;
  ownerId: string;
  status: QueuedSubmissionStatus;
  anchorA: AnchorPosition;
  anchorB: AnchorPosition;
  form: RegistrationForm;
  /** Stable identifiers let a replay reuse a created row or uploaded image. */
  highlineId: string | null;
  imageId: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  attemptCount: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  lastError: RegistrationError | null;
};

export type HighlineRegistrationState = {
  version: typeof HIGHLINE_REGISTRATION_STATE_VERSION;
  ownerId: string;
  activeDraft: RegistrationDraft | null;
  submissions: QueuedHighlineSubmission[];
};

export type RegistrationClockOptions = {
  now?: string;
};

export type CreateDraftOptions = RegistrationClockOptions & {
  draftId?: string;
  form?: Partial<RegistrationForm>;
};

export function createEmptyRegistrationForm(): RegistrationForm {
  return {
    name: '',
    height: null,
    length: null,
    description: '',
    image: null,
  };
}

export function cloneRegistrationImage(
  image: RegistrationImage | null,
): RegistrationImage | null {
  if (!image) return null;
  return { ...image };
}

/** Remove transient picker bytes after a durable file/object has been staged. */
export function withoutRegistrationImageBase64(
  image: RegistrationImage | null,
): RegistrationImage | null {
  if (!image) return null;
  return { ...image, base64: null };
}

export function cloneRegistrationForm(form: RegistrationForm): RegistrationForm {
  return {
    ...form,
    image: cloneRegistrationImage(form.image),
  };
}

export function createRegistrationDraft(
  ownerId: string,
  options: CreateDraftOptions = {},
): RegistrationDraft {
  const now = options.now ?? new Date().toISOString();
  const defaults = createEmptyRegistrationForm();

  return {
    draftId: options.draftId ?? createRegistrationId('draft'),
    ownerId,
    status: 'draft',
    stage: 'place-a',
    adjustingAnchor: null,
    anchorA: null,
    anchorB: null,
    form: {
      ...defaults,
      ...options.form,
      image: cloneRegistrationImage(options.form?.image ?? null),
    },
    createdAt: now,
    updatedAt: now,
    exitedAt: null,
  };
}

export function createRegistrationId(prefix: string): string {
  const cryptoApi = (globalThis as {
    crypto?: { randomUUID?: () => string };
  }).crypto;
  const randomUuid = cryptoApi?.randomUUID?.();
  if (randomUuid) return `${prefix}-${randomUuid}`;

  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/** Stable database identifier. Unlike draft IDs, this must remain a raw UUID. */
export function createHighlineId(): string {
  const cryptoApi = (globalThis as {
    crypto?: {
      randomUUID?: () => string;
      getRandomValues?: (values: Uint8Array) => Uint8Array;
    };
  }).crypto;
  const nativeUuid = cryptoApi?.randomUUID?.();
  if (nativeUuid) return nativeUuid;

  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, '0'),
  );

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

export function createEmptyRegistrationState(
  ownerId: string,
): HighlineRegistrationState {
  return {
    version: HIGHLINE_REGISTRATION_STATE_VERSION,
    ownerId,
    activeDraft: null,
    submissions: [],
  };
}

export function cloneAnchorPosition(
  position: AnchorPosition | null,
): AnchorPosition | null {
  return position ? [position[0], position[1]] : null;
}

export function isAnchorPosition(value: unknown): value is AnchorPosition {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    Number.isFinite(value[0]) &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[1])
  );
}

export function cloneDraft(draft: RegistrationDraft): RegistrationDraft {
  return {
    ...draft,
    anchorA: cloneAnchorPosition(draft.anchorA),
    anchorB: cloneAnchorPosition(draft.anchorB),
    form: cloneRegistrationForm(draft.form),
  };
}

export function cloneSubmission(
  submission: QueuedHighlineSubmission,
): QueuedHighlineSubmission {
  return {
    ...submission,
    anchorA: [...submission.anchorA],
    anchorB: [...submission.anchorB],
    form: cloneRegistrationForm(submission.form),
    lastError: submission.lastError ? { ...submission.lastError } : null,
  };
}
