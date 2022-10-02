import { Dimensions, View } from 'react-native';
import MapView from 'react-native-maps';

const HomeScreen = () => {
  return (
    <View>
      <MapView
        style={{
          width: Dimensions.get('window').width,
          height: Dimensions.get('window').height,
        }}
        userInterfaceStyle="dark"
      />
    </View>
  );
};

export default HomeScreen;
