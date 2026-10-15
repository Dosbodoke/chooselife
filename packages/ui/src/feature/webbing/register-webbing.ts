import { z } from 'zod';

import {
  webbingCatalogSnapshotSchema,
  type WebbingCatalogSnapshot,
} from './catalog-snapshot';
import { STRENGTH_CLASS_OPTIONS, type TStrengthClass } from './types';

// ============================================================================
// Payload
// ============================================================================

export interface WebbingRegistrationInput {
  /** One key per registration draft; reused for every retry of that draft. */
  registrationKey: string | null;
  length: string | number;
  leftLoop: boolean;
  rightLoop: boolean;
  tagName: string;
  note: string;
  strengthClass: TStrengthClass | null | undefined;
  legacyModelId: number | string | null | undefined;
  catalogSnapshot: WebbingCatalogSnapshot | null | undefined;
}

export interface WebbingRegistrationRow {
  user_id: string;
  registration_key: string | null;
  length: number;
  left_loop: boolean;
  right_loop: boolean;
  tag_name: string;
  description: string;
  strength_class: TStrengthClass | null;
  model: number | null;
  catalog_snapshot: WebbingCatalogSnapshot | null;
}

export interface RegisteredWebbing {
  id: number;
  user_id: string;
  image_path: string | null;
  registration_key: string | null;
}

export type WebbingRegistrationErrorCode =
  | 'invalid'
  | 'draft-conflict'
  | 'unconfirmed'
  | 'lookup-failed';

export class WebbingRegistrationError extends Error {
  constructor(
    readonly code: WebbingRegistrationErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'WebbingRegistrationError';
  }
}

/** Number() plus finite/positive checks; "20abc" and "" are rejected. */
export function parseWebbingLength(value: string | number): number | null {
  if (typeof value === 'string' && value.trim() === '') return null;
  const length = typeof value === 'number' ? value : Number(value.trim());
  return Number.isFinite(length) && length > 0 ? length : null;
}

const registrationKeySchema = z.string().uuid();

/** Validate a draft and build the canonical insert row. Throws `invalid`. */
export function buildWebbingRegistrationRow(
  userId: string,
  input: WebbingRegistrationInput,
): WebbingRegistrationRow {
  const invalid = (message: string) =>
    new WebbingRegistrationError('invalid', message);

  const length = parseWebbingLength(input.length);
  if (length === null) throw invalid('Length must be a positive number');

  const tagName = input.tagName.trim();
  if (!tagName) throw invalid('Tag name is required');

  if (
    input.registrationKey !== null &&
    !registrationKeySchema.safeParse(input.registrationKey).success
  ) {
    throw invalid('Invalid registration key');
  }

  let model: number | null = null;
  if (
    input.legacyModelId !== null &&
    input.legacyModelId !== undefined &&
    input.legacyModelId !== ''
  ) {
    model = Number(input.legacyModelId);
    if (!Number.isSafeInteger(model) || model <= 0) {
      throw invalid('Invalid model');
    }
  }

  let catalogSnapshot: WebbingCatalogSnapshot | null = null;
  if (input.catalogSnapshot) {
    const parsed = webbingCatalogSnapshotSchema.safeParse(input.catalogSnapshot);
    if (!parsed.success) throw invalid('Invalid catalog selection');
    catalogSnapshot = parsed.data;
  }
  if (model !== null && catalogSnapshot !== null) {
    throw invalid('Choose either a catalog model or a previous model, not both');
  }

  const strengthClass = input.strengthClass ?? null;
  if (strengthClass !== null && !STRENGTH_CLASS_OPTIONS.includes(strengthClass)) {
    throw invalid('Invalid strength class');
  }

  return {
    user_id: userId,
    registration_key: input.registrationKey,
    length,
    left_loop: input.leftLoop,
    right_loop: input.rightLoop,
    tag_name: tagName,
    description: input.note,
    strength_class: strengthClass,
    model,
    catalog_snapshot: catalogSnapshot,
  };
}

// ============================================================================
// Idempotent create-or-recover
// ============================================================================

export const WEBBING_REGISTRATION_KEY_INDEX = 'webbing_user_id_registration_key_idx';

/** Columns read back to recover and compare a registration. */
export const WEBBING_REGISTRATION_SELECT =
  'id, user_id, image_path, registration_key, length, left_loop, right_loop, tag_name, description, strength_class, model, catalog_snapshot';

export type StoredWebbingRegistration = RegisteredWebbing &
  Omit<WebbingRegistrationRow, 'catalog_snapshot' | 'strength_class'> & {
    catalog_snapshot: unknown;
    strength_class: string | null;
    tag_name: string | null;
    description: string | null;
  };

