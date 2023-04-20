import { LinearGradient } from 'expo-linear-gradient';
import { TouchableOpacity, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { ResetSvg } from '@src/assets';

interface Props {
  markersLength: number;
  onPress: () => void;
  reset: () => void;
}

const PickerButton = ({ markersLength, onPress, reset }: Props) => {
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
    <View className="trasnform absolute bottom-8 left-1/2 flex -translate-x-28 flex-row items-center">
      <Animated.View>
        <TouchableOpacity onPress={onPress}>
          <LinearGradient
            className="w-56 rounded-lg"
            colors={['#4caf50', '#2196f3']}
            start={{ x: -1, y: 1 }}
            end={{ x: 3, y: 4 }}>
            <Text className="my-4 text-center text-base font-bold text-white">{renderText()}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
      {markersLength !== 0 && (
        <Animated.View
          className="ml-5 h-9 w-14 rounded-lg bg-neutral-200"
          entering={FadeInDown}
          exiting={FadeOutDown}>
          <TouchableOpacity onPress={reset}>
            <ResetSvg className="text-gray-600" />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

export default PickerButton;
