import { Redirect } from 'expo-router';

// The ISA sign-in returns to `<scheme>://isa-callback`. The auth session
// consumes that redirect, but Android may also deliver it to the router, which
// would otherwise land on +not-found. Linking starts from settings.
export default function IsaCallback() {
  return <Redirect href="/(tabs)/settings" />;
}
