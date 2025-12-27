import { MapToggle as BaseMapToggle } from './map-toggle-button';
import React from 'react';

interface MapToggleProps {
  onPress: () => void;
}

export const MapToggle: React.FC<MapToggleProps> = ({ onPress }) => {
  return <BaseMapToggle onPress={onPress} />;
};
