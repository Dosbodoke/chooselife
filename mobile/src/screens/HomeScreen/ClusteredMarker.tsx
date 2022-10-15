import { View, Text } from 'react-native';
import { Marker } from 'react-native-maps';

interface Props {
  coordinate: { latitude: number; longitude: number };
  pointCount: number;
  size: number;
}

const ClusteredMarker = (props: Props) => {
  return (
    <Marker coordinate={props.coordinate}>
      <View
        className="rounded-full bg-slate-700 flex items-center justify-center"
        style={{ width: props.size, height: props.size }}>
        <Text className="text-white text-center font-bold text-xl">{props.pointCount}</Text>
      </View>
    </Marker>
  );
};

export default ClusteredMarker;
