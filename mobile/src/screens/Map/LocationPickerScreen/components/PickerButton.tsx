import { LinearGradient } from 'expo-linear-gradient';
import { TouchableOpacity, Text, View } from 'react-native';

interface Props {
  markersLength: number;
  onPress: () => void;
}

const PickerButton = ({ markersLength, onPress }: Props) => {
  function renderText() {
    switch (markersLength) {
      case 0:
        return 'DEFINIR ANCORAGEM A';
      case 1:
        return 'DEFINIR ANCORAGEM B';
      case 2:
        return 'CONCLUIR';
    }
  }

  return (
    <TouchableOpacity
      className="absolute bottom-8 left-1/2 trasnform -translate-x-28"
      onPress={onPress}>
      <LinearGradient
        className="w-56 rounded-lg"
        colors={['#4caf50', '#2196f3']}
        start={{ x: -1, y: 1 }}
        end={{ x: 3, y: 4 }}>
        <Text className="text-white text-base font-bold text-center my-4">{renderText()}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

export default PickerButton;
