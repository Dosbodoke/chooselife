import {
  clearRegistrationState,
  createRegistrationStorageKey,
  loadRegistrationState,
  saveRegistrationState,
} from './persistence';
import { createEmptyRegistrationState } from './reducer';

type MemoryStorage = {
  getItem: jest.Mock<Promise<string | null>, [string]>;
  setItem: jest.Mock<Promise<void>, [string, string]>;
  removeItem: jest.Mock<Promise<void>, [string]>;
};

function createMemoryStorage(): MemoryStorage {
  return {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  };
}

describe('highline registration persistence', () => {
  const ownerId = 'user/with spaces';

  it('uses a versioned, user-scoped key', () => {
    expect(createRegistrationStorageKey(ownerId)).toBe(
      'highline-registration:v1:user%2Fwith%20spaces',
    );
  });

  it('round-trips a serializable state through the injected storage', async () => {
    const storage = createMemoryStorage();
    const state = createEmptyRegistrationState('user-1');
    storage.getItem.mockResolvedValue(JSON.stringify(state));

    await saveRegistrationState('user-1', state, storage);
    const loaded = await loadRegistrationState('user-1', storage);

    expect(storage.setItem).toHaveBeenCalledWith(
      createRegistrationStorageKey('user-1'),
      JSON.stringify(state),
    );
    expect(loaded).toEqual(state);
  });

  it('falls back to an empty state for missing, malformed, or foreign data', async () => {
    const storage = createMemoryStorage();
    storage.getItem.mockResolvedValueOnce(null);
    expect(await loadRegistrationState('user-1', storage)).toEqual(
      createEmptyRegistrationState('user-1'),
    );

    storage.getItem.mockResolvedValueOnce('{not-json');
    expect(await loadRegistrationState('user-1', storage)).toEqual(
      createEmptyRegistrationState('user-1'),
    );

    storage.getItem.mockResolvedValueOnce(
      JSON.stringify({
        version: 1,
        ownerId: 'another-user',
        activeDraft: null,
        submissions: [],
      }),
    );
    expect(await loadRegistrationState('user-1', storage)).toEqual(
      createEmptyRegistrationState('user-1'),
    );
  });

  it('drops invalid queued entries but keeps valid draft data', async () => {
    const storage = createMemoryStorage();
    const draft = createEmptyRegistrationState('user-1');
    const form = {
      name: '',
      height: null,
      length: null,
      description: '',
      image: null,
    };
    draft.activeDraft = {
      draftId: 'draft-1',
      ownerId: 'user-1',
      status: 'draft',
      stage: 'place-a',
      adjustingAnchor: null,
      anchorA: null,
      anchorB: null,
      form,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      exitedAt: null,
    };
    storage.getItem.mockResolvedValue(
      JSON.stringify({
        ...draft,
        submissions: [
          { submissionId: 'broken', status: 'pending' },
          {
            submissionId: 'valid',
            sourceDraftId: 'draft-2',
            ownerId: 'user-1',
            status: 'pending',
            anchorA: [-47.93, -15.77],
            anchorB: [-47.92, -15.78],
            form,
            highlineId: null,
            imageId: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            submittedAt: null,
            attemptCount: 0,
            lastAttemptAt: null,
            nextAttemptAt: null,
            lastError: null,
          },
        ],
      }),
    );

    const loaded = await loadRegistrationState('user-1', storage);
    expect(loaded.activeDraft).toEqual(draft.activeDraft);
    expect(loaded.submissions).toHaveLength(1);
    expect(loaded.submissions[0].submissionId).toBe('valid');
  });

  it('clears only the current user key', async () => {
    const storage = createMemoryStorage();

    await clearRegistrationState('user-1', storage);

    expect(storage.removeItem).toHaveBeenCalledWith(
      createRegistrationStorageKey('user-1'),
    );
  });

  it('does not persist picker bytes after an image has a durable remote key', async () => {
    const storage = createMemoryStorage();
    const state = createEmptyRegistrationState('user-1');
    state.activeDraft = {
      draftId: 'draft-1',
      ownerId: 'user-1',
      status: 'draft',
      stage: 'place-a',
      adjustingAnchor: null,
      anchorA: null,
      anchorB: null,
      form: {
        name: '',
        height: null,
        length: null,
        description: '',
        image: {
          imageId: 'image-1',
          localUri: 'file:///image-1.jpg',
          mimeType: 'image/jpeg',
          fileName: 'image.jpg',
          fileSize: 10,
          width: 10,
          height: 10,
          base64: 'picker-bytes',
          remoteKey: 'image-1.jpg',
        },
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      exitedAt: null,
    };

    await saveRegistrationState('user-1', state, storage);

    const serialized = storage.setItem.mock.calls[0][1];
    expect(serialized).not.toContain('picker-bytes');
    expect(JSON.parse(serialized).activeDraft.form.image.base64).toBeNull();
  });
});
