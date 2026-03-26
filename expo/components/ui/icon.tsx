import { cn } from '~/lib/utils';
import type { LucideIcon, LucideProps } from 'lucide-react-native';
import { useResolveClassNames } from 'uniwind';

type IconProps = LucideProps & {
  as: LucideIcon;
};

function Icon({ as: IconComponent, className, size, color, fill, ...props }: IconProps) {
  const style = useResolveClassNames(cn('text-foreground', className));

  // Direct props take priority over className-resolved values
  const resolvedSize = size ?? (style?.width as number | undefined) ?? (style?.height as number | undefined) ?? 14;
  const resolvedColor = color ?? (style?.color as string | undefined);
  const resolvedFill = fill ?? (style?.fill as string | undefined);

  return (
    <IconComponent
      size={resolvedSize}
      color={resolvedColor}
      {...(resolvedFill ? { fill: resolvedFill } : {})}
      {...props}
    />
  );
}

export { Icon };
