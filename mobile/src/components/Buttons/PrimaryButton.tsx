import { TouchableOpacity, Text } from 'react-native';

interface Props {
  label: string;
  onPress: () => void;
}

const PrimaryButton = ({ label, onPress }: Props) => {
  return (
    <TouchableOpacity
      className="mt-4 flex items-center justify-center rounded-lg bg-blue-600 py-3"
      onPress={onPress}>
      <Text className="text-base font-bold text-white">{label}</Text>
    </TouchableOpacity>
  );
};

export default PrimaryButton;
