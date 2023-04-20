import { View, Text, SafeAreaView, ImageBackground, Platform } from 'react-native';
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import GlassButton from './GlassButton';
import { ShareSvg, ArrowLeftSvg } from '@src/assets';
import useIsFavorite from '@src/hooks/useIsFavorite';

interface Props {
  highlineId: string;
  isRigged?: boolean;
  goBack: () => void;
}

const ImageHeader = ({ highlineId, isRigged, goBack }: Props) => {
  const [HeartSvg, toggleFavorite] = useIsFavorite(highlineId);

  return (
    <ImageBackground
      className="h-80"
      resizeMode="cover"
      source={{
        uri: 'https://naturalextremo.com/wp-content/uploads/2020/01/Virada-Esportiva-Highline-Natural-Extremo-@angelomaragno-@naturalextremobrasil-14-e1589735926438.jpg',
      }}>
      <SafeAreaView />
      <View className={`flex flex-1 justify-between ${Platform.OS === 'android' && 'mt-3'}`}>
        <View className="mx-2 flex flex-row justify-between">
          <View>
            <GlassButton
              onPress={() => goBack()}
              children={<ArrowLeftSvg className="text-white" />}
            />
          </View>
          <View className="flex">
            <GlassButton
              onPress={() => toggleFavorite()}
              children={<HeartSvg strokeColor="#fff" strokeWidth={2} />}
            />
            <GlassButton
              onPress={() => {
                // TODO: Share deeplink
                return;
              }}
              children={<ShareSvg />}
            />
          </View>
        </View>

        <View className="relative">
          <LinearGradient
            className="absolute bottom-0 h-10 w-full"
            colors={['transparent', '#333333']}
          />
          <View className="absolute bottom-2 flex w-full flex-row items-center justify-between px-2 ">
            <View className="flex flex-row gap-2">
              <View
                className={`h-6 w-6 rounded-full ${isRigged ? 'bg-green-400' : 'bg-red-500'}`}
              />
              <Text className="text-base text-white">{isRigged ? 'Montada' : 'Desmontada'}</Text>
            </View>
            <View>
              <Text className="font-bold text-white">1/12</Text>
            </View>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
};

export default ImageHeader;
