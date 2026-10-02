import type { GetAppsResponse } from 'react-native-map-link';

export interface MapAppChooserProps {
  apps: GetAppsResponse[];
  title: string;
  cancelText: string;
  onSelect: (app: GetAppsResponse) => void;
  onDismiss: () => void;
}

// iOS uses ActionSheetIOS directly. This card is only displayed on native maps.
export const MapAppChooser: (props: MapAppChooserProps) => null = () => null;
