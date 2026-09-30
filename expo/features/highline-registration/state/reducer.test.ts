import {
  createEmptyRegistrationState,
  createRegistrationDraft,
} from './model';
import { registrationReducer } from './reducer';
import {
  selectMapLineProjections,
  selectPendingMapLines,
} from './selectors';

const OWNER_ID = 'user-1';
const NOW = '2026-01-01T00:00:00.000Z';
const LATER = '2026-01-01T00:01:00.000Z';

function startedState() {
  return registrationReducer(createEmptyRegistrationState(OWNER_ID), {
    type: 'start',
    draftId: 'draft-1',
    now: NOW,
  });
}

describe('highline registration reducer', () => {
  it('keeps one resumable draft and advances through anchor placement', () => {
    const started = startedState();
    const withA = registrationReducer(started, {
      type: 'place-a',
      position: [-47.93, -15.77],
      now: LATER,
    });
    const reviewed = registrationReducer(withA, {
      type: 'place-b',
      position: [-47.92, -15.78],
      now: LATER,
    });

    expect(reviewed.activeDraft).toMatchObject({
      draftId: 'draft-1',
      status: 'draft',
      stage: 'review',
      anchorA: [-47.93, -15.77],
      anchorB: [-47.92, -15.78],
      updatedAt: LATER,
    });

    const secondStart = registrationReducer(reviewed, {
      type: 'start',
      draftId: 'draft-2',
      now: LATER,
    });

    expect(secondStart.activeDraft?.draftId).toBe('draft-1');
  });

  it('undoes B before A and applies the anchor adjustment rules', () => {
    const reviewed = registrationReducer(
      registrationReducer(
        registrationReducer(startedState(), {
          type: 'place-a',
          position: [-47.93, -15.77],
          now: NOW,
        }),
        {
          type: 'place-b',
          position: [-47.92, -15.78],
          now: NOW,
        },
      ),
      { type: 'review', now: NOW },
    );

    const afterUndo = registrationReducer(reviewed, {
      type: 'undo',
      now: LATER,
    });
    expect(afterUndo.activeDraft).toMatchObject({
      stage: 'place-b',
      anchorA: [-47.93, -15.77],
      anchorB: null,
    });

    const placedAgain = registrationReducer(afterUndo, {
      type: 'place-b',
      position: [-47.91, -15.79],
      now: LATER,
    });
    const afterAdjustA = registrationReducer(placedAgain, {
      type: 'begin-adjust',
      anchor: 'a',
      now: LATER,
    });
    expect(afterAdjustA.activeDraft).toMatchObject({
      stage: 'place-a',
      anchorA: null,
      anchorB: null,
    });

    const replacedA = registrationReducer(afterAdjustA, {
      type: 'adjust',
      anchor: 'a',
      position: [-47.90, -15.80],
      now: LATER,
    });
    expect(replacedA.activeDraft).toMatchObject({
      stage: 'place-b',
      anchorA: [-47.90, -15.80],
      anchorB: null,
    });

    const reviewedAgain = registrationReducer(replacedA, {
      type: 'place-b',
      position: [-47.91, -15.79],
      now: LATER,
    });
    const afterAdjustB = registrationReducer(reviewedAgain, {
      type: 'begin-adjust',
      anchor: 'b',
      now: LATER,
    });

    expect(afterAdjustB.activeDraft).toMatchObject({
      stage: 'place-b',
      anchorA: [-47.90, -15.80],
      anchorB: null,
    });
  });

  it('discards an empty draft but preserves a draft with committed anchors', () => {
    const discarded = registrationReducer(startedState(), {
      type: 'exit',
      now: LATER,
    });
    expect(discarded.activeDraft).toBeNull();

    const withA = registrationReducer(startedState(), {
      type: 'place-a',
      position: [-47.93, -15.77],
      now: LATER,
    });
    const exited = registrationReducer(withA, {
      type: 'exit',
      now: LATER,
    });

    expect(exited.activeDraft).toMatchObject({
      draftId: 'draft-1',
      status: 'draft',
      exitedAt: LATER,
    });
  });

  it('moves a reviewed draft to the queue and supports multiple submissions', () => {
    const reviewed = registrationReducer(
      registrationReducer(
        registrationReducer(startedState(), {
          type: 'place-a',
          position: [-47.93, -15.77],
          now: NOW,
        }),
        {
          type: 'place-b',
          position: [-47.92, -15.78],
          now: NOW,
        },
      ),
      { type: 'review', now: NOW },
    );
    const queued = registrationReducer(reviewed, {
      type: 'queue',
      submissionId: 'submission-1',
      now: LATER,
    });
    const withSecondDraft = registrationReducer(queued, {
      type: 'start',
      draftId: 'draft-2',
      now: LATER,
    });

    expect(queued.activeDraft).toBeNull();
    expect(queued.submissions).toHaveLength(1);
    expect(queued.submissions[0]).toMatchObject({
      submissionId: 'submission-1',
      sourceDraftId: 'draft-1',
      status: 'pending',
      anchorA: [-47.93, -15.77],
      anchorB: [-47.92, -15.78],
    });
    expect(withSecondDraft.activeDraft?.draftId).toBe('draft-2');
    expect(withSecondDraft.submissions).toHaveLength(1);
  });

  it('tracks attempts and preserves a submission for retry or editing', () => {
    const state = registrationReducer(
      registrationReducer(
        registrationReducer(
          registrationReducer(startedState(), {
            type: 'place-a',
            position: [-47.93, -15.77],
            now: NOW,
          }),
          {
            type: 'place-b',
            position: [-47.92, -15.78],
            now: NOW,
          },
        ),
        { type: 'review', now: NOW },
      ),
      { type: 'queue', submissionId: 'submission-1', now: NOW },
    );
    const attempted = registrationReducer(state, {
      type: 'mark-attempt',
      submissionId: 'submission-1',
      now: LATER,
    });
    const attention = registrationReducer(attempted, {
      type: 'mark-needs-attention',
      submissionId: 'submission-1',
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Name is required',
        retryable: false,
      },
      now: LATER,
    });

    expect(attention.submissions[0]).toMatchObject({
      status: 'needs-attention',
      attemptCount: 1,
      lastError: {
        code: 'VALIDATION_FAILED',
        retryable: false,
      },
    });

    const retried = registrationReducer(attention, {
      type: 'retry',
      submissionId: 'submission-1',
      now: LATER,
    });
    expect(retried.submissions[0]).toMatchObject({
      status: 'pending',
      lastError: null,
    });

    const edited = registrationReducer(attention, {
      type: 'edit-submission',
      submissionId: 'submission-1',
      now: LATER,
    });
    expect(edited.activeDraft).toMatchObject({
      draftId: 'draft-1',
      status: 'draft',
      stage: 'review',
      anchorA: [-47.93, -15.77],
    });
    expect(edited.submissions).toHaveLength(0);
    expect(retried.submissions).toHaveLength(1);
  });

  it('removes a submitted item only after an explicit success transition', () => {
    const state = registrationReducer(
      registrationReducer(
        registrationReducer(
          registrationReducer(startedState(), {
            type: 'place-a',
            position: [-47.93, -15.77],
            now: NOW,
          }),
          {
            type: 'place-b',
            position: [-47.92, -15.78],
            now: NOW,
          },
        ),
        { type: 'review', now: NOW },
      ),
      { type: 'queue', submissionId: 'submission-1', now: NOW },
    );

    const submitted = registrationReducer(state, {
      type: 'mark-submitted',
      submissionId: 'submission-1',
      now: LATER,
    });

    expect(submitted.submissions).toEqual([]);
  });

  it('allows the submission worker to drop picker bytes after staging an image', () => {
    const image = {
      imageId: 'image-1',
      localUri: 'file:///image-1.jpg',
      mimeType: 'image/jpeg',
      fileName: 'image.jpg',
      fileSize: 10,
      width: 10,
      height: 10,
      base64: 'transient-picker-bytes',
      remoteKey: null,
    };
    const started = registrationReducer(startedState(), {
      type: 'update-form',
      form: { image },
      now: NOW,
    });
    const placedA = registrationReducer(started, {
      type: 'place-a',
      position: [-47.93, -15.77],
      now: NOW,
    });
    const reviewed = registrationReducer(placedA, {
      type: 'place-b',
      position: [-47.92, -15.78],
      now: NOW,
    });
    const queued = registrationReducer(reviewed, {
      type: 'queue',
      submissionId: 'submission-1',
      now: NOW,
    });
    const staged = registrationReducer(queued, {
      type: 'mark-image-staged',
      submissionId: 'submission-1',
      imageId: 'image-1',
      remoteKey: 'image-1.jpg',
      now: LATER,
    });

    expect(staged.submissions[0].form.image).toMatchObject({
      imageId: 'image-1',
      base64: null,
      remoteKey: 'image-1.jpg',
    });
  });
});

