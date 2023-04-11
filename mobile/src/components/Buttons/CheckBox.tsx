import { TouchableOpacity, View, Text } from 'react-native';

import { CheckSvg } from '@src/assets';

interface Props {
  onToggle: () => void;
  isChecked: boolean;
  label: string;
}

const CheckBox = ({ onToggle, isChecked, label }: Props) => {
  return (
    <TouchableOpacity
      className="flex flex-row items-end"
      style={{ columnGap: 8 }}
      onPress={onToggle}>
      <View
        className={`h-5 w-5 items-center justify-center rounded-md ${
          isChecked ? 'bg-blue-600' : 'border-[1px] border-gray-300 bg-gray-100 '
        }`}>
        {isChecked ? <CheckSvg fill="#fff" width="70%" height="70%" /> : null}
      </View>
      <Text className="text-gray-500">{label}</Text>
    </TouchableOpacity>
  );
};

export default CheckBox;
