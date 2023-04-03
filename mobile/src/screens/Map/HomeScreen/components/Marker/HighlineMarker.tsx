import type { LatLng } from 'react-native-maps';
import { useAppDispatch } from '@src/redux/hooks';
import { Marker, Polyline } from 'react-native-maps';

import { highlightMarker, minimizeMarker } from '../../../mapSlice';

interface Props {
  id: string;
  isHighlited?: boolean;
  coordinateA: LatLng;
  coordinateB: LatLng;
}

const HighlineMarker = (props: Props) => {
  const dispatch = useAppDispatch();

  const handleOnPress = () => {
    if (props.isHighlited) {
      dispatch(minimizeMarker());
      return;
    }
    dispatch(
      highlightMarker({
        type: 'Highline',
        id: props.id,
        coords: [props.coordinateA, props.coordinateB],
      })
    );
  };

  return (
    <>
      <Marker coordinate={props.coordinateA} onPress={handleOnPress} />
      {props.isHighlited && (
        <>
          <Marker coordinate={props.coordinateB} onPress={handleOnPress} />
          <Polyline coordinates={[props.coordinateA, props.coordinateB]} strokeWidth={3} />
        </>
      )}
    </>
  );
};

export default HighlineMarker;
