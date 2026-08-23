type PasswordCredentials = {
  email: string;
  password: string;
};

type PasswordAuthClient = {
  signInWithPassword: (credentials: PasswordCredentials) => Promise<{
    error: { code?: string } | null;
  }>;
};

type PasswordSignInResult =
  | { success: true }
  | { success: false; reason: "invalid_credentials" | "unknown" };

export async function signInWithEmailPassword(
  auth: PasswordAuthClient,
  credentials: PasswordCredentials
): Promise<PasswordSignInResult> {
  try {
    const { error } = await auth.signInWithPassword(credentials);

    if (!error) {
      return { success: true };
    }

    return {
      success: false,
      reason:
        error.code === "invalid_credentials" ? "invalid_credentials" : "unknown",
    };
  } catch {
    return { success: false, reason: "unknown" };
  }
}
