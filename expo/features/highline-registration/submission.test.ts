import type { QueuedHighlineSubmission, RegistrationImage } from './state';
import {
  buildHighlineInsert,
  classifySubmissionError,
  createSubmissionIdentifiers,
  isTerminalSubmissionFailure,
  serializeSubmissionVariables,
  submitHighlineRegistration,
  validateSubmissionOwner,
  type SubmissionDependencies,
} from './submission';

const image: RegistrationImage = {
  imageId: 'image-1.jpg',
  localUri: 'file:///private/image-1.jpg',
  mimeType: 'image/jpeg',
  fileName: 'image.jpg',
  fileSize: 42,
  width: 1600,
  height: 900,
  base64: 'must-not-be-replayed',
  remoteKey: null,
};

function createSubmission(
  overrides: Partial<QueuedHighlineSubmission> = {},
): QueuedHighlineSubmission {
  return {
    submissionId: 'submission-1',
    sourceDraftId: 'draft-1',
    ownerId: 'user-1',
    status: 'pending',
    anchorA: [-47.93, -15.77],
    anchorB: [-47.92, -15.78],
    form: {
      name: 'Pedra Alta',
      height: 20,
      length: 143,
      description: 'A long line',
      image,
    },
    highlineId: null,
    imageId: null,
    createdAt: '2026-09-30T00:00:00.000Z',
    updatedAt: '2026-09-30T00:00:00.000Z',
    submittedAt: null,
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: null,
    lastError: null,
    ...overrides,
  };
}

describe('highline registration submission', () => {
  it('allocates a database-compatible UUID when no identifier exists yet', () => {
    const identifiers = createSubmissionIdentifiers(createSubmission());

    expect(identifiers.highlineId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('allocates stable identifiers once and preserves them for retries', () => {
    const first = createSubmissionIdentifiers(createSubmission(), {
      highlineId: 'highline-1',
      imageId: 'image-1.jpg',
    });
    const retry = createSubmissionIdentifiers(
      createSubmission({
        highlineId: first.highlineId,
        imageId: first.imageId,
      }),
      { highlineId: 'should-not-be-used', imageId: 'should-not-be-used.jpg' },
    );

    expect(first).toEqual({
      highlineId: 'highline-1',
      imageId: 'image-1.jpg',
    });
    expect(retry).toEqual(first);
  });

  it('serializes a submission without picker-only base64 data or undefined fields', () => {
    const serialized = serializeSubmissionVariables(
      createSubmission({ highlineId: 'highline-1', imageId: 'image-1.jpg' }),
    );

    expect(serialized).toEqual({
      submissionId: 'submission-1',
      sourceDraftId: 'draft-1',
      ownerId: 'user-1',
      highlineId: 'highline-1',
      imageId: 'image-1.jpg',
      anchorA: [-47.93, -15.77],
      anchorB: [-47.92, -15.78],
      form: {
        name: 'Pedra Alta',
        height: 20,
        length: 143,
        description: 'A long line',
        image: {
          ...image,
          base64: null,
          remoteKey: 'image-1.jpg',
        },
      },
    });
    expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
  });

  it('builds a plain insert addressed by the stable highline id', () => {
    expect(
      buildHighlineInsert(
        createSubmission({ highlineId: 'highline-1', imageId: 'image-1.jpg' }),
      ),
    ).toEqual({
      id: 'highline-1',
      name: 'Pedra Alta',
      height: 20,
      length: 143,
      description: 'A long line',
      cover_image: 'image-1.jpg',
      anchor_a: 'POINT(-47.93 -15.77)',
      anchor_b: 'POINT(-47.92 -15.78)',
    });
  });

  it('treats a duplicate stable id as a successful replay', async () => {
    const calls: string[] = [];
    const deps: SubmissionDependencies = {
      uploadImage: async () => {
        calls.push('upload');
        return 'image-1.jpg';
      },
      readImage: async () => new Uint8Array([1, 2, 3]),
      insertHighline: async () => {
        calls.push('insert');
        return {
          data: null,
          error: { code: '23505', message: 'already exists' },
        };
      },
    };

    await expect(
      submitHighlineRegistration(
        createSubmission({ highlineId: 'highline-1', imageId: 'image-1.jpg' }),
        deps,
      ),
    ).resolves.toEqual({ highlineId: 'highline-1', replayed: true });
    expect(calls).toEqual(['upload', 'insert']);
  });

  it('keeps transient submit failures retryable and cleans up deterministic failures', async () => {
    const deleted: string[] = [];
    const deps: SubmissionDependencies = {
      uploadImage: async () => 'image-1.jpg',
      readImage: async () => new Uint8Array([1]),
      insertHighline: async () => ({
        data: null,
        error: { code: '23514', message: 'height violates constraint' },
      }),
      deleteImage: async (_bucket, key) => {
        deleted.push(key);
      },
    };

    await expect(
      submitHighlineRegistration(
        createSubmission({ highlineId: 'highline-1', imageId: 'image-1.jpg' }),
        deps,
      ),
    ).rejects.toMatchObject({ retryable: false, code: '23514' });
    expect(deleted).toEqual(['image-1.jpg']);
  });

  it('classifies offline and server throttling errors as retryable', () => {
    expect(
      classifySubmissionError(new TypeError('Network request failed')),
    ).toEqual(
      expect.objectContaining({ retryable: true, code: 'NETWORK_ERROR' }),
    );
    expect(
      classifySubmissionError({
        status: 503,
        message: 'temporarily unavailable',
      }),
    ).toEqual(expect.objectContaining({ retryable: true, code: 'HTTP_503' }));
    expect(
      classifySubmissionError({ status: 401, message: 'invalid token' }),
    ).toEqual(expect.objectContaining({ retryable: false, code: 'HTTP_401' }));
  });

  it('marks repeated retryable failures terminal after the retry budget', () => {
    expect(
      isTerminalSubmissionFailure(
        { status: 503, message: 'temporarily unavailable' },
        2,
      ),
    ).toBe(false);
    expect(
      isTerminalSubmissionFailure(
        { status: 503, message: 'temporarily unavailable' },
        3,
      ),
    ).toBe(true);
    expect(
      isTerminalSubmissionFailure(new TypeError('Network request failed'), 3),
    ).toBe(false);
    expect(
      isTerminalSubmissionFailure(
        { code: 'ECONNRESET', message: 'socket closed' },
        3,
      ),
    ).toBe(false);
  });

  it('rejects a hydrated submission owned by another account before transmission', () => {
    expect(validateSubmissionOwner({ ownerId: 'user-1' }, 'user-2')).toEqual({
      code: 'AUTH_OWNER_MISMATCH',
      message: 'The signed-in account does not own this saved submission.',
      retryable: false,
    });
    expect(validateSubmissionOwner({ ownerId: 'user-1' }, null)).toEqual(
      expect.objectContaining({
        code: 'AUTH_SESSION_UNAVAILABLE',
        retryable: true,
      }),
    );
  });
});
