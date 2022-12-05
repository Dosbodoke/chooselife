import { Dimensions } from 'react-native';

const MIN_MARKER_SIZE = 30;
const WINDOW_HEIGHT = Dimensions.get('window').height;

const INITIAL_REGION = {
  latitude: -15.7782081,
  longitude: -47.93371,
  latitudeDelta: 80,
  longitudeDelta: 80,
};

export { MIN_MARKER_SIZE, WINDOW_HEIGHT, INITIAL_REGION };
