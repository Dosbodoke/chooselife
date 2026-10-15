import type { RegisteredWebbing } from '@chooselife/ui';

import {
  WebbingPhotoError,
  type PhotoAsset,
  type WebbingPhotoErrorCode,
} from './photo-upload';

/**
 * editing -> savingItem -> uploadingPhoto? -> completed
 * with savedPhotoFailed / photoCommitUnconfirmed as recoverable phases.
 * Once an item is saved it is never created again by this flow.
 */
export type RegistrationPhase =
  | 'editing'
  | 'savingItem'
  | 'uploadingPhoto'
  | 'savedPhotoFailed'
  | 'photoCommitUnconfirmed'
  | 'completed';

export interface RegistrationFlowState {
  phase: RegistrationPhase;
  webbing: RegisteredWebbing | null;
  /** Uploaded object whose commit is unconfirmed; reconciled on retry. */
  pendingPhotoPath: string | null;
  photoError: WebbingPhotoErrorCode | null;
}

export const initialRegistrationFlow: RegistrationFlowState = {
  phase: 'editing',
  webbing: null,
  pendingPhotoPath: null,
  photoError: null,
};

export interface RegistrationFlowDeps {
  /** Create or recover the physical item; resolves null when it failed. */
  saveItem: () => Promise<RegisteredWebbing | null>;
  savePhoto: (input: {
    webbing: RegisteredWebbing;
    asset: PhotoAsset;
    pendingPath: string | null;
  }) => Promise<string | null>;
}

const BUSY: RegistrationPhase[] = ['savingItem', 'uploadingPhoto', 'completed'];

/**
 * Advance the flow by one user action (submit or retry photo). Reports every
 * intermediate phase through `onChange` and resolves with the final state.
 */
export async function advanceRegistration(
  state: RegistrationFlowState,
  photo: PhotoAsset | null,
  deps: RegistrationFlowDeps,
  onChange: (state: RegistrationFlowState) => void = () => undefined,
): Promise<RegistrationFlowState> {
  if (BUSY.includes(state.phase)) return state;
  const emit = (next: RegistrationFlowState) => {
    onChange(next);
    return next;
  };

  let current = state;
  if (!current.webbing) {
    current = emit({ ...current, phase: 'savingItem' });
    const webbing = await deps.saveItem();
    if (!webbing) return emit({ ...current, phase: 'editing' });
    current = { ...current, webbing };
  }

  if (!photo) return emit({ ...current, phase: 'completed', photoError: null });

  current = emit({ ...current, phase: 'uploadingPhoto', photoError: null });
  try {
    await deps.savePhoto({
      webbing: current.webbing!,
      asset: photo,
      pendingPath: current.pendingPhotoPath,
    });
    return emit({ ...current, phase: 'completed', pendingPhotoPath: null });
  } catch (error) {
    const code =
      error instanceof WebbingPhotoError ? error.code : 'upload-failed';
    if (code === 'unconfirmed') {
      return emit({
        ...current,
        phase: 'photoCommitUnconfirmed',
        pendingPhotoPath: (error as WebbingPhotoError).pendingPath,
        photoError: code,
      });
    }
    return emit({
      ...current,
      phase: 'savedPhotoFailed',
      pendingPhotoPath: null,
      photoError: code,
    });
  }
}

/** "Continue without photo": the item is already saved. */
export function continueWithoutPhoto(
  state: RegistrationFlowState,
): RegistrationFlowState {
  if (
    state.phase !== 'savedPhotoFailed' &&
    state.phase !== 'photoCommitUnconfirmed'
  ) {
    return state;
  }
  return { ...state, phase: 'completed' };
}

// ============================================================================
// Label suggestion
// ============================================================================

/**
 * Prefill the label only while it is blank or still equals the previous
 * automatic suggestion, so a user-customized label is never overwritten.
 */
export function nextAutoLabel(
  currentLabel: string,
  previousSuggestion: string | null,
  nextSuggestion: string | null,
): string {
  const untouched =
    currentLabel.trim() === '' ||
    (previousSuggestion !== null && currentLabel === previousSuggestion);
  return untouched ? (nextSuggestion ?? '') : currentLabel;
}
