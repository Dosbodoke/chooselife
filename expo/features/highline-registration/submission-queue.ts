import type { QueryClient } from '@tanstack/react-query';

import { removeStagedHighlineImage } from './image-storage';
import type { QueuedHighlineSubmission } from './state/model';
import { getRegistrationStateStore } from './state/store';
import {
  classifySubmissionError,
  serializeSubmissionVariables,
  submitHighlineRegistrationMutationKey,
  type SerializedSubmissionVariables,
} from './submission';

export async function markHighlineSubmissionAttempt(
  variables: SerializedSubmissionVariables,
): Promise<void> {
  await getRegistrationStateStore(variables.ownerId).dispatch({
    type: 'mark-attempt',
    submissionId: variables.submissionId,
  });
}

export async function acknowledgeHighlineSubmission(
  variables: SerializedSubmissionVariables,
): Promise<void> {
  const store = getRegistrationStateStore(variables.ownerId);
  const state = await store.load();
  const submission = state.submissions.find(
    (item) => item.submissionId === variables.submissionId,
  );
  await store.dispatch({
    type: 'mark-submitted',
    submissionId: variables.submissionId,
  });

  await removeStagedHighlineImage(submission?.form.image ?? null);
}

export async function markHighlineSubmissionNeedsAttention(
  variables: SerializedSubmissionVariables,
  error: unknown,
  terminal = false,
): Promise<void> {
  const classified = classifySubmissionError(error);
  // A transient/offline failure should remain pending so that React Query can
  // resume it when connectivity returns. Once the mutation has consumed its
  // retry budget, however, retaining `pending` would create an unbounded loop
  // with no user-visible way to recover from a repeatedly failing server.
  if (classified.retryable && !terminal) return;

  await getRegistrationStateStore(variables.ownerId).dispatch({
    type: 'mark-needs-attention',
    submissionId: variables.submissionId,
    error: {
      code: classified.code,
      message: classified.message,
      retryable: classified.retryable,
    },
  });
}

export async function replayPendingHighlineSubmissions(
  queryClient: QueryClient,
  ownerId: string,
): Promise<void> {
  const state = await getRegistrationStateStore(ownerId).load();
  const pending = state.submissions.filter(
    (submission) => submission.status === 'pending',
  );

  for (const submission of pending) {
    await replayHighlineSubmission(queryClient, submission);
  }
}

type MutationLike = {
  options: { mutationKey?: readonly unknown[] };
  state: { variables: unknown; status: string };
};

export function isHighlineSubmissionMutation(mutation: MutationLike): boolean {
  return (
    mutation.options.mutationKey?.[0] ===
    submitHighlineRegistrationMutationKey[0]
  );
}

export function submissionVariablesFromMutation(
  mutation: MutationLike,
): SerializedSubmissionVariables | null {
  if (!isHighlineSubmissionMutation(mutation)) return null;
  const variables = mutation.state.variables;
  if (!isSerializedVariables(variables)) return null;
  return variables;
}

async function replayHighlineSubmission(
  queryClient: QueryClient,
  submission: QueuedHighlineSubmission,
): Promise<void> {
  let variables: SerializedSubmissionVariables;
  try {
    variables = serializeSubmissionVariables(submission);
  } catch (error) {
    await markHighlineSubmissionNeedsAttention(
      {
        submissionId: submission.submissionId,
        sourceDraftId: submission.sourceDraftId,
        ownerId: submission.ownerId,
        highlineId: submission.highlineId ?? '',
        imageId: submission.imageId,
        anchorA: [...submission.anchorA],
        anchorB: [...submission.anchorB],
        form: {
          ...submission.form,
          image: submission.form.image
            ? {
                ...submission.form.image,
                base64: null,
                remoteKey: submission.imageId,
              }
            : null,
        },
      },
      error,
    );
    return;
  }

  const existing = queryClient
    .getMutationCache()
    .findAll({ mutationKey: submitHighlineRegistrationMutationKey })
    .some((mutation) => {
      const current = submissionVariablesFromMutation(mutation);
      return (
        current?.submissionId === variables.submissionId &&
        mutation.state.status === 'pending'
      );
    });

  if (existing) return;

  const mutation = queryClient.getMutationCache().build(queryClient, {
    mutationKey: submitHighlineRegistrationMutationKey,
  });
  void mutation.execute(variables).catch(() => undefined);
}

function isSerializedVariables(
  value: unknown,
): value is SerializedSubmissionVariables {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SerializedSubmissionVariables>;
  return (
    typeof candidate.submissionId === 'string' &&
    typeof candidate.ownerId === 'string' &&
    typeof candidate.highlineId === 'string'
  );
}
