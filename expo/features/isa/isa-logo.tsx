// Artwork from the International Slackline Association's isa-users repo
// (web/public/images/logo-regular.svg). Paths are copied verbatim; IsaMark
// only crops the viewBox to the "ISA" glyph.
import * as React from 'react';
import Svg, { Path, type SvgProps } from 'react-native-svg';

export const ISA_TEAL = '#00A099';
export const ISA_RED = '#E74027';

type IsaLogoProps = SvgProps & {
  /** Paint every path one colour (e.g. white on a brand background). */
  color?: string;
};

const palette = (color?: string): Record<string, string> => ({
  '#00A099': color ?? ISA_TEAL,
  '#E74027': color ?? ISA_RED,
});

/** The ISA glyph on its own, for icon-sized slots. */
export const IsaMark = ({ color, ...props }: IsaLogoProps) => {
  const c = palette(color);
  return (
    <Svg viewBox="34 0 427 156" {...props}>
      <Path
        d="M115.552 26.691V0.0019989H34.896L115.552 26.691Z"
        fill={c['#00A099']}
      />
      <Path
        d="M270.464 77.953H312.783L358.784 0H162.532C144.2 0 128.833 12.66 124.672 29.709L270.464 77.953Z"
        fill={c['#00A099']}
      />
      <Path
        d="M368.078 110.256L425.174 96.75L368.078 0.00100708L313.643 92.242L368.078 110.256Z"
        fill={c['#00A099']}
      />
      <Path
        d="M265.006 84.15L123.596 37.355C123.574 37.894 123.555 38.433 123.555 38.976C123.555 60.496 140.994 77.943 162.512 77.953H123.555V155.906H243.805V155.902C243.848 155.904 243.89 155.906 243.932 155.906C265.459 155.906 282.909 138.455 282.909 116.929C282.91 103.17 275.773 91.086 265.006 84.15Z"
        fill={c['#E74027']}
      />
      <Path
        d="M34.885 8V155.906H115.552V34.693L34.885 8Z"
        fill={c['#E74027']}
      />
      <Path
        d="M368.078 118.26L309.692 98.94L276.075 155.907C436.143 155.907 299.18 155.907 460.082 155.907L429.318 103.776L368.078 118.26Z"
        fill={c['#E74027']}
      />
    </Svg>
  );
};
