import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-expo';

import { trpc } from '@src/utils/trpc';

export const useProfile = () => {
  const { isSignedIn, isLoaded } = useAuth();

  const profileMutation = trpc.auth.upsertProfile.useMutation({});

  useEffect(() => {
    if (isSignedIn) {
      // When user Log in, create user profile if it doesn't exist
      profileMutation.mutate();
    }
  }, [isSignedIn]);

  return { profile: profileMutation.data, isLoaded: !profileMutation.isLoading && isLoaded };
};
