import { FakeMarkerSvg } from '@src/assets';
import { LatLng, Marker, Polyline } from 'react-native-maps';

interface Props {
  center: LatLng;
  anchorA: LatLng;
}

const LocationPickerTracer = ({ center, anchorA }: Props) => {
  return (
    <>
      <Marker coordinate={anchorA}>
        <FakeMarkerSvg />
      </Marker>
      <Polyline coordinates={[anchorA, center]} strokeWidth={4} />
    </>
  );
};

export default LocationPickerTracer;