describe('highline registration map projections', () => {
  it('projects queued lines with stable status and computed geometry', () => {
    const draft = createRegistrationDraft(OWNER_ID, {
      draftId: 'draft-1',
      now: NOW,
    });
    const reviewed = registrationReducer(
      registrationReducer(
        registrationReducer(
          { ...createEmptyRegistrationState(OWNER_ID), activeDraft: draft },
          {
            type: 'place-a',
            position: [-47.93, -15.77],
            now: NOW,
          },
        ),
        {
          type: 'place-b',
          position: [-47.92, -15.78],
          now: NOW,
        },
      ),
      { type: 'review', now: NOW },
    );
    const queued = registrationReducer(reviewed, {
      type: 'queue',
      submissionId: 'submission-1',
      now: NOW,
    });
    const attention = registrationReducer(queued, {
      type: 'mark-needs-attention',
      submissionId: 'submission-1',
      error: { code: 'FAILED', message: 'failed', retryable: false },
      now: LATER,
    });

    const projections = selectPendingMapLines(attention);
    expect(projections).toHaveLength(1);
    expect(projections[0]).toMatchObject({
      submissionId: 'submission-1',
      sourceDraftId: 'draft-1',
      status: 'needs-attention',
      anchorA: [-47.93, -15.77],
      anchorB: [-47.92, -15.78],
    });
    expect(projections[0].midpoint[0]).toBeCloseTo(-47.925, 10);
    expect(projections[0].midpoint[1]).toBeCloseTo(-15.775, 10);
    expect(projections[0].lengthM).toBeGreaterThan(0);
    expect(selectMapLineProjections(attention)).toEqual(projections);
  });
});
