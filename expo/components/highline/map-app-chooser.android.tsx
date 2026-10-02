import {
  AlertDialog,
  Column,
  Host,
  Text,
  TextButton,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  verticalScroll,
} from '@expo/ui/jetpack-compose/modifiers';

import type { MapAppChooserProps } from './map-app-chooser';

export const MapAppChooser = ({
  apps,
  title,
  cancelText,
  onSelect,
  onDismiss,
}: MapAppChooserProps) => (
  <Host matchContents>
    <AlertDialog onDismissRequest={onDismiss}>
      <AlertDialog.Title>
        <Text>{title}</Text>
      </AlertDialog.Title>
      <AlertDialog.Text>
        <Column modifiers={[verticalScroll()]}>
          {apps.map((app) => (
            <TextButton
              key={app.id}
              modifiers={[fillMaxWidth()]}
              onClick={() => onSelect(app)}
            >
              <Text>{app.name}</Text>
            </TextButton>
          ))}
        </Column>
      </AlertDialog.Text>
      <AlertDialog.ConfirmButton>
        <TextButton onClick={onDismiss}>
          <Text>{cancelText}</Text>
        </TextButton>
      </AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>
);
