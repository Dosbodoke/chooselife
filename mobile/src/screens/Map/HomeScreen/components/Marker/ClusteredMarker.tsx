import { View, Text } from 'react-native';
import { Marker } from 'react-native-maps';

interface Props {
  coordinate: { latitude: number; longitude: number };
  pointCount: number;
  size: number;
  onPress: () => void;
}

const ClusteredMarker = (props: Props) => {
  return (
    <Marker coordinate={props.coordinate} onPress={props.onPress}>
      <View
        className="flex items-center justify-center rounded-full bg-slate-700"
        style={{ width: props.size, height: props.size }}>
        <Text className="text-center text-xl font-bold text-white">{props.pointCount}</Text>
      </View>
    </Marker>
  );
};

export default ClusteredMarker;
