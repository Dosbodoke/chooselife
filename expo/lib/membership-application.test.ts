import { supabase } from '~/lib/supabase';

import {
  fetchMembershipApplication,
  upsertMembershipApplicationDraft,
} from './membership-application';

jest.mock('~/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

type Call = { method: string; args: unknown[] };

/**
 * Records the postgrest chain a helper builds and resolves it with the next
 * queued result. The recorded calls are the assertion surface: the bug this
 * covers was a wrong `onConflict` arbiter and an unfiltered read, both of which
 * are only visible in the chain the helper emits.
 */
function mockQueryBuilder(results: { data: unknown; error: unknown }[]) {
  const calls: Call[] = [];
  let resultIndex = 0;

  const builder: Record<string, unknown> = {};
  const record = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return builder;
  };

  for (const method of [
    'select',
    'eq',
    'in',
    'order',
    'limit',
    'update',
    'insert',
    'upsert',
  ]) {
    builder[method] = record(method);
  }

  const terminal = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    const result = results[resultIndex] ?? { data: null, error: null };
    resultIndex += 1;
    return Promise.resolve(result);
  };

  builder.maybeSingle = terminal('maybeSingle');
  builder.single = terminal('single');

  jest.mocked(supabase.from).mockImplementation(((table: string) => {
    calls.push({ method: 'from', args: [table] });
    return builder;
  }) as never);

  return calls;
}

const findCall = (calls: Call[], method: string) =>
  calls.filter((call) => call.method === method);

describe('reading the open association application', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads only the open application, so refused history cannot break it', async () => {
    const calls = mockQueryBuilder([
      { data: { id: 'application-1', status: 'submitted' }, error: null },
    ]);

    await expect(
      fetchMembershipApplication('org-1', 'user-1'),
    ).resolves.toEqual({ id: 'application-1', status: 'submitted' });

    expect(findCall(calls, 'in')).toEqual([
      { method: 'in', args: ['status', ['draft', 'submitted']] },
    ]);
    expect(findCall(calls, 'limit')).toEqual([
      { method: 'limit', args: [1] },
    ]);
    expect(findCall(calls, 'order')).toEqual([
      { method: 'order', args: ['created_at', { ascending: false }] },
    ]);
  });

  it('returns null when the person holds no open application', async () => {
    mockQueryBuilder([{ data: null, error: null }]);

    await expect(
      fetchMembershipApplication('org-1', 'user-1'),
    ).resolves.toBeNull();
  });

  it('surfaces a read failure instead of swallowing it', async () => {
    mockQueryBuilder([{ data: null, error: { message: 'boom' } }]);

    await expect(
      fetchMembershipApplication('org-1', 'user-1'),
    ).rejects.toEqual({ message: 'boom' });
  });
});

describe('saving an association application draft', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const draft = {
    full_name: 'Ana',
    organization_id: 'org-1',
    user_id: 'user-1',
  };

  it('never arbitrates on the retired (organization_id, user_id) constraint', async () => {
    const calls = mockQueryBuilder([
      { data: null, error: null },
      { data: { id: 'application-new', status: 'draft' }, error: null },
    ]);

    await upsertMembershipApplicationDraft(draft);

    expect(findCall(calls, 'upsert')).toEqual([]);
    expect(
      calls.some((call) =>
        JSON.stringify(call.args).includes('organization_id,user_id'),
      ),
    ).toBe(false);
  });

  it('inserts a new draft when the person has no open draft', async () => {
    const calls = mockQueryBuilder([
      { data: null, error: null },
      { data: { id: 'application-new', status: 'draft' }, error: null },
    ]);

    await expect(upsertMembershipApplicationDraft(draft)).resolves.toEqual({
      id: 'application-new',
      status: 'draft',
    });

    expect(findCall(calls, 'insert')).toEqual([
      { method: 'insert', args: [{ ...draft, status: 'draft' }] },
    ]);
    expect(findCall(calls, 'update')).toEqual([]);
  });

  it('updates the existing draft in place, addressed by its own id', async () => {
    const calls = mockQueryBuilder([
      { data: { id: 'application-existing' }, error: null },
      { data: { id: 'application-existing', status: 'draft' }, error: null },
    ]);

    await expect(upsertMembershipApplicationDraft(draft)).resolves.toEqual({
      id: 'application-existing',
      status: 'draft',
    });

    expect(findCall(calls, 'update')).toEqual([
      { method: 'update', args: [{ ...draft, status: 'draft' }] },
    ]);
    expect(findCall(calls, 'insert')).toEqual([]);
    expect(findCall(calls, 'eq')).toContainEqual({
      method: 'eq',
      args: ['id', 'application-existing'],
    });
  });

  it('looks for the existing row among drafts only', async () => {
    const calls = mockQueryBuilder([
      { data: null, error: null },
      { data: { id: 'application-new' }, error: null },
    ]);

    await upsertMembershipApplicationDraft(draft);

    expect(findCall(calls, 'eq')).toContainEqual({
      method: 'eq',
      args: ['status', 'draft'],
    });
  });

  it('refuses to write a draft with no subject', async () => {
    const calls = mockQueryBuilder([]);

    await expect(
      upsertMembershipApplicationDraft({
        ...draft,
        user_id: null,
      }),
    ).rejects.toThrow(/organization and a subject/);

    expect(calls).toEqual([]);
  });
});
