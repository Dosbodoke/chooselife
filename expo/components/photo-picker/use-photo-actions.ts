import type { LocalPhoto } from '~/features/photos/photo-file';
import { pickPhoto, type PhotoSpec } from '~/features/photos/pick-photo';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isTransferring, type PhotoTransfer } from './use-photo-transfer';

/** Pick, replace and remove; unavailable while a save is in flight. */
export function usePhotoActions({
  spec,
  onChange,
  transfer,
  disabled = false,
}: {
  spec: PhotoSpec;
  onChange: (photo: LocalPhoto | null) => void;
  transfer: PhotoTransfer;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [isPicking, setIsPicking] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const canEdit = !disabled && !isTransferring(transfer) && !isPicking;

  const choose = async () => {
    if (!canEdit) return;
    setIsPicking(true);
    const result = await pickPhoto(spec);
    setIsPicking(false);
    if (result.kind === 'picked') {
      void Haptics.selectionAsync();
      setPickError(null);
      onChange(result.photo);
    } else if (result.kind === 'invalid') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPickError(t(`components.photo-picker.errors.${result.code}`));
    }
  };
  const remove = () => {
    if (!canEdit) return;
    void Haptics.selectionAsync();
    setPickError(null);
    onChange(null);
  };

  return { choose: () => void choose(), remove, canEdit, pickError };
}
