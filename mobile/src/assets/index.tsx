import Svg, { Path, Circle, SvgProps, LinearGradient, Defs, Stop } from 'react-native-svg';

import MapSatellitePng from './map_satellite.png';
import MapStandardPng from './map_standard.png';
import MapTerrainPng from './map_terrain.png';

export { MapSatellitePng, MapStandardPng, MapTerrainPng };

export const SearchSvg = () => {
  return (
    <Svg viewBox="0 0 24 24" strokeWidth={2.5} className="h-6 w-6 stroke-sky-600">
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
        fill="none"
        fillRule="nonzero"
        stroke="none"
        strokeWidth={1}
        {...props}
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

export const HeartFilledSvg = (props: SvgProps) => (
  // SVG Link => https://www.svgrepo.com/svg/111213/like
  <Svg viewBox="0 0 50 50" {...props}>
    <Path
      fill="#d75a4a"
      d="M24.85 10.126c2.018-4.783 6.628-8.125 11.99-8.125 7.223 0 12.425 6.179 13.079 13.543 0 0 .353 1.828-.424 5.119-1.058 4.482-3.545 8.464-6.898 11.503L24.85 48 7.402 32.165c-3.353-3.038-5.84-7.021-6.898-11.503-.777-3.291-.424-5.119-.424-5.119C.734 8.179 5.936 2 13.159 2c5.363 0 9.673 3.343 11.691 8.126z"
    />
  </Svg>
);

export const HeartOutlinedSvg = (props: SvgProps) => (
  // https://www.svgrepo.com/svg/138916/like
  <Svg viewBox="0 0 51.997 51.997" {...props}>
    <Path
      fill="currentColor"
      d="M51.911 16.242c-.759-8.354-6.672-14.415-14.072-14.415-4.93 0-9.444 2.653-11.984 6.905-2.517-4.307-6.846-6.906-11.697-6.906C6.759 1.826.845 7.887.087 16.241c-.06.369-.306 2.311.442 5.478 1.078 4.568 3.568 8.723 7.199 12.013l18.115 16.439 18.426-16.438c3.631-3.291 6.121-7.445 7.199-12.014.748-3.166.502-5.108.443-5.477zm-2.39 5.019c-.984 4.172-3.265 7.973-6.59 10.985L25.855 47.481 9.072 32.25c-3.331-3.018-5.611-6.818-6.596-10.99-.708-2.997-.417-4.69-.416-4.701l.015-.101c.65-7.319 5.731-12.632 12.083-12.632 4.687 0 8.813 2.88 10.771 7.515l.921 2.183.921-2.183c1.927-4.564 6.271-7.514 11.069-7.514 6.351 0 11.433 5.313 12.096 12.727.002.016.293 1.71-.415 4.707z"
    />
    <Path
      fill="currentColor"
      d="M15.999 7.904c-5.514 0-10 4.486-10 10a1 1 0 1 0 2 0c0-4.411 3.589-8 8-8a1 1 0 1 0 0-2z"
    />
  </Svg>
);

export const PlusSvg = (props: SvgProps) => (
  // https://www.svgrepo.com/svg/2087/plus
  <Svg width="100%" height="100%" viewBox="0 0 45.402 45.402" {...props}>
    <Path d="M41.267 18.557H26.832V4.134A4.127 4.127 0 0 0 22.707 0a4.126 4.126 0 0 0-4.124 4.135v14.432H4.141a4.137 4.137 0 0 0-4.138 4.135 4.143 4.143 0 0 0 1.207 2.934 4.122 4.122 0 0 0 2.92 1.222h14.453V41.27c0 1.142.453 2.176 1.201 2.922a4.11 4.11 0 0 0 2.919 1.211 4.13 4.13 0 0 0 4.129-4.133V26.857h14.435c2.283 0 4.134-1.867 4.133-4.15-.001-2.282-1.852-4.15-4.133-4.15z" />
  </Svg>
);

export const FakeMarkerSvg = (props: SvgProps) => (
  // Created by me on a figma file
  // https://www.figma.com/file/AYTmykfNlzXFHBabLgUq2d/Highline-APP?node-id=312%3A2&t=9Q2PKYNM8aNncYOC-4
  <Svg width={36} height={68} fill="none" {...props}>
    <Path fill="#0284C7" d="M16 35h4v33h-4z" />
    <Circle cx={18} cy={18} r={18} fill="#0284C7" />
    <Circle cx={18} cy={18} r={3} fill="#fff" />
  </Svg>
);

export const ArrowBackCircleSvg = (props: SvgProps) => {
  // icon:arrow-left-circle-fill | Bootstrap https://icons.getbootstrap.com/ | Bootstrap
  return (
    <Svg fill="currentColor" viewBox="0 0 16 16" height="100%" width="100%" {...props}>
      <Path d="M8 0a8 8 0 100 16A8 8 0 008 0zm3.5 7.5a.5.5 0 010 1H5.707l2.147 2.146a.5.5 0 01-.708.708l-3-3a.5.5 0 010-.708l3-3a.5.5 0 11.708.708L5.707 7.5H11.5z" />
    </Svg>
  );
};

export const ArrowBackSvg = (props: SvgProps) => (
  // https://icons.getbootstrap.com/icons/arrow-left-short/
  <Svg height="100%" width="100%" fill="currentColor" viewBox="0 0 16 16" {...props}>
    <Path
      fillRule="evenodd"
      d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5z"
    />
  </Svg>
);

export const ArrowLeftSvg = (props: SvgProps) => {
  // icon:arrow-left-s-line | Remix Icon https://remixicon.com/ | Remix Design
  return (
    <Svg viewBox="0 0 24 24" fill="currentColor" height="100%" width="100%" {...props}>
      <Path d="M10.828 12l4.95 4.95-1.414 1.414L8 12l6.364-6.364 1.414 1.414z" />
    </Svg>
  );
};

export const ImageUploadSvg = (props: SvgProps) => {
  // icon:image-upload | Unicons https://iconscout.com/unicons | Iconscout
  return (
    <Svg viewBox="0 0 24 24" fill="currentColor" height="100%" width="100%" {...props}>
      <Path d="M19 13a1 1 0 00-1 1v.38l-1.48-1.48a2.79 2.79 0 00-3.93 0l-.7.7-2.48-2.48a2.85 2.85 0 00-3.93 0L4 12.6V7a1 1 0 011-1h7a1 1 0 000-2H5a3 3 0 00-3 3v12a3 3 0 003 3h12a3 3 0 003-3v-5a1 1 0 00-1-1zM5 20a1 1 0 01-1-1v-3.57l2.9-2.9a.79.79 0 011.09 0l3.17 3.17 4.3 4.3zm13-1a.89.89 0 01-.18.53L13.31 15l.7-.7a.77.77 0 011.1 0L18 17.21zm4.71-14.71l-3-3a1 1 0 00-.33-.21 1 1 0 00-.76 0 1 1 0 00-.33.21l-3 3a1 1 0 001.42 1.42L18 4.41V10a1 1 0 002 0V4.41l1.29 1.3a1 1 0 001.42 0 1 1 0 000-1.42z" />
    </Svg>
  );
};

export const ShareSvg = (props: SvgProps) => {
  // icon:share | Feathericons https://feathericons.com/ | Cole Bemis
  return (
    <Svg
      fill="none"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      height="100%"
      width="100%"
      {...props}>
      <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
    </Svg>
  );
};

export const GoldenCrownSvg = (props: SvgProps) => {
  // icon:golden-crown-fill | svgrepo https://www.svgrepo.com/svg/410403/crown | svgrepo
  return (
    <Svg width="24px" height="24px" viewBox="0 -6 34 34" {...props}>
      <Defs>
        <LinearGradient x1="50%" y1="0%" x2="50%" y2="100%" id="a">
          <Stop stopColor="#FFC923" offset="0%" />
          <Stop stopColor="#FFAD41" offset="100%" />
        </LinearGradient>
      </Defs>
      <Path
        d="M1480.917 170.22c.422.214.755.57.936 1.007l3.795 9.178 7.796-9.5a2.022 2.022 0 012.813-.293c.47.373.743.936.743 1.531v16.904c0 1.63-1.343 2.953-3 2.953h-28c-1.657 0-3-1.322-3-2.953v-16.904c0-1.088.895-1.97 2-1.97.604 0 1.176.27 1.556.732l7.798 9.5 3.794-9.178a2.01 2.01 0 012.459-1.134l.147.053.163.073z"
        transform="translate(-1513 -2041) translate(50 1871)"
        fill="url(#a)"
        fillRule="nonzero"
        stroke="none"
        strokeWidth={1}
      />
    </Svg>
  );
};
