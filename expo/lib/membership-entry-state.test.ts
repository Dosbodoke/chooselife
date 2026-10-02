import { resolveMembershipEntryState } from './membership-entry-state';

const pending = { status: 'pending' as const, data: undefined };

describe('association entry state', () => {
  it('offers joining to signed-out visitors without waiting for private reads', () => {
    expect(
      resolveMembershipEntryState({
        isSignedIn: false,
        membership: pending,
        application: pending,
      }),
    ).toBe('join');
  });

  it('offers joining to a signed-in person without membership or an open application', () => {
    expect(
      resolveMembershipEntryState({
        isSignedIn: true,
        membership: { status: 'success', data: false },
        application: { status: 'success', data: null },
      }),
    ).toBe('join');
  });

  it('opens contributions for an active member without waiting for an application', () => {
    expect(
      resolveMembershipEntryState({
        isSignedIn: true,
        membership: { status: 'success', data: true },
        application: pending,
      }),
    ).toBe('contributions');
  });

  it('opens contributions for a submitted applicant', () => {
    expect(
      resolveMembershipEntryState({
        isSignedIn: true,
        membership: { status: 'success', data: false },
        application: { status: 'success', data: 'submitted' },
      }),
    ).toBe('contributions');
  });

  it('offers to resume a draft instead of showing billing', () => {
    expect(
      resolveMembershipEntryState({
        isSignedIn: true,
        membership: { status: 'success', data: false },
        application: { status: 'success', data: 'draft' },
      }),
    ).toBe('resume_draft');
  });

  it('waits for a membership read before choosing an entry', () => {
    expect(
      resolveMembershipEntryState({
        isSignedIn: true,
        membership: pending,
        application: pending,
      }),
    ).toBe('loading');
  });

  it('waits for an open-application read for a confirmed nonmember', () => {
    expect(
      resolveMembershipEntryState({
        isSignedIn: true,
        membership: { status: 'success', data: false },
        application: pending,
      }),
    ).toBe('loading');
  });

  it('keeps membership read failures out of the join flow', () => {
    expect(
      resolveMembershipEntryState({
        isSignedIn: true,
        membership: { status: 'error', data: undefined },
        application: pending,
      }),
    ).toBe('error');
  });

  it('keeps application read failures out of the join flow', () => {
    expect(
      resolveMembershipEntryState({
        isSignedIn: true,
        membership: { status: 'success', data: false },
        application: { status: 'error', data: undefined },
      }),
    ).toBe('error');
  });

  it('rejects an unexpected closed application returned as open', () => {
    expect(
      resolveMembershipEntryState({
        isSignedIn: true,
        membership: { status: 'success', data: false },
        application: { status: 'success', data: 'refused' },
      }),
    ).toBe('error');
  });
});
