import { MapType } from '@src/redux/slices/mapSlice';
import { TouchableOpacity, Text, Image, ImageSourcePropType } from 'react-native';

interface Props {
  onPress: () => void;
  type: MapType;
  selectedType: MapType;
  image: ImageSourcePropType;
  title: string;
}

const TypeButton = ({ onPress, type, selectedType, image, title }: Props) => {
  const highlitedImageStyle = 'border-blue-500 border-2';
  const highlitedTextStyle = 'text-blue-500';
  const isSelected = selectedType === type;

  return (
    <TouchableOpacity onPress={onPress}>
      <Image
        className={`h-20 w-20 rounded-lg ${isSelected && highlitedImageStyle}`}
        source={image}
      />
      <Text className={`text-center my-2 ${isSelected && highlitedTextStyle}`}>{title}</Text>
    </TouchableOpacity>
  );
};

export default TypeButton;
