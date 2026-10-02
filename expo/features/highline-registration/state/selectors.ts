import {
  AnchorPosition,
  HighlineRegistrationState,
  QueuedHighlineSubmission,
  RegistrationDraft,
  RegistrationStatus,
} from './model';

export type PendingMapLineProjection = {
  id: string;
  submissionId: string;
  sourceDraftId: string;
  status: Exclude<RegistrationStatus, 'draft'>;
  anchorA: AnchorPosition;
  anchorB: AnchorPosition;
  midpoint: AnchorPosition;
  lengthM: number;
  length: number;
  name: string;
  highlineId: string | null;
  imageId: string | null;
};

export type DraftMapLineProjection = {
  id: string;
  sourceDraftId: string;
  status: 'draft';
  anchorA: AnchorPosition;
  anchorB: AnchorPosition;
  midpoint: AnchorPosition;
  lengthM: number;
  length: number;
  name: string;
};

export type RegistrationMapLineProjection =
  | DraftMapLineProjection
  | PendingMapLineProjection;

export function selectActiveDraft(
  state: HighlineRegistrationState,
): RegistrationDraft | null {
  return state.activeDraft;
}

export function selectQueuedSubmissions(
  state: HighlineRegistrationState,
): QueuedHighlineSubmission[] {
  return state.submissions;
}

export function selectPendingSubmissions(
  state: HighlineRegistrationState,
): QueuedHighlineSubmission[] {
  return state.submissions.filter((submission) => submission.status === 'pending');
}

export function selectNeedsAttentionSubmissions(
  state: HighlineRegistrationState,
): QueuedHighlineSubmission[] {
  return state.submissions.filter(
    (submission) => submission.status === 'needs-attention',
  );
}

export function selectPendingMapLines(
  state: HighlineRegistrationState,
): PendingMapLineProjection[] {
  return state.submissions.map(toPendingMapLineProjection);
}

export function selectMapLineProjections(
  state: HighlineRegistrationState,
): RegistrationMapLineProjection[] {
  const activeLine = selectActiveMapLine(state);

  return [
    ...(activeLine ? [activeLine] : []),
    ...selectPendingMapLines(state),
  ];
}

export function selectActiveMapLine(
  state: HighlineRegistrationState,
): DraftMapLineProjection | null {
  return state.activeDraft ? toDraftMapLineProjection(state.activeDraft) : null;
}

function toDraftMapLineProjection(
  draft: RegistrationDraft,
): DraftMapLineProjection | null {
  if (!draft.anchorA || !draft.anchorB) return null;

  const lengthM =
    draft.form.length ?? haversineDistance(draft.anchorA, draft.anchorB);

  return {
    id: draft.draftId,
    sourceDraftId: draft.draftId,
    status: 'draft',
    anchorA: [...draft.anchorA],
    anchorB: [...draft.anchorB],
    midpoint: midpoint(draft.anchorA, draft.anchorB),
    lengthM,
    length: lengthM,
    name: draft.form.name,
  };
}

function toPendingMapLineProjection(
  submission: QueuedHighlineSubmission,
): PendingMapLineProjection {
  const lengthM =
    submission.form.length ??
    haversineDistance(submission.anchorA, submission.anchorB);

  return {
    id: submission.submissionId,
    submissionId: submission.submissionId,
    sourceDraftId: submission.sourceDraftId,
    status: submission.status,
    anchorA: [...submission.anchorA],
    anchorB: [...submission.anchorB],
    midpoint: midpoint(submission.anchorA, submission.anchorB),
    lengthM,
    length: lengthM,
    name: submission.form.name,
    highlineId: submission.highlineId,
    imageId: submission.imageId,
  };
}

function midpoint(a: AnchorPosition, b: AnchorPosition): AnchorPosition {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function haversineDistance(a: AnchorPosition, b: AnchorPosition): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeA = toRadians(a[1]);
  const latitudeB = toRadians(b[1]);
  const deltaLatitude = toRadians(b[1] - a[1]);
  const deltaLongitude = toRadians(b[0] - a[0]);
  const value =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(deltaLongitude / 2) ** 2;

  return 6371e3 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
