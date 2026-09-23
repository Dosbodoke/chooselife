import type { MembershipApplication } from './membership-application';

type QuerySnapshot<T> = {
  status: 'pending' | 'error' | 'success';
  data: T | undefined;
};

export type MembershipEntryState =
  | 'loading'
  | 'error'
  | 'join'
  | 'resume_draft'
  | 'contributions';

export function resolveMembershipEntryState({
  isSignedIn,
  membership,
  application,
}: {
  isSignedIn: boolean;
  membership: QuerySnapshot<boolean>;
  application: QuerySnapshot<MembershipApplication['status'] | null>;
}): MembershipEntryState {
  if (!isSignedIn) return 'join';

  if (membership.status === 'error') return 'error';
  if (membership.status !== 'success') return 'loading';
  if (membership.data === true) return 'contributions';
  if (membership.data !== false) return 'error';

  if (application.status === 'error') return 'error';
  if (application.status !== 'success') return 'loading';

  switch (application.data) {
    case 'submitted':
      return 'contributions';
    case 'draft':
      return 'resume_draft';
    case null:
      return 'join';
    default:
      return 'error';
  }
}
