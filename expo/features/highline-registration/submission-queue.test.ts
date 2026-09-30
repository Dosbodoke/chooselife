import {
  clearRegistrationStateStore,
  getRegistrationStateStore,
} from './state/store';
import {
  classifySubmissionError,
  serializeSubmissionVariables,
} from './submission';
import { markHighlineSubmissionNeedsAttention } from './submission-queue';

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: { fs: {} },
}));

describe('highline registration submission queue failure handling', () => {
  const ownerId = 'queue-test-user';

  afterEach(() => {
    clearRegistrationStateStore(ownerId);
  });

  it('keeps ordinary offline failures pending but surfaces repeated server failures', async () => {
    const store = getRegistrationStateStore(ownerId);
    await store.dispatch({ type: 'start', draftId: 'draft-queue-test' });
    await store.dispatch({
      type: 'place-a',
      position: [-47.93, -15.77],
    });
    await store.dispatch({
      type: 'place-b',
      position: [-47.92, -15.78],
    });
    await store.dispatch({
      type: 'update-form',
      form: { name: 'Queued line', height: 20, length: 143 },
    });
    await store.dispatch({
      type: 'queue',
      submissionId: 'submission-queue-test',
      highlineId: 'highline-queue-test',
    });

    const queued = store.getState().submissions[0];
    const variables = serializeSubmissionVariables(queued);
    const offlineError = new TypeError('Network request failed');
    const serverError = { status: 503, message: 'temporarily unavailable' };

    expect(classifySubmissionError(offlineError).retryable).toBe(true);
    await markHighlineSubmissionNeedsAttention(variables, offlineError);
    expect(store.getState().submissions[0].status).toBe('pending');

    await markHighlineSubmissionNeedsAttention(variables, serverError, true);
    expect(store.getState().submissions[0]).toMatchObject({
      status: 'needs-attention',
      lastError: { code: 'HTTP_503', retryable: true },
    });
  });
});
