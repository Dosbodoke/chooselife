import { ScrollView, View, Text } from 'react-native';
import ImageHeader from './components/ImageHeader';

import { DetailScreenProps } from '@src/navigation/types';
import FirstCadena from './components/FirstCadena';
import Description from './components/Description';
import HighlineDetails from './components/HighlineDetails';
import Ranking from './components/Ranking';
import Comments from './components/Comments';
import { Divider } from '@src/components';

const DetailScreen = ({ navigation, route }: DetailScreenProps) => {
  const highline = route.params.highline;

  if (!highline) return null;

  return (
    <ScrollView className="flex flex-1">
      <ImageHeader
        isRigged={highline.isRigged}
        goBack={() => navigation.goBack()}
        highlineId={highline.uuid}
      />
      <View className="mx-2">
        <Text className="text-2xl font-extrabold">{highline.name}</Text>
        <FirstCadena />
        <Description
          description={
            "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book."
          }
        />
        <Divider />
        <HighlineDetails highline={highline} />
        <View className="mt-2">
          <Ranking />
        </View>
        <View className="mt-2">
          <Comments />
        </View>
      </View>
    </ScrollView>
  );
};

export default DetailScreen;
