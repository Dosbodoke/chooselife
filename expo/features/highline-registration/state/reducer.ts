import {
  AnchorPosition,
  cloneAnchorPosition,
  cloneRegistrationForm,
  createHighlineId,
  createRegistrationId,
  createRegistrationDraft,
  HighlineRegistrationState,
  QueuedHighlineSubmission,
  RegistrationError,
  RegistrationForm,
  RegistrationStage,
  withoutRegistrationImageBase64,
} from './model';

export {
  createEmptyRegistrationState,
  createRegistrationDraft,
} from './model';

export type RegistrationAction =
  | {
      type: 'start';
      draftId?: string;
      form?: Partial<RegistrationForm>;
      now?: string;
    }
  | { type: 'place-a'; position: AnchorPosition; now?: string }
  | { type: 'place-b'; position: AnchorPosition; now?: string }
  | {
      type: 'begin-adjust';
      anchor: 'a' | 'b';
      now?: string;
    }
  | {
      type: 'adjust';
      anchor: 'a' | 'b';
      position?: AnchorPosition;
      now?: string;
    }
  | { type: 'review'; now?: string }
  | { type: 'undo'; now?: string }
  | { type: 'exit'; now?: string }
  | {
      type: 'update-form';
      form: Partial<RegistrationForm>;
      now?: string;
    }
  | {
      type: 'queue';
      submissionId?: string;
      highlineId?: string | null;
      imageId?: string | null;
      now?: string;
    }
  | { type: 'mark-attempt'; submissionId: string; now?: string; nextAttemptAt?: string | null }
  | {
      type: 'mark-needs-attention';
      submissionId: string;
      error: RegistrationError;
      now?: string;
    }
  | { type: 'retry'; submissionId: string; now?: string }
  | { type: 'mark-submitted'; submissionId: string; now?: string }
  | { type: 'discard'; submissionId: string; now?: string }
  | { type: 'edit-submission'; submissionId: string; now?: string }
  | {
      type: 'set-identifiers';
      submissionId: string;
      highlineId?: string | null;
      imageId?: string | null;
      now?: string;
    }
  | {
      type: 'mark-image-staged';
      submissionId: string;
      imageId: string;
      remoteKey?: string | null;
      now?: string;
    };

function nowFor(action: RegistrationAction): string {
  return action.now ?? new Date().toISOString();
}

function updateActiveDraft(
  state: HighlineRegistrationState,
  now: string,
  update: (draft: NonNullable<HighlineRegistrationState['activeDraft']>) =>
    | NonNullable<HighlineRegistrationState['activeDraft']>
    | null,
): HighlineRegistrationState {
  if (!state.activeDraft) return state;

  const updated = update(state.activeDraft);
  if (!updated) {
    return { ...state, activeDraft: null };
  }

  return {
    ...state,
    activeDraft: {
      ...updated,
      updatedAt: now,
    },
  };
}

function updateSubmission(
  state: HighlineRegistrationState,
  submissionId: string,
  update: (submission: QueuedHighlineSubmission) => QueuedHighlineSubmission,
): HighlineRegistrationState {
  let changed = false;
  const submissions = state.submissions.map((submission) => {
    if (submission.submissionId !== submissionId) return submission;
    const updated = update(submission);
    if (updated !== submission) changed = true;
    return updated;
  });

  return changed ? { ...state, submissions } : state;
}

function withSubmissionTimestamp(
  submission: QueuedHighlineSubmission,
  now: string,
): QueuedHighlineSubmission {
  return { ...submission, updatedAt: now };
}

function hasBothAnchors(
  draft: NonNullable<HighlineRegistrationState['activeDraft']>,
): draft is NonNullable<HighlineRegistrationState['activeDraft']> & {
  anchorA: AnchorPosition;
  anchorB: AnchorPosition;
} {
  return Boolean(draft.anchorA && draft.anchorB);
}

function replaceAnchor(
  draft: NonNullable<HighlineRegistrationState['activeDraft']>,
  anchor: 'a' | 'b',
  position: AnchorPosition | null,
): NonNullable<HighlineRegistrationState['activeDraft']> {
  if (anchor === 'a') {
    return {
      ...draft,
      anchorA: cloneAnchorPosition(position),
      // Moving A invalidates B because the line must be re-placed in order.
      anchorB: null,
      stage: position ? 'place-b' : 'place-a',
      adjustingAnchor: null,
    };
  }

  return {
    ...draft,
    anchorB: cloneAnchorPosition(position),
    stage: position ? (draft.anchorA ? 'review' : 'place-b') : 'place-b',
    adjustingAnchor: null,
  };
}

