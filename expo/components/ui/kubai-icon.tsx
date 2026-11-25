import type { KubaiIconData } from 'kubai-icons';
import type { LucideProps } from 'lucide-react-native';
import React, { useId, useMemo } from 'react';
import { SvgXml } from 'react-native-svg';

// Kubai's layered icons are drawn on this box and spill past it for the shadow.
const VIEWBOX = '0 -3 31 31';
// Kubai's own default accent, used when no color reaches the icon.
const DEFAULT_COLOR = '#5393FF';

type RGBA = [r: number, g: number, b: number, a: number];

const NAMED_COLORS: Record<string, RGBA> = {
  black: [0, 0, 0, 1],
  white: [255, 255, 255, 1],
  transparent: [0, 0, 0, 0],
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function parseChannel(token: string, scale: number) {
  return token.endsWith('%')
    ? (parseFloat(token) / 100) * scale
    : parseFloat(token);
}

function parseAlpha(token: string | undefined) {
  return token === undefined ? 1 : clamp(parseChannel(token, 1), 0, 1);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function oklchToRgb(l: number, c: number, h: number): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return linear.map((v) => {
    const x = clamp(v, 0, 1);
    const srgb = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
    return srgb * 255;
  }) as [number, number, number];
}

/** Reads the CSS colors the theme hands out: hex, rgb(), hsl(), oklch() and a few names. */
function parseColor(input: string): RGBA | null {
  const value = input.trim().toLowerCase();
  if (NAMED_COLORS[value]) return NAMED_COLORS[value];

  if (value.startsWith('#')) {
    let hex = value.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = [...hex].map((ch) => ch + ch).join('');
    }
    if (hex.length !== 6 && hex.length !== 8) return null;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return [r, g, b, a];
  }

  const fn = /^(rgba?|hsla?|oklch)\((.*)\)$/.exec(value);
  if (!fn) return null;
  const [x, y, z, alpha] = fn[2].split(/[\s,/]+/).filter(Boolean);
  if (z === undefined) return null;

  let rgb: [number, number, number];
  if (fn[1].startsWith('rgb')) {
    rgb = [parseChannel(x, 255), parseChannel(y, 255), parseChannel(z, 255)];
  } else if (fn[1].startsWith('hsl')) {
    rgb = hslToRgb(
      parseFloat(x),
      parseChannel(y.endsWith('%') ? y : `${y}%`, 1),
      parseChannel(z.endsWith('%') ? z : `${z}%`, 1),
    );
  } else {
    rgb = oklchToRgb(
      parseChannel(x, 1),
      parseChannel(y, 0.4),
      parseFloat(z) || 0,
    );
  }
  return [...rgb, parseAlpha(alpha)];
}

function toHex([r, g, b, a]: RGBA) {
  const channels = a < 1 ? [r, g, b, a * 255] : [r, g, b];
  return (
    '#' +
    channels
      .map((v) =>
        Math.round(clamp(v, 0, 255))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** `color-mix(in srgb, A p%, B q%)` once its arguments are plain colors. */
function mixColors(args: string) {
  const [first, second] = args.split(',').map((part) => {
    const [color, percent] = part.trim().split(/\s+/);
    return {
      color: parseColor(color) ?? NAMED_COLORS.black,
      weight: percent === undefined ? undefined : parseFloat(percent) / 100,
    };
  });
  const p =
    first.weight ?? (second.weight === undefined ? 0.5 : 1 - second.weight);
  return toHex(
    first.color.map((v, i) => v * p + second.color[i] * (1 - p)) as RGBA,
  );
}

/**
 * Turns Kubai's web markup (CSS variables, color-mix, inline styles) into plain
 * SVG that react-native-svg can draw, with every tone derived from `color`.
 */
function toNativeSvg(icon: KubaiIconData, color: string, id: string) {
  const accent = toHex(parseColor(color) ?? parseColor(DEFAULT_COLOR)!);
  const variables: Record<string, string> = {
    c: accent,
    e: accent,
    w: '#fff',
    l: '0%',
  };

  let markup = icon.markup.replace(/__K__/g, id);

  // Innermost first, so nested fallbacks collapse to plain values.
  const variable = /var\(--ki-([a-z]+)(?:,([^()]*))?\)/;
  while (variable.test(markup)) {
    markup = markup.replace(
      variable,
      (_, name: string, fallback?: string) =>
        variables[name] ?? fallback ?? accent,
    );
  }
  markup = markup.replace(/currentColor/g, accent);

  const colorMix = /color-mix\(in srgb,([^()]*)\)/;
  while (colorMix.test(markup)) {
    markup = markup.replace(colorMix, (_, args: string) => mixColors(args));
  }

  markup = markup.replace(
    /<([a-zA-Z]+)([^>]*?)(\/?)>/g,
    (_, tag: string, attrs: string, selfClosing: string) => {
      // Motion hooks for the web runtime; nothing reads them here.
      let rest = attrs.replace(/\s(?:class|data-[a-z-]+)="[^"]*"/g, '');
      const style = /\sstyle="([^"]*)"/.exec(rest);
      if (style) {
        rest = rest.replace(style[0], '');
        for (const declaration of style[1].split(';')) {
          const [name, value] = declaration.split(':').map((s) => s.trim());
          if (!name || !value) continue;
          rest =
            rest.replace(new RegExp(`\\s${name}="[^"]*"`), '') +
            ` ${name}="${value}"`;
        }
      }
      return `<${tag}${rest}${selfClosing}>`;
    },
  );

  // react-native-svg has no overlay blend; screen gives the same top highlight.
  markup = markup.replace(/mode="overlay"/g, 'mode="screen"');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" fill="none">${markup}</svg>`;
}

export type KubaiIcon = React.FC<LucideProps>;

/** Wraps a `kubai-icons` icon so it takes the same `size` and `color` as a Lucide icon. */
export function createKubaiIcon(icon: KubaiIconData): KubaiIcon {
  function Component({ size = 24, color }: LucideProps) {
    const id = `ki${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    // Platform colors (PlatformColor) can't be mixed, so they fall back too.
    const accent = typeof color === 'string' ? color : DEFAULT_COLOR;
    const xml = useMemo(() => toNativeSvg(icon, accent, id), [accent, id]);

    return (
      <SvgXml
        xml={xml}
        width={size}
        height={size}
        style={{ overflow: 'visible' }}
      />
    );
  }
  Component.displayName = `Kubai(${icon.name})`;
  return Component;
}
