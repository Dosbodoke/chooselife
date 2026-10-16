import {
  AuthRequest,
  exchangeCodeAsync,
  makeRedirectUri,
  ResponseType,
  type DiscoveryDocument,
} from 'expo-auth-session';

/**
 * ISA accounts live in the International Slackline Association's Cognito pool
 * (github.com/International-Slackline-Association/isa-users). Choose Life has
 * its own app client there; until ISA issues it, the client ID is unset and the
 * whole feature stays hidden.
 */
export const isaClientId = process.env.EXPO_PUBLIC_ISA_CLIENT_ID || undefined;

export const isIsaLinkingEnabled = Boolean(isaClientId);

const isaDiscovery: DiscoveryDocument = {
  authorizationEndpoint:
    'https://auth.slacklineinternational.org/oauth2/authorize',
  tokenEndpoint: 'https://auth.slacklineinternational.org/oauth2/token',
};

/**
 * Runs the ISA hosted sign-in (authorization code + PKCE) and returns the ISA
 * ID token, or null when the member cancelled. The token is not trusted here:
 * the `link-isa-account` edge function verifies it before linking anything.
 */
export async function signInToIsa(): Promise<string | null> {
  if (!isaClientId) throw new Error('ISA linking is not enabled.');

  // `<app scheme>://isa-callback` — one per app variant, all registered with ISA.
  const redirectUri = makeRedirectUri({ path: 'isa-callback' });
  const request = new AuthRequest({
    clientId: isaClientId,
    redirectUri,
    responseType: ResponseType.Code,
    scopes: ['openid', 'email'],
    usePKCE: true,
  });

  const result = await request.promptAsync(isaDiscovery);
  if (result.type !== 'success') return null;

  const tokens = await exchangeCodeAsync(
    {
      clientId: isaClientId,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier ?? '' },
    },
    isaDiscovery,
  );

  if (!tokens.idToken) throw new Error('ISA returned no ID token.');
  return tokens.idToken;
}
