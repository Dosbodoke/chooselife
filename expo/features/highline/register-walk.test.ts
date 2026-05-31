import { supabase } from '~/lib/supabase';

import {
  registerHighlineWalk,
  type RegisterHighlineWalkVariables,
} from './register-walk';

const variables: RegisterHighlineWalkVariables = {
  entryId: '8d537d30-44e6-42f6-bdea-ffcc0e1b6c24',
  highlineId: '4886dcb5-18c3-4c3e-8374-101cb2e27f78',
  formData: {
    username: ' @highliner ',
    cadenas: 1,
    full_lines: 2,
    distance: 300,
    time: '1:30',
    witness: ['@witness'],
    comment: 'Nice line',
  },
};

describe('registerHighlineWalk', () => {
  const insert = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.from as jest.Mock).mockReturnValue({ insert });
  });

  it('uses the durable entry id when inserting a queued walk', async () => {
    insert.mockResolvedValue({ data: null, error: null });

    await expect(registerHighlineWalk(variables)).resolves.toBeNull();
    expect(insert).toHaveBeenCalledWith({
      id: variables.entryId,
      highline_id: variables.highlineId,
      instagram: '@highliner',
      cadenas: 1,
      full_lines: 2,
      distance_walked: 300,
      crossing_time: 90,
      comment: 'Nice line',
      witness: ['@witness'],
      is_highliner: true,
    });
  });

  it('treats a duplicate durable entry id as a successful replay', async () => {
    insert.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });

    await expect(registerHighlineWalk(variables)).resolves.toBeNull();
  });

  it('propagates other insert failures so React Query can retry', async () => {
    insert.mockResolvedValue({
      data: null,
      error: { code: '50000', message: 'database unavailable' },
    });

    await expect(registerHighlineWalk(variables)).rejects.toThrow(
      'database unavailable',
    );
  });
});
