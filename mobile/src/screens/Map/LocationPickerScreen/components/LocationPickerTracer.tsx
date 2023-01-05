import { FakeMarkerSvg } from '@src/assets';
import { LatLng, Marker, Polyline } from 'react-native-maps';

interface Props {
  markers: LatLng[];
  center: LatLng;
}

const LocationPickerTracer = ({ markers, center }: Props) => {
  return (
    <>
      <Marker coordinate={markers[0]}>
        <FakeMarkerSvg />
      </Marker>
      {markers.length === 2 ? (
        <>
          <Marker coordinate={markers[1]}>
            <FakeMarkerSvg />
          </Marker>
          <Polyline coordinates={markers} strokeWidth={4} />
        </>
      ) : (
        <Polyline coordinates={[markers[0], center]} strokeWidth={4} />
      )}
    </>
  );
};

export default LocationPickerTracer;
