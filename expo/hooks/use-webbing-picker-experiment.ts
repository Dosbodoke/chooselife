import { useQuery } from '@tanstack/react-query';
import {
  getWebbingPickerStorage,
  getWebbingPickerVariant,
} from '~/features/growth/analytics';
import {
  resolveWebbingPickerLayout,
  WEBBING_PICKER_EXPERIMENT,
  WEBBING_PICKER_FALLBACK,
  type WebbingPickerExperiment,
} from '~/features/growth/webbing-picker-layout';

/**
 * Resolve the picker layout when registration opens, so it is usually ready
 * before the sheet is. Until then (max ~1.8 s) the unenrolled fallback is
 * used; the picker locks whichever value it had when the sheet opened.
 * Enrollment itself is sticky in storage, so re-resolving is cheap and safe.
 */
export function useWebbingPickerExperiment(): WebbingPickerExperiment {
  const { data } = useQuery({
    queryKey: ['experiment', WEBBING_PICKER_EXPERIMENT],
    queryFn: () =>
      resolveWebbingPickerLayout(
        getWebbingPickerStorage(),
        getWebbingPickerVariant,
      ),
    // Resolution never throws and reads a stored enrollment offline too.
    networkMode: 'always',
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return data ?? WEBBING_PICKER_FALLBACK;
}
