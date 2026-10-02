import { supabase } from '~/lib/supabase';

import type { SerializedSubmissionVariables } from './submission';
import { submitHighlineRegistrationOnline } from './submission-runtime';

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: { fs: {} },
}));

jest.mock('~/lib/r2', () => ({
  deleteFromR2: jest.fn(),
  uploadToR2: jest.fn(),
}));

jest.mock('~/lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

const variables: SerializedSubmissionVariables = {
  submissionId: 'submission-1',
  sourceDraftId: 'draft-1',
  ownerId: 'user-1',
  highlineId: 'highline-1',
  imageId: null,
  anchorA: [-47.93, -15.77],
  anchorB: [-47.92, -15.78],
  form: {
    name: 'Pedra Alta',
    height: 20,
    length: 143,
    description: '',
    image: null,
  },
};

describe('online highline submission owner guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not transmit a hydrated submission under another account', async () => {
    const getSession = supabase.auth.getSession as jest.Mock;
    getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-2' } } },
    });

    await expect(
      submitHighlineRegistrationOnline(variables),
    ).rejects.toMatchObject({
      code: 'AUTH_OWNER_MISMATCH',
      retryable: false,
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('defers transmission when authentication has not hydrated yet', async () => {
    const getSession = supabase.auth.getSession as jest.Mock;
    getSession.mockResolvedValue({ data: { session: null } });

    await expect(
      submitHighlineRegistrationOnline(variables),
    ).rejects.toMatchObject({
      code: 'AUTH_SESSION_UNAVAILABLE',
      retryable: true,
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
