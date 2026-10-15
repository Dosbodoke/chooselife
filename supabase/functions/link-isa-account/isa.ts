import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * The International Slackline Association runs its accounts on an AWS Cognito
 * user pool (github.com/International-Slackline-Association/isa-users). Every
 * ISA app — slackmap, SportHub, the account site — has its own app client in
 * that pool; Choose Life's client ID is provided by ISA and set as the
 * `ISA_COGNITO_CLIENT_ID` secret.
 */
export const ISA_ISSUER =
  "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_iGaYGKeyJ";
export const ISA_ACCOUNT_API = "https://account-api.slacklineinternational.org";

const isaJwks = createRemoteJWKSet(
  new URL(`${ISA_ISSUER}/.well-known/jwks.json`),
);

export type IsaIdentity = { sub: string };

export type IsaUserDetails = {
  isaId: string;
  name?: string;
  surname?: string;
};

/**
 * The ID token must be signed by the ISA pool AND issued to Choose Life's
 * client: a token minted for slackmap would otherwise let anyone who obtained
 * it claim that ISA account here.
 */
export async function verifyIsaIdToken(
  idToken: string,
  clientId: string,
): Promise<IsaIdentity> {
  const { payload } = await jwtVerify(idToken, isaJwks, {
    issuer: ISA_ISSUER,
    audience: clientId,
  });

  if (payload.token_use !== "id" || typeof payload.sub !== "string") {
    throw new Error("Not an ISA ID token.");
  }

  return { sub: payload.sub };
}

/**
 * `GET /basic/userDetails` is what slackmap uses to read the signed-in ISA
 * member. The account API authorizes it with the same Cognito ID token, so it
 * only ever returns the member who signed in.
 */
export async function fetchIsaUserDetails(
  idToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<IsaUserDetails> {
  const response = await fetchImpl(`${ISA_ACCOUNT_API}/basic/userDetails`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!response.ok) {
    throw new Error(`ISA account API responded ${response.status}.`);
  }

  const body = await response.json();
  if (typeof body?.isaId !== "string") {
    throw new Error("ISA account API returned no ISA ID.");
  }

  return {
    isaId: body.isaId,
    name: typeof body.name === "string" ? body.name : undefined,
    surname: typeof body.surname === "string" ? body.surname : undefined,
  };
}