export interface RepositoryError {
  code?: string | null;
  message: string;
}

export interface WebbingRegistrationRepository {
  /** Must throw (or reject) when the lookup itself fails. */
  findByRegistrationKey(
    userId: string,
    registrationKey: string,
  ): Promise<StoredWebbingRegistration | null>;
  /** Returns Supabase-style `{ data, error }`; may also throw on transport. */
  insert(
    row: WebbingRegistrationRow,
  ): Promise<{ data: RegisteredWebbing | null; error: RepositoryError | null }>;
}

/** A Postgres/PostgREST code proves the server answered and rejected it. */
function isDefinitiveError(error: RepositoryError) {
  return !!error.code && /^([0-9A-Z]{5}|PGRST\d+)$/.test(error.code);
}

function isRegistrationKeyConflict(error: RepositoryError) {
  return error.code === '23505' && error.message.includes(WEBBING_REGISTRATION_KEY_INDEX);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Compare everything the draft wrote, excluding photo fields. */
function canonicalRegistration(row: {
  user_id: string;
  registration_key: string | null;
  length: number | string;
  left_loop: boolean;
  right_loop: boolean;
  tag_name: string | null;
  description: string | null;
  strength_class: string | null;
  model: number | null;
  catalog_snapshot: unknown;
}) {
  return stableStringify({
    user_id: row.user_id,
    registration_key: row.registration_key,
    length: Number(row.length),
    left_loop: row.left_loop,
    right_loop: row.right_loop,
    tag_name: row.tag_name ?? '',
    description: row.description ?? '',
    strength_class: row.strength_class ?? null,
    model: row.model ?? null,
    catalog_snapshot: row.catalog_snapshot ?? null,
  });
}

function toRegistered(row: StoredWebbingRegistration): RegisteredWebbing {
  return {
    id: row.id,
    user_id: row.user_id,
    image_path: row.image_path,
    registration_key: row.registration_key,
  };
}

export interface RegisterWebbingResult {
  webbing: RegisteredWebbing;
  /** True when an earlier attempt of this draft had already saved the row. */
  recovered: boolean;
}

/**
 * Create one physical webbing for a draft, or recover the row an earlier
 * attempt of the same draft saved. Never overwrites a recovered row.
 *
 * Every attempt starts with a lookup, so after an unconfirmed result the
 * next attempt reconciles before it can insert again.
 */
export async function registerWebbing({
  userId,
  input,
  repository,
}: {
  userId: string;
  input: WebbingRegistrationInput;
  repository: WebbingRegistrationRepository;
}): Promise<RegisterWebbingResult> {
  const row = buildWebbingRegistrationRow(userId, input);
  const key = row.registration_key;
  const expected = canonicalRegistration(row);

  const recover = (stored: StoredWebbingRegistration): RegisterWebbingResult => {
    if (canonicalRegistration(stored) !== expected) {
      throw new WebbingRegistrationError(
        'draft-conflict',
        'This registration was already saved with different details',
      );
    }
    return { webbing: toRegistered(stored), recovered: true };
  };

  if (key) {
    let existing: StoredWebbingRegistration | null;
    try {
      existing = await repository.findByRegistrationKey(userId, key);
    } catch (cause) {
      throw new WebbingRegistrationError(
        'lookup-failed',
        'Could not reach Choose Life to save this webbing',
        cause,
      );
    }
    if (existing) return recover(existing);
  }

  let insertError: RepositoryError | null = null;
  let thrown: unknown;
  try {
    const { data, error } = await repository.insert(row);
    if (data && !error) return { webbing: data, recovered: false };
    insertError = error ?? { message: 'No row returned' };
  } catch (cause) {
    thrown = cause;
  }

  const conflict = insertError ? isRegistrationKeyConflict(insertError) : false;
  const ambiguous = thrown !== undefined || (insertError && !isDefinitiveError(insertError));

  if (!key || (!conflict && !ambiguous)) {
    if (thrown !== undefined) throw thrown;
    throw Object.assign(new Error(insertError!.message), {
      code: insertError!.code,
    });
  }

  let stored: StoredWebbingRegistration | null;
  try {
    stored = await repository.findByRegistrationKey(userId, key);
  } catch (cause) {
    throw new WebbingRegistrationError(
      'unconfirmed',
      'We could not confirm whether this webbing was saved',
      cause,
    );
  }
  if (stored) return recover(stored);
  if (conflict) {
    throw new WebbingRegistrationError(
      'unconfirmed',
      'We could not confirm whether this webbing was saved',
    );
  }
  // The lookup proves the ambiguous insert did not commit; safe to retry.
  if (thrown !== undefined) throw thrown;
  throw new Error(insertError!.message);
}
