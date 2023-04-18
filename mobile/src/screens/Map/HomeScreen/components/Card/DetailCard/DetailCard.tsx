import { useEffect } from 'react';
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

import { WINDOW_HEIGHT } from '@src/constants';
import useLastHighline from '@src/hooks/useLastHighline';
import useIsFavorite from '@src/hooks/useIsFavorite';
import type { HomeScreenProps } from '@src/navigation/types';
import { useAppDispatch } from '@src/redux/hooks';
import { trpc } from '@src/utils/trpc';

import { HighlitedMarker, minimizeMarker } from '../../../../mapSlice';

type NavigationProp = HomeScreenProps['navigation'];

interface Props {
  highlitedMarker: HighlitedMarker;
  navigation: NavigationProp;
}

const DetailCard = ({ highlitedMarker, navigation }: Props) => {
  const dispatch = useAppDispatch();
  const { updateStorageWithNewHighline } = useLastHighline();
  const [HeartSvg, toggleFavorite] = useIsFavorite(highlitedMarker.id);

  const { data: highline, isFetchedAfterMount } = trpc.highline.getById.useQuery(
    highlitedMarker.id
  );

  useEffect(() => {
    if (!highline) return;
    updateStorageWithNewHighline({
      name: highline.name,
      height: highline.height,
      length: highline.length,
      id: highline.uuid,
      coords: highlitedMarker.coords,
    });
  }, [isFetchedAfterMount]);

  const conquerors = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // TO-DO: get array of coquerors, those should be User: {id: string; profilePic: ?}

  const paddingBottom = useSharedValue<number>(0);

  const FlingUp = Gesture.Fling()
    .direction(Directions.UP)
    .runOnJS(true)
    .onStart(() => {
      paddingBottom.value = withTiming(WINDOW_HEIGHT, {
        duration: 400,
        easing: Easing.in(Easing.quad),
      });
    })
    .onEnd(() => {
      if (!highline) return;
      navigation.navigate('Details', { highline });
    });

  const FlingDown = Gesture.Fling()
    .direction(Directions.DOWN)
    .runOnJS(true)
    .onEnd(() => dispatch(minimizeMarker()));

  const animatedStyle = useAnimatedStyle(() => ({
    paddingBottom: paddingBottom.value,
  }));

  return (
    <GestureDetector gesture={Gesture.Race(FlingUp, FlingDown)}>
      <Animated.View style={animatedStyle}>
        <View className="mx-auto mb-3 h-2 w-2/12 rounded-md bg-slate-300" />
        <View className="flex flex-row ">
          <Image
            className="h-40 w-2/6 rounded-lg object-contain"
            source={{
              uri: 'https://naturalextremo.com/wp-content/uploads/2020/01/Virada-Esportiva-Highline-Natural-Extremo-@angelomaragno-@naturalextremobrasil-14-e1589735926438.jpg',
            }}
          />
          <View className="ml-2 flex-1">
            <View className="flex flex-row">
              <View className="flex-1">
                <Text className="text-xl font-extrabold">{highline?.name}</Text>
                <Text className="text-gray-500">altura: {highline?.length}</Text>
                <Text className="text-gray-500">comprimento: {highline?.height}</Text>
              </View>
              <View>
                <TouchableOpacity className="h-6 w-6" onPress={() => toggleFavorite()}>
                  {<HeartSvg strokeColor="#000" />}
                </TouchableOpacity>
                <View
                  className={`mt-2 h-6 w-6 rounded-full ${
                    highline?.isRigged ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
              </View>
            </View>
            <View>
              <Text className="mt-2 text-lg font-bold">Conquistadores</Text>
              <ScrollView horizontal className="py-2">
                {conquerors.length &&
                  conquerors.map((conquerer) => (
                    <TouchableOpacity
                      key={conquerer}
                      className="mr-1 h-12 w-12 rounded-full bg-slate-800"
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
