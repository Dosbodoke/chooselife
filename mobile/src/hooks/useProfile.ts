import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-expo';

import { trpc } from '@src/utils/trpc';

export const useProfile = () => {
  const { isSignedIn } = useAuth();

  const { data, isLoading, mutate } = trpc.auth.upsertProfile.useMutation({});

  useEffect(() => {
    if (isSignedIn) {
      // When user Log in, create user profile if it doesn't exist
      mutate();
    }
  }, [isSignedIn]);

  return { data, isLoading };
};