export function registrationReducer(
  state: HighlineRegistrationState,
  action: RegistrationAction,
): HighlineRegistrationState {
  const now = nowFor(action);
  const activeDraft = state.activeDraft;

  switch (action.type) {
    case 'start': {
      if (activeDraft) return state;

      return {
        ...state,
        activeDraft: createRegistrationDraft(state.ownerId, {
          draftId: action.draftId,
          form: action.form,
          now,
        }),
      };
    }

    case 'place-a': {
      if (!activeDraft || activeDraft.stage !== 'place-a') return state;

      return updateActiveDraft(state, now, (draft) => ({
        ...draft,
        anchorA: cloneAnchorPosition(action.position),
        anchorB: null,
        stage: 'place-b',
        adjustingAnchor: null,
        exitedAt: null,
      }));
    }

    case 'place-b': {
      if (
        !activeDraft ||
        activeDraft.stage !== 'place-b' ||
        !activeDraft.anchorA
      ) {
        return state;
      }

      return updateActiveDraft(state, now, (draft) => ({
        ...draft,
        anchorB: cloneAnchorPosition(action.position),
        stage: 'review',
        adjustingAnchor: null,
        exitedAt: null,
      }));
    }

    case 'begin-adjust': {
      if (!activeDraft || !hasBothAnchors(activeDraft)) return state;

      // Adjusting A changes the line's origin, so B cannot remain committed.
      // Adjusting B only reopens the second placement.
      return updateActiveDraft(state, now, (draft) =>
        replaceAnchor(draft, action.anchor, null),
      );
    }

    case 'adjust': {
      if (!activeDraft || !action.position) return state;

      if (action.anchor === 'a' && activeDraft.stage !== 'place-a') {
        return state;
      }
      if (action.anchor === 'b' && activeDraft.stage !== 'place-b') {
        return state;
      }

      return updateActiveDraft(state, now, (draft) =>
        replaceAnchor(draft, action.anchor, action.position ?? null),
      );
    }

    case 'review': {
      if (!activeDraft || !hasBothAnchors(activeDraft)) return state;

      return updateActiveDraft(state, now, (draft) => ({
        ...draft,
        stage: 'review',
        adjustingAnchor: null,
        exitedAt: null,
      }));
    }

    case 'undo': {
      if (!activeDraft) return state;

      if (activeDraft.stage === 'review' && activeDraft.anchorB) {
        return updateActiveDraft(state, now, (draft) => ({
          ...draft,
          anchorB: null,
          stage: 'place-b',
          adjustingAnchor: null,
        }));
      }

      if (activeDraft.stage === 'place-b' && activeDraft.anchorA) {
        return updateActiveDraft(state, now, (draft) => ({
          ...draft,
          anchorA: null,
          anchorB: null,
          stage: 'place-a',
          adjustingAnchor: null,
        }));
      }

      return state;
    }

    case 'exit': {
      if (!activeDraft) return state;
      if (!activeDraft.anchorA && !activeDraft.anchorB) {
        return { ...state, activeDraft: null };
      }

      return updateActiveDraft(state, now, (draft) => ({
        ...draft,
        exitedAt: now,
      }));
    }

    case 'update-form': {
      if (!activeDraft) return state;

      return updateActiveDraft(state, now, (draft) => ({
        ...draft,
        form: {
          ...draft.form,
          ...action.form,
          image:
            action.form.image === undefined
              ? draft.form.image
              : action.form.image
                ? { ...action.form.image }
                : null,
        },
        exitedAt: null,
      }));
    }

    case 'queue': {
      if (!activeDraft || !hasBothAnchors(activeDraft)) return state;
      if (activeDraft.stage !== 'review') return state;

      const submissionId = action.submissionId ?? uuidFor('submission');
      if (
        state.submissions.some(
          (submission) => submission.submissionId === submissionId,
        )
      ) {
        return state;
      }

      const form = cloneRegistrationForm(activeDraft.form);
      const submission: QueuedHighlineSubmission = {
        submissionId,
        sourceDraftId: activeDraft.draftId,
        ownerId: state.ownerId,
        status: 'pending',
        anchorA: [...activeDraft.anchorA],
        anchorB: [...activeDraft.anchorB],
        form,
        highlineId: action.highlineId ?? createHighlineId(),
        imageId: action.imageId ?? form.image?.imageId ?? null,
        createdAt: now,
        updatedAt: now,
        submittedAt: null,
        attemptCount: 0,
        lastAttemptAt: null,
        nextAttemptAt: null,
        lastError: null,
      };

      return {
        ...state,
        activeDraft: null,
        submissions: [...state.submissions, submission],
      };
    }

    case 'mark-attempt': {
      return updateSubmission(state, action.submissionId, (submission) =>
        withSubmissionTimestamp(
          {
            ...submission,
            attemptCount: submission.attemptCount + 1,
            lastAttemptAt: now,
            nextAttemptAt: action.nextAttemptAt ?? null,
          },
          now,
        ),
      );
    }

    case 'mark-needs-attention': {
      return updateSubmission(state, action.submissionId, (submission) =>
        withSubmissionTimestamp(
          {
            ...submission,
            status: 'needs-attention',
            nextAttemptAt: null,
            lastError: { ...action.error },
          },
          now,
        ),
      );
    }

    case 'retry': {
      return updateSubmission(state, action.submissionId, (submission) =>
        withSubmissionTimestamp(
          {
            ...submission,
            status: 'pending',
            nextAttemptAt: null,
            lastError: null,
          },
          now,
        ),
      );
    }

    case 'mark-submitted': {
      const submission = state.submissions.find(
        (item) => item.submissionId === action.submissionId,
      );
      if (!submission) return state;

      return {
        ...state,
        submissions: state.submissions.filter(
          (item) => item.submissionId !== action.submissionId,
        ),
      };
    }

    case 'discard': {
      if (
        !state.submissions.some(
          (item) => item.submissionId === action.submissionId,
        )
      ) {
        return state;
      }

      return {
        ...state,
        submissions: state.submissions.filter(
          (item) => item.submissionId !== action.submissionId,
        ),
      };
    }

    case 'edit-submission': {
      if (activeDraft) return state;
      const submission = state.submissions.find(
        (item) => item.submissionId === action.submissionId,
      );
      if (!submission) return state;

      const draft: NonNullable<HighlineRegistrationState['activeDraft']> = {
        draftId: submission.sourceDraftId,
        ownerId: state.ownerId,
        status: 'draft',
        stage: 'review',
        adjustingAnchor: null,
        anchorA: [...submission.anchorA],
        anchorB: [...submission.anchorB],
        form: cloneRegistrationForm(submission.form),
        createdAt: submission.createdAt,
        updatedAt: now,
        exitedAt: null,
      };

      return {
        ...state,
        activeDraft: draft,
        submissions: state.submissions.filter(
          (item) => item.submissionId !== action.submissionId,
        ),
      };
    }

    case 'set-identifiers': {
      return updateSubmission(state, action.submissionId, (submission) =>
        withSubmissionTimestamp(
          {
            ...submission,
            highlineId:
              action.highlineId === undefined
                ? submission.highlineId
                : action.highlineId,
            imageId:
              action.imageId === undefined ? submission.imageId : action.imageId,
          },
          now,
        ),
      );
    }

    case 'mark-image-staged': {
      return updateSubmission(state, action.submissionId, (submission) => {
        const image = submission.form.image;
        if (!image || image.imageId !== action.imageId) return submission;

        return withSubmissionTimestamp(
          {
            ...submission,
            imageId: action.imageId,
            form: {
              ...submission.form,
              image: {
                ...withoutRegistrationImageBase64(image)!,
                remoteKey:
                  action.remoteKey === undefined
                    ? image.remoteKey
                    : action.remoteKey,
              },
            },
          },
          now,
        );
      });
    }

    default: {
      const exhaustiveAction: never = action;
      return exhaustiveAction;
    }
  }
}

function uuidFor(prefix: string): string {
  // Kept local to the reducer so state remains easy to serialize and replay.
  return createRegistrationId(prefix);
}

export function canQueueRegistration(
  state: HighlineRegistrationState,
): boolean {
  return Boolean(
    state.activeDraft &&
      state.activeDraft.stage === 'review' &&
      state.activeDraft.anchorA &&
      state.activeDraft.anchorB,
  );
}

export function getRegistrationStage(
  state: HighlineRegistrationState,
): RegistrationStage | null {
  return state.activeDraft?.stage ?? null;
}
