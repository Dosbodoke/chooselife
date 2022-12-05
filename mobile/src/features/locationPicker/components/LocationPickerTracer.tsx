import { FakeMarkerSvg } from '@src/assets';
import { View } from 'react-native';
import { LatLng, Marker, Polyline } from 'react-native-maps';

interface Props {
  coordinate: LatLng;
  anchorA: LatLng;
}

const LocationPickerTracer = ({ coordinate, anchorA }: Props) => {
  return (
    <>
      <Marker coordinate={anchorA}>
        <View>
          <FakeMarkerSvg />
        </View>
      </Marker>
      <Polyline coordinates={[anchorA, coordinate]} strokeWidth={4} />
    </>
  );
};

export default LocationPickerTracer;
