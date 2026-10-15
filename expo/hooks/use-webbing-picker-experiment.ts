import {
  getWebbingPickerStorage,
  getWebbingPickerVariant,
} from '~/features/growth/analytics';
import {
  resolveWebbingPickerLayout,
  WEBBING_PICKER_FALLBACK,
  type WebbingPickerExperiment,
} from '~/features/growth/webbing-picker-layout';
import { useState } from 'react';

import { useMountEffect } from '~/hooks/use-mount-effect';

/**
 * Resolve the picker layout once, when registration opens, so it is usually
 * ready before the sheet is. Until then (max ~1.8 s) the unenrolled fallback
 * is used; the picker locks whichever value it had when the sheet opened.
 */
export function useWebbingPickerExperiment(): WebbingPickerExperiment {
  const [experiment, setExperiment] = useState(WEBBING_PICKER_FALLBACK);

  useMountEffect(() => {
    let mounted = true;
    void resolveWebbingPickerLayout(
      getWebbingPickerStorage(),
      getWebbingPickerVariant,
    ).then((resolved) => {
      if (mounted) setExperiment(resolved);
    });
    return () => {
      mounted = false;
    };
  });

  return experiment;
}
