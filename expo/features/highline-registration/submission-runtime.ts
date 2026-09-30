import { decode } from 'base64-arraybuffer';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { deleteFromR2, uploadToR2 } from '~/lib/r2';
import { supabase } from '~/lib/supabase';

import {
  HighlineSubmissionError,
  submitHighlineRegistration,
  validateSubmissionOwner,
  type SerializedSubmissionVariables,
  type SubmissionDependencies,
  type SubmissionResult,
} from './submission';

export async function readStagedHighlineImage(
  localUri: string,
): Promise<ArrayBuffer> {
  const path = localUri.replace(/^file:\/\//, '');
  const base64 = await ReactNativeBlobUtil.fs.readFile(path, 'base64');
  return decode(base64);
}

export const defaultSubmissionDependencies: SubmissionDependencies = {
  readImage: readStagedHighlineImage,
  uploadImage: uploadToR2,
  deleteImage: deleteFromR2,
  insertHighline: async (payload) => {
    const response = await supabase
      .from('highline')
      .insert(payload)
      .select('id')
      .single();

    return {
      data: response.data,
      error: response.error,
    };
  },
};

export function submitHighlineRegistrationOnline(
  variables: SerializedSubmissionVariables,
): Promise<SubmissionResult> {
  return submitHighlineRegistrationAfterOwnerCheck(variables);
}

async function submitHighlineRegistrationAfterOwnerCheck(
  variables: SerializedSubmissionVariables,
): Promise<SubmissionResult> {
  const { data } = await supabase.auth.getSession();
  const ownerError = validateSubmissionOwner(
    variables,
    data.session?.user.id ?? null,
  );
  if (ownerError) throw new HighlineSubmissionError(ownerError);

  return submitHighlineRegistration(variables, defaultSubmissionDependencies);
}
