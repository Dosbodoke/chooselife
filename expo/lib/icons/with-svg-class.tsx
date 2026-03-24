import { useResolveClassNames } from 'uniwind';
import type { SvgProps } from 'react-native-svg';
import type { ComponentType } from 'react';

/**
 * Wraps an SVG component to support `className` for color, fill, width, and height.
 * Unlike `withUniwind`, this extracts style props and passes them as SVG props.
 */
export function withSvgClass<P extends SvgProps>(
  Component: ComponentType<P>,
) {
  function Wrapped({ className, ...props }: P & { className?: string }) {
    const style = useResolveClassNames(className ?? '');
    const svgProps = {
      ...props,
      ...(style?.color && !props.color ? { color: style.color } : {}),
      ...(style?.fill && !props.fill ? { fill: style.fill as string } : {}),
      ...(style?.width && !props.width ? { width: style.width } : {}),
      ...(style?.height && !props.height ? { height: style.height } : {}),
      ...(style?.opacity != null && props.opacity == null ? { opacity: style.opacity } : {}),
    } as P;
    return <Component {...svgProps} />;
  }
  Wrapped.displayName = `withSvgClass(${Component.displayName || Component.name || 'Component'})`;
  return Wrapped;
}
