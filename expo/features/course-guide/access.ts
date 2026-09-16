const DEFAULT_WEB_URL = 'https://chooselife.club';

export const HIGHLINE_BEGINNER_GUIDE_ACCESS_PATH =
  '/api/courses/highline-beginner/access';

export type HighlineBeginnerGuideAccess = {
  pdfUrl: string;
};

export class CourseAccessError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code = 'COURSE_ACCESS_ERROR') {
    super(message);
    this.name = 'CourseAccessError';
    this.status = status;
    this.code = code;
  }
}

type CourseAccessPayload = Record<string, unknown>;

function isRecord(value: unknown): value is CourseAccessPayload {
  return typeof value === 'object' && value !== null;
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

/** Maps the server's access response to the single value the native reader needs. */
export function mapCourseAccessResponse(
  payload: unknown,
): HighlineBeginnerGuideAccess {
  if (!isRecord(payload)) {
    throw new CourseAccessError(
      'The course access response was invalid.',
      200,
      'INVALID_RESPONSE',
    );
  }

  const pdfUrl = payload.documentUrl;

  if (!isHttpUrl(pdfUrl)) {
    throw new CourseAccessError(
      'The course access response did not include a valid PDF URL.',
      200,
      'INVALID_RESPONSE',
    );
  }

  return { pdfUrl };
}

export type FetchCourseAccessOptions = {
  signal?: AbortSignal;
  webUrl?: string;
  fetchImpl?: typeof fetch;
};

async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload) && typeof payload.message === 'string') {
      return payload.message;
    }
  } catch {
    // The server may return an empty or non-JSON error response.
  }

  return null;
}

export async function fetchHighlineBeginnerGuideAccess(
  token: string,
  options: FetchCourseAccessOptions = {},
): Promise<HighlineBeginnerGuideAccess> {
  const webUrl = (
    options.webUrl ||
    process.env.EXPO_PUBLIC_WEB_URL ||
    DEFAULT_WEB_URL
  ).replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(
    `${webUrl}${HIGHLINE_BEGINNER_GUIDE_ACCESS_PATH}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: options.signal,
    },
  );

  if (response.status === 403) {
    throw new CourseAccessError(
      'This course is not available for your account.',
      403,
      'COURSE_ACCESS_FORBIDDEN',
    );
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new CourseAccessError(
      message || 'Unable to check course access.',
      response.status,
      'COURSE_ACCESS_REQUEST_FAILED',
    );
  }

  return mapCourseAccessResponse(await response.json());
}
