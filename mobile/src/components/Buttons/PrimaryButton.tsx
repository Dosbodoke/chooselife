import { TouchableOpacity, Text } from 'react-native';

interface Props {
  label: string;
  isDisabled?: boolean;
  onPress: () => void;
}

const PrimaryButton = ({ label, isDisabled, onPress }: Props) => {
  return (
    <TouchableOpacity
      className={`flex items-center justify-center rounded-lg py-3 ${
        isDisabled ? 'bg-blue-400' : 'bg-blue-600'
      }`}
      disabled={isDisabled}
      onPress={onPress}>
      <Text className="text-base font-bold text-white">{label}</Text>
    </TouchableOpacity>
  );
};

export default PrimaryButton;
