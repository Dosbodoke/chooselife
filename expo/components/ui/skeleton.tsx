import { cn } from '~/lib/utils';
import { View, type ViewInstance } from 'react-native';

function Skeleton({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<ViewInstance>) {
  return <View className={cn('bg-accent animate-pulse rounded-md', className)} {...props} />;
}

export { Skeleton };
