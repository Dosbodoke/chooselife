import React from 'react';
import { TouchableOpacity } from 'react-native-gesture-handler';

interface Props {
  children: JSX.Element;
  onPress: () => void;
}

const GlassButton = ({ children, onPress }: Props) => {
  return (
    <TouchableOpacity
      className="mb-2 flex h-9 w-9 content-center items-center rounded-full p-1.5"
      style={{ backgroundColor: 'rgba(150, 150, 150, .7)' }}
      onPress={onPress}>
      {children}
    </TouchableOpacity>
  );
};

export default GlassButton;
