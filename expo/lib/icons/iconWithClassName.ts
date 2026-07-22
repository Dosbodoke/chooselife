import type { Hugeicon } from '~/lib/icons/hugeicons';

export function iconWithClassName(_icon: Hugeicon) {
  // No-op: Hugeicons receive color/size as direct props via the Icon component.
  void _icon;
}
