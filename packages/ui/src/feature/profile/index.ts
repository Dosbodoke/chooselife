export const usernameRegex = /^@(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{3,30}$/;

export function normalizeUsernameInput(username: string) {
  const normalizedUsername = username.trim().replace(/^@+/, "").toLowerCase();
  return normalizedUsername ? `@${normalizedUsername}` : "";
}

export function isValidUsername(username: string) {
  return usernameRegex.test(username);
}

export function formatUsernameForDisplay(username: string | null | undefined) {
  const normalizedUsername = username ? normalizeUsernameInput(username) : "";
  return normalizedUsername;
}
