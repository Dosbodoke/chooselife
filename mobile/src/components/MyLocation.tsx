import { TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const SvgComponent = () => {
  return (
    <Svg width="24px" height="24px" viewBox="0 0 24 24">
      <Path
        d="M12 2a.75.75 0 01.743.648l.007.102v1.788a7.5 7.5 0 016.713 6.715l.037-.003h1.75a.75.75 0 01.102 1.493l-.102.007-1.788-.001a7.5 7.5 0 01-6.715 6.714l.003.037v1.75a.75.75 0 01-1.493.102l-.007-.102.001-1.788a7.5 7.5 0 01-6.714-6.715l-.037.003H2.75a.75.75 0 01-.102-1.493l.102-.007h1.788a7.5 7.5 0 016.715-6.713L11.25 4.5V2.75A.75.75 0 0112 2zm0 4a6 6 0 100 12 6 6 0 000-12zm0 2a4 4 0 110 8 4 4 0 010-8z"
        fill="#212121"
        fillRule="nonzero"
        stroke="none"
        strokeWidth={1}
      />
    </Svg>
  );
};

interface MyLocationProps {
  onPress(): void;
}

const MyLocation = ({ onPress }: MyLocationProps) => {
  return (
    <TouchableOpacity
      className="absolute bottom-40 right-2 h-10 w-10 rounded-full bg-gray-100 justify-center items-center"
      onPress={onPress}>
      <SvgComponent />
    </TouchableOpacity>
  );
};

export default MyLocation;
