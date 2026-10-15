import type { RegisteredWebbing } from '@chooselife/ui';

import { WebbingPhotoError } from './photo-upload';
import {
  advanceRegistration,
  continueWithoutPhoto,
  initialRegistrationFlow,
  nextAutoLabel,
  type RegistrationFlowDeps,
} from './registration-flow';

const webbing: RegisteredWebbing = {
  id: 12,
  user_id: 'owner',
  image_path: null,
  registration_key: '86000000-0000-4000-8000-00000000a001',
};
const photo = { uri: 'file:///photo.jpg', mimeType: 'image/jpeg' };

type SavePhoto = RegistrationFlowDeps['savePhoto'];

function deps(overrides: { saveItem?: RegistrationFlowDeps['saveItem'] } = {}) {
  return {
    saveItem: jest.fn(overrides.saveItem ?? (async () => webbing)),
    savePhoto: jest.fn<ReturnType<SavePhoto>, Parameters<SavePhoto>>(
      async () => 'owner/12/photo.jpg',
    ),
  };
}

describe('advanceRegistration', () => {
  it('stays editing and uploads nothing when the item save fails', async () => {
    const d = deps({ saveItem: jest.fn(async () => null) });
    const state = await advanceRegistration(initialRegistrationFlow, photo, d);
    expect(state.phase).toBe('editing');
    expect(state.webbing).toBeNull();
    expect(d.savePhoto).not.toHaveBeenCalled();
  });

  it('saves the item once and retries only the photo', async () => {
    const d = deps();
    d.savePhoto
      .mockRejectedValueOnce(new WebbingPhotoError('upload-failed', 'boom'))
      .mockRejectedValueOnce(new WebbingPhotoError('upload-failed', 'boom'));
    const phases: string[] = [];
    const track = (s: { phase: string }) => phases.push(s.phase);

    let state = await advanceRegistration(
      initialRegistrationFlow,
      photo,
      d,
      track,
    );
    expect(state.phase).toBe('savedPhotoFailed');
    state = await advanceRegistration(state, photo, d, track);
    expect(state.phase).toBe('savedPhotoFailed');
    state = await advanceRegistration(state, photo, d, track);

    expect(state.phase).toBe('completed');
    expect(d.saveItem).toHaveBeenCalledTimes(1);
    expect(d.savePhoto).toHaveBeenCalledTimes(3);
    expect(
      d.savePhoto.mock.calls.every(([input]) => input.webbing.id === 12),
    ).toBe(true);
    expect(phases).toEqual([
      'savingItem',
      'uploadingPhoto',
      'savedPhotoFailed',
      'uploadingPhoto',
      'savedPhotoFailed',
      'uploadingPhoto',
      'completed',
    ]);
  });

  it('carries an unconfirmed pending path into the next photo attempt', async () => {
    const d = deps();
    d.savePhoto.mockRejectedValueOnce(
      new WebbingPhotoError('unconfirmed', 'unknown', 'owner/12/pending.jpg'),
    );
    let state = await advanceRegistration(initialRegistrationFlow, photo, d);
    expect(state).toMatchObject({
      phase: 'photoCommitUnconfirmed',
      pendingPhotoPath: 'owner/12/pending.jpg',
    });
    state = await advanceRegistration(state, photo, d);
    expect(d.savePhoto).toHaveBeenLastCalledWith(
      expect.objectContaining({ pendingPath: 'owner/12/pending.jpg' }),
    );
    expect(state.phase).toBe('completed');
  });

  it('completes directly without a photo and ignores repeated submits', async () => {
    const d = deps();
    const state = await advanceRegistration(initialRegistrationFlow, null, d);
    expect(state.phase).toBe('completed');
    await advanceRegistration(state, null, d);
    await advanceRegistration({ ...state, phase: 'savingItem' }, null, d);
    expect(d.saveItem).toHaveBeenCalledTimes(1);
  });

  it('continues without a photo after a photo failure', () => {
    expect(
      continueWithoutPhoto({
        ...initialRegistrationFlow,
        webbing,
        phase: 'savedPhotoFailed',
      }).phase,
    ).toBe('completed');
    expect(continueWithoutPhoto(initialRegistrationFlow).phase).toBe('editing');
  });
});

describe('nextAutoLabel', () => {
  it('fills a blank label and follows model changes while untouched', () => {
    expect(nextAutoLabel('', null, 'Landcruising Core 2 HS')).toBe(
      'Landcruising Core 2 HS',
    );
    expect(
      nextAutoLabel(
        'Landcruising Core 2 HS',
        'Landcruising Core 2 HS',
        'Balance Sagitta',
      ),
    ).toBe('Balance Sagitta');
    expect(
      nextAutoLabel('Landcruising Core 2 HS', 'Landcruising Core 2 HS', null),
    ).toBe('');
  });

  it('never replaces a label the user customized', () => {
    expect(
      nextAutoLabel('My red line', 'Landcruising Core 2 HS', 'Balance Sagitta'),
    ).toBe('My red line');
    expect(nextAutoLabel('My red line', null, null)).toBe('My red line');
  });
});
