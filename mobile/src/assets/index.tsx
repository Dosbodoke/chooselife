import Svg, { Path, SvgProps } from 'react-native-svg';

import MapSatellitePng from './map_satellite.png';
import MapStandardPng from './map_standard.png';
import MapTerrainPng from './map_terrain.png';

export { MapSatellitePng, MapStandardPng, MapTerrainPng };

export const SearchSvg = () => {
  return (
    <Svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      className="w-6 h-6">
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </Svg>
  );
};

export const HistorySvg = () => {
  return (
    <Svg
      className="text-gray-400"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round">
      <Path d="M3 3v5h5" />
      <Path d="M3.05 13A9 9 0 106 5.3L3 8" />
      <Path d="M12 7v5l4 2" />
    </Svg>
  );
};

export const HeightSvg = () => {
  return (
    <Svg className="text-gray-500" width="24px" height="24px" viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22V2m0 20l-4-4m4 4l4-4M12 2L8 6m4-4l4 4"
        stroke="#6B7280"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export const LengthSvg = () => {
  return (
    <Svg width="24px" height="24px" viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 12H2m20 0l-4 4m4-4l-4-4M2 12l4 4m-4-4l4-4"
        stroke="#6B7280"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export const MyLocationSvg = (props: SvgProps) => {
  return (
    <Svg width="24px" height="24px" viewBox="0 0 24 24" {...props}>
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

export const MapTypeSvg = (props: SvgProps) => {
  return (
    <Svg width="20px" height="20px" viewBox="0 0 16 16" {...props}>
      <Path fill="none" d="M0 0H16V16H0z" />
      <Path
        fill="#212121"
        d="M8 9L0 5l8-4 8 4-8 4zm6.397-1.8L16 8l-8 4-8-4 1.603-.8L8 10.397 14.397 7.2zm0 3L16 11l-8 4-8-4 1.603-.8L8 13.397l6.397-3.197z"
      />
    </Svg>
  );
};

export const HeartFilledSvg = () => (
  // SVG Link => https://www.svgrepo.com/svg/111213/like
  <Svg viewBox="0 0 50 50">
    <Path
      fill="#d75a4a"
      d="M24.85 10.126c2.018-4.783 6.628-8.125 11.99-8.125 7.223 0 12.425 6.179 13.079 13.543 0 0 .353 1.828-.424 5.119-1.058 4.482-3.545 8.464-6.898 11.503L24.85 48 7.402 32.165c-3.353-3.038-5.84-7.021-6.898-11.503-.777-3.291-.424-5.119-.424-5.119C.734 8.179 5.936 2 13.159 2c5.363 0 9.673 3.343 11.691 8.126z"
    />
  </Svg>
);

export const HeartOutlinedSvg = () => (
  // https://www.svgrepo.com/svg/138916/like
  <Svg viewBox="0 0 51.997 51.997">
    <Path
      fill="#000"
      d="M51.911 16.242c-.759-8.354-6.672-14.415-14.072-14.415-4.93 0-9.444 2.653-11.984 6.905-2.517-4.307-6.846-6.906-11.697-6.906C6.759 1.826.845 7.887.087 16.241c-.06.369-.306 2.311.442 5.478 1.078 4.568 3.568 8.723 7.199 12.013l18.115 16.439 18.426-16.438c3.631-3.291 6.121-7.445 7.199-12.014.748-3.166.502-5.108.443-5.477zm-2.39 5.019c-.984 4.172-3.265 7.973-6.59 10.985L25.855 47.481 9.072 32.25c-3.331-3.018-5.611-6.818-6.596-10.99-.708-2.997-.417-4.69-.416-4.701l.015-.101c.65-7.319 5.731-12.632 12.083-12.632 4.687 0 8.813 2.88 10.771 7.515l.921 2.183.921-2.183c1.927-4.564 6.271-7.514 11.069-7.514 6.351 0 11.433 5.313 12.096 12.727.002.016.293 1.71-.415 4.707z"
    />
    <Path
      fill="#000"
      d="M15.999 7.904c-5.514 0-10 4.486-10 10a1 1 0 1 0 2 0c0-4.411 3.589-8 8-8a1 1 0 1 0 0-2z"
    />
  </Svg>
);
