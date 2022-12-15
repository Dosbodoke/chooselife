import { PlusSvg } from '@src/assets';
import { TouchableOpacity } from 'react-native';

interface Props {
  onPress: () => void;
}

const NewLocationButton = ({ onPress }: Props) => {
  return (
    <TouchableOpacity className="w-8 h-8" onPress={onPress}>
      <PlusSvg className="fill-slate-800" />
    </TouchableOpacity>
  );
};

export default NewLocationButton;
