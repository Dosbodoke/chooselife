import { useCallback } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { useOAuth } from '@clerk/clerk-expo';

import { AppleSvg } from '@src/assets';

const LogInWithApple = () => {
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_apple' });

  const handleAppleSignIn = useCallback(async () => {
    try {
      const { createdSessionId, signIn, signUp, setActive } = await startOAuthFlow();

      if (createdSessionId) {
        setActive({ session: createdSessionId });
      } else {
        // Use signIn or signUp for next steps such as MFA
      }
    } catch (err) {
      console.error('OAuth error', err);
    }
  }, []);

  return (
    <TouchableOpacity
      className="flex flex-row items-center justify-center rounded-md border-[1px] border-slate-300 py-3"
      style={{ columnGap: 8 }}
      onPress={handleAppleSignIn}>
      <AppleSvg />
      <Text className="text-base font-semibold">Entrar com Apple</Text>
    </TouchableOpacity>
  );
};

export default LogInWithApple;
