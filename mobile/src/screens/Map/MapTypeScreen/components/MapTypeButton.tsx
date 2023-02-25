import { MapType } from '../../mapSlice';
import { View, TouchableOpacity, Text, Image, ImageSourcePropType } from 'react-native';

interface Props {
  onPress: () => void;
  type: MapType;
  selectedType: MapType;
  image: ImageSourcePropType;
  title: string;
}

const MapTypeButton = ({ onPress, type, selectedType, image, title }: Props) => {
  const highlitedImageStyle = 'border-blue-500 border-2';
  const highlitedTextStyle = 'text-blue-500';
  const isSelected = selectedType === type;

  return (
    <TouchableOpacity onPress={onPress}>
      <View className={`h-20 w-20 rounded-lg ${isSelected && highlitedImageStyle}`}>
        <Image className="h-full w-full" source={image} />
      </View>
      <Text className={`my-2 text-center ${isSelected && highlitedTextStyle}`}>{title}</Text>
    </TouchableOpacity>
  );
};

export default MapTypeButton;
