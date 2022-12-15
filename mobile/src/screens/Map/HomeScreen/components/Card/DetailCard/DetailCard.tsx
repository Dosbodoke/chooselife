import { HeartFilledSvg, HeartOutlinedSvg } from '@src/assets';
import { WINDOW_HEIGHT } from '@src/constants';
import database from '@src/database';
import type { HomeScreenProps } from '@src/navigation/types';
import { useAppDispatch } from '@src/redux/hooks';
import { useState } from 'react';
import { View, Text, Image, ScrollView } from 'react-native';
import {
  Directions,
  Gesture,
  GestureDetector,
  TouchableOpacity,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { HighlitedMarker, minimizeMarker } from '../../../../mapSlice';

type NavigationProp = HomeScreenProps['navigation'];

interface Props {
  highlitedMarker: HighlitedMarker;
  navigation: NavigationProp;
}

const DetailCard = ({ highlitedMarker, navigation }: Props) => {
  const dispatch = useAppDispatch();

  const data = database.highline.find((high) => high.id === highlitedMarker.id);
  const [isFavorite, setIsFavorite] = useState(false);
  const conquerors = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // TO-DO: get array of coquerors, those should be User: {id: string; profilePic: ?}

  const paddingBottom = useSharedValue<null | number>(null);

  const FlingUp = Gesture.Fling()
    .direction(Directions.UP)
    .runOnJS(true)
    .onStart(() => {
      paddingBottom.value = withTiming(WINDOW_HEIGHT, {
        duration: 400,
        easing: Easing.in(Easing.quad),
      });
    })
    .onEnd(() => navigation.navigate('DetailScreen'));

  const FlingDown = Gesture.Fling()
    .direction(Directions.DOWN)
    .runOnJS(true)
    .onEnd(() => dispatch(minimizeMarker()));

  const animatedStyle = useAnimatedStyle(() => ({
    ...(paddingBottom.value !== null && { paddingBottom: paddingBottom.value }),
  }));

  return (
    <GestureDetector gesture={Gesture.Race(FlingUp, FlingDown)}>
      <Animated.View style={animatedStyle}>
        <View className="w-2/12 h-2 bg-slate-300 rounded-md mx-auto mb-3" />
        <View className="flex flex-row ">
          <Image
            className="w-2/6 h-40 rounded-lg object-contain"
            source={{
              uri: 'https://naturalextremo.com/wp-content/uploads/2020/01/Virada-Esportiva-Highline-Natural-Extremo-@angelomaragno-@naturalextremobrasil-14-e1589735926438.jpg',
            }}
          />
          <View className="flex-1 ml-2">
            <View className="flex flex-row">
              <View className="flex-1">
                <Text className="text-xl font-extrabold">{data?.name}</Text>
                <Text className="text-gray-500">altura: {data?.length}</Text>
                <Text className="text-gray-500">comprimento: {data?.height}</Text>
              </View>
              <View>
                <TouchableOpacity className="w-6 h-6" onPress={() => setIsFavorite(!isFavorite)}>
                  {isFavorite ? <HeartFilledSvg /> : <HeartOutlinedSvg />}
                </TouchableOpacity>
                <View
                  className={`mt-2 w-6 h-6 rounded-full ${
                    data?.isRigged ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
              </View>
            </View>
            <View>
              <Text className="text-lg font-bold mt-2">Conquistadores</Text>
              <ScrollView horizontal className="py-2">
                {conquerors.length &&
                  conquerors.map((conquerer, idx) => (
                    <TouchableOpacity
                      key={conquerer}
                      className="w-12 h-12 rounded-full bg-slate-800 mr-1"
                    />
                  ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

export default DetailCard;
