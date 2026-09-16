import { CourseAccessError } from './access';
import { resolveCourseGuideState } from './state';

const READY_INPUT = {
  accessError: null,
  isAccessPending: false,
  isOnline: true,
  pdfUrl: 'https://r2.example.com/guide.pdf',
  sessionLoading: false,
  signedIn: true,
};

describe('course guide view state', () => {
  it.each([
    [{ ...READY_INPUT, sessionLoading: true }, { kind: 'loading' }],
    [{ ...READY_INPUT, signedIn: false }, { kind: 'sign-in' }],
    [{ ...READY_INPUT, isOnline: false }, { kind: 'offline' }],
    [{ ...READY_INPUT, isAccessPending: true }, { kind: 'loading' }],
    [
      {
        ...READY_INPUT,
        accessError: new CourseAccessError('Forbidden', 403),
      },
      { kind: 'locked' },
    ],
    [
      { ...READY_INPUT, accessError: new Error('Network failed') },
      { kind: 'error' },
    ],
    [{ ...READY_INPUT, pdfUrl: undefined }, { kind: 'error' }],
    [READY_INPUT, { kind: 'reader', pdfUrl: READY_INPUT.pdfUrl }],
  ])('resolves %#', (input, expected) => {
    expect(resolveCourseGuideState(input)).toEqual(expected);
  });
});
