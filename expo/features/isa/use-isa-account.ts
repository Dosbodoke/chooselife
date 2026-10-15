import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '~/lib/query-keys';
import { supabase } from '~/lib/supabase';
import type { Tables } from '~/utils/database.types';

import { getIsaLinkErrorKey, type IsaLinkErrorKey } from './isa-link-error';
import { signInToIsa } from './isa-sign-in';

export type IsaAccount = Pick<
  Tables<'profile_isa_accounts'>,
  'isa_id' | 'isa_name' | 'linked_at'
>;

export class IsaLinkError extends Error {
  constructor(readonly key: IsaLinkErrorKey) {
    super(key);
  }
}

export const useIsaAccount = (profileId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.isaAccount.byProfile(profileId),
    queryFn: async (): Promise<IsaAccount | null> => {
      const { data, error } = await supabase
        .from('profile_isa_accounts')
        .select('isa_id, isa_name, linked_at')
        .eq('profile_id', profileId as string)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

/** Resolves to null when the member closes the ISA sign-in without finishing. */
export const useLinkIsaAccount = (profileId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<IsaAccount | null> => {
      const idToken = await signInToIsa();
      if (!idToken) return null;

      const { data, error } = await supabase.functions.invoke<IsaAccount>(
        'link-isa-account',
        { body: { idToken } },
      );

      if (error) {
        const status =
          error instanceof FunctionsHttpError
            ? (error.context as Response).status
            : undefined;
        throw new IsaLinkError(getIsaLinkErrorKey(status));
      }
      return data;
    },
    onSuccess: (account) => {
      if (!account) return;
      queryClient.setQueryData(
        queryKeys.isaAccount.byProfile(profileId),
        account,
      );
    },
  });
};

export const useUnlinkIsaAccount = (profileId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profile_isa_accounts')
        .delete()
        .eq('profile_id', profileId as string);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.isaAccount.byProfile(profileId), null);
    },
  });
};
