import { CourseAccessError } from './access';

export type CourseGuideViewState =
  | { kind: 'loading' }
  | { kind: 'sign-in' }
  | { kind: 'offline' }
  | { kind: 'locked' }
  | { kind: 'error' }
  | { kind: 'reader'; pdfUrl: string };

type ResolveCourseGuideStateInput = {
  accessError: unknown;
  isAccessPending: boolean;
  isOnline: boolean;
  pdfUrl?: string;
  sessionLoading: boolean;
  signedIn: boolean;
};

export function resolveCourseGuideState({
  accessError,
  isAccessPending,
  isOnline,
  pdfUrl,
  sessionLoading,
  signedIn,
}: ResolveCourseGuideStateInput): CourseGuideViewState {
  if (sessionLoading) return { kind: 'loading' };
  if (!signedIn) return { kind: 'sign-in' };
  if (!isOnline) return { kind: 'offline' };
  if (isAccessPending) return { kind: 'loading' };

  if (accessError instanceof CourseAccessError && accessError.status === 403) {
    return { kind: 'locked' };
  }

  if (accessError || !pdfUrl) return { kind: 'error' };

  return { kind: 'reader', pdfUrl };
}
