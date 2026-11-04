import { isSafeExternalUrl } from '@chooselife/ui';
import { Linking } from 'react-native';

/** Open an http(s) link from catalog data; anything else is ignored. */
export function openExternal(url: string | null | undefined) {
  if (isSafeExternalUrl(url)) void Linking.openURL(url);
}
