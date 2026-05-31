import type { QueryClient } from '@tanstack/react-query';

import { leaderboardKeys } from '~/hooks/use-leaderboard';
import { supabase } from '~/lib/supabase';
import { transformTimeStringToSeconds } from '~/utils';

export const registerHighlineWalkMutationKey = [
  'register-highline-walk',
] as const;

export interface RegisterHighlineWalkFormData {
  username: string;
  cadenas: number;
  full_lines: number;
  distance: number;
  time?: string;
  witness: string[];
  comment: string;
}

export interface RegisterHighlineWalkVariables {
  entryId: string;
  highlineId: string;
  formData: RegisterHighlineWalkFormData;
}

export async function registerHighlineWalk({
  entryId,
  formData,
  highlineId,
}: RegisterHighlineWalkVariables) {
  const response = await supabase.from('entry').insert({
    id: entryId,
    highline_id: highlineId,
    instagram: formData.username.trim(),
    cadenas: formData.cadenas,
    full_lines: formData.full_lines,
    distance_walked: formData.distance,
    crossing_time: formData.time
      ? transformTimeStringToSeconds(formData.time)
      : null,
    comment: formData.comment,
    witness: formData.witness,
    is_highliner: true,
  });

  if (response.error && response.error.code !== '23505') {
    throw new Error(response.error.message);
  }

  return response.data;
}

export function invalidateHighlineWalkLeaderboards(
  queryClient: QueryClient,
  highlineId: string,
) {
  for (const type of ['cadenas', 'distance', 'fullLine', 'speedline'] as const) {
    void queryClient.invalidateQueries({
      queryKey: leaderboardKeys.list({
        type,
        highlinesID: [highlineId],
      }),
    });
  }
}
