import { Text, View } from 'react-native';
import Svg, { Circle, Path, SvgProps } from 'react-native-svg';

export const FakeMarkerSvg: React.FC = (props: SvgProps) => (
  // Created by me on a figma file
  // https://www.figma.com/file/AYTmykfNlzXFHBabLgUq2d/Highline-APP?node-id=312%3A2&t=9Q2PKYNM8aNncYOC-4
  <Svg width={36} height={68} fill="none" {...props}>
    <Path fill="#0284C7" d="M16 35h4v33h-4z" />
    <Circle cx={18} cy={18} r={18} fill="#0284C7" />
    <Circle cx={18} cy={18} r={3} fill="#fff" />
  </Svg>
);

const FakeMarker: React.FC<{ distance: number | undefined }> = ({
  distance,
}) => {
  return (
    <View
      pointerEvents="none"
      className="absolute bottom-1/2 flex w-full items-center justify-center"
    >
      {distance !== undefined && (
        <View className="mb-1 rounded-md bg-slate-600 py-1 px-2">
          <Text className="text-white">{distance}m</Text>
        </View>
      )}
      <FakeMarkerSvg />
    </View>
  );
};

export default FakeMarker;
