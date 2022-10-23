import type { Coordinates } from '@src/database';
import { useAppDispatch } from '@src/redux/hooks';
import { highliteMarker, minimizeMarker } from '@src/redux/slices/markerSlice';
import { Marker, Polyline } from 'react-native-maps';

interface Props {
  id: string;
  isHighlited?: boolean;
  coordinateA: Coordinates;
  coordinateB: Coordinates;
}

const HighlineMarker = (props: Props) => {
  const dispatch = useAppDispatch();

  const handleOnPress = () => {
    if (props.isHighlited) {
      dispatch(minimizeMarker());
      return;
    }
    dispatch(
      highliteMarker({
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
