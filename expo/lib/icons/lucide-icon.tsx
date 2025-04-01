import { icons } from 'lucide-react-native';

import { iconWithClassName } from './iconWithClassName';

const LucideIcon = ({
  name,
  size,
  strokeWidth = 2,
  className,
}: {
  name: keyof typeof icons;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) => {
  const Icon = icons[name];
  iconWithClassName(Icon);
  return <Icon size={size} strokeWidth={strokeWidth} className={className} />;
};

export { LucideIcon };
