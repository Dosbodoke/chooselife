import type { Coordinates } from '@src/database';
import { useState } from 'react';
import { Marker, Polyline } from 'react-native-maps';


interface Props {
  coordinateA: Coordinates;
  coordinateB: Coordinates;
  fitMapToPolyline: (coords: Coordinates[]) => void;
}

const HighlineMarker = (props: Props) => {
  const [showAnchorB, setShowAnchorB] = useState(false);

  const handleOnPress = () => {
    setShowAnchorB((prev) => !prev);
    props.fitMapToPolyline([props.coordinateA, props.coordinateB]);
  };

  return (
    <>
      <Marker coordinate={props.coordinateA} onPress={handleOnPress} />
      {showAnchorB && (
        <>
          <Marker coordinate={props.coordinateB} />
          <Polyline coordinates={[props.coordinateA, props.coordinateB]} strokeWidth={3} />
        </>
      )}
    </>
  );
};

export default HighlineMarker;
