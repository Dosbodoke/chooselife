import type { LocalPhoto } from '~/features/photos/photo-file';
import { PHOTO_SPECS, type PhotoSpec } from '~/features/photos/pick-photo';
import { ImagePlusIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { cn } from '~/lib/utils';

import { Icon } from '~/components/ui/icon';

import { usePhotoActions } from './use-photo-actions';
import type { PhotoTransfer } from './use-photo-transfer';

const translationKey = 'components.photo-picker';

/**
 * Adds a personal photo where a picture is already shown nearby, like a
 * model photo in the group heading: an icon, not an empty frame. Once a
 * photo is picked, the row shows a `PhotoTile` instead.
 */
export function PhotoAddButton({
  spec = PHOTO_SPECS.webbing,
  onChange,
  transfer,
  disabled,
  name,
}: {
  spec?: PhotoSpec;
  onChange: (photo: LocalPhoto | null) => void;
  transfer: PhotoTransfer;
  disabled?: boolean;
  /** What the photo shows, for accessibility labels. */
  name: string;
}) {
  const { t } = useTranslation();
  const actions = usePhotoActions({ spec, onChange, transfer, disabled });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(`${translationKey}.a11y.addFor`, { name })}
      accessibilityState={{ disabled: !actions.canEdit }}
      disabled={!actions.canEdit}
      onPress={actions.choose}
      className="size-11 items-center justify-center rounded-full active:bg-muted"
    >
      <Icon
        as={ImagePlusIcon}
        size={18}
        className={cn(
          'text-muted-foreground',
          !actions.canEdit && 'opacity-40',
        )}
      />
    </Pressable>
  );
}
