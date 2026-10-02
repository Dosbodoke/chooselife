export const HIGHLINE_BEGINNER_GUIDE_FILENAME =
  "guia-do-highline-iniciante.pdf";
export const HIGHLINE_BEGINNER_GUIDE_CONTENT_TYPE = "application/pdf";
export const HIGHLINE_BEGINNER_GUIDE_URL_TTL_SECONDS = 5 * 60;
export const HIGHLINE_BEGINNER_GUIDE_CONTENT_DISPOSITION = `inline; filename="${HIGHLINE_BEGINNER_GUIDE_FILENAME}"`;

export type CourseAccessUser = {
  id: string;
};

export type SignDocumentInput = {
  contentDisposition: string;
  contentType: string;
  expiresIn: number;
};

export type CourseAccessDependencies = {
  authenticate: (token: string) => Promise<CourseAccessUser | null>;
  hasEntitlement: (token: string, userId: string) => Promise<boolean>;
  signDocument: (input: SignDocumentInput) => Promise<string>;
  now?: () => number;
};

export type CourseAccessResult =
  | {
      status: 200;
      body: {
        documentUrl: string;
        expiresAt: string;
      };
    }
  | {
      status: 401;
      body: {
        error: "Unauthorized";
      };
    }
  | {
      status: 403;
      body: {
        code: "entitlement_required";
        error: "Course access required";
      };
    }
  | {
      status: 500;
      body: {
        error: "Internal server error";
      };
    };

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

const unauthorized = (): CourseAccessResult => ({
  status: 401,
  body: { error: "Unauthorized" },
});

const internalServerError = (): CourseAccessResult => ({
  status: 500,
  body: { error: "Internal server error" },
});

export async function resolveHighlineBeginnerAccess(
  request: Request,
  dependencies: CourseAccessDependencies
): Promise<CourseAccessResult> {
  const token = getBearerToken(request);

  if (!token) {
    return unauthorized();
  }

  let user: CourseAccessUser | null;
  try {
    user = await dependencies.authenticate(token);
  } catch {
    return internalServerError();
  }

  if (!user) {
    return unauthorized();
  }

  let entitled: boolean;
  try {
    entitled = await dependencies.hasEntitlement(token, user.id);
  } catch {
    return internalServerError();
  }

  if (!entitled) {
    return {
      status: 403,
      body: {
        code: "entitlement_required",
        error: "Course access required",
      },
    };
  }

  const now = dependencies.now ?? Date.now;
  const expiresAt = new Date(
    now() + HIGHLINE_BEGINNER_GUIDE_URL_TTL_SECONDS * 1000
  ).toISOString();

  try {
    const documentUrl = await dependencies.signDocument({
      contentDisposition: HIGHLINE_BEGINNER_GUIDE_CONTENT_DISPOSITION,
      contentType: HIGHLINE_BEGINNER_GUIDE_CONTENT_TYPE,
      expiresIn: HIGHLINE_BEGINNER_GUIDE_URL_TTL_SECONDS,
    });

    return {
      status: 200,
      body: { documentUrl, expiresAt },
    };
  } catch {
    return internalServerError();
  }
}
