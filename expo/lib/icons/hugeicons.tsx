import {
  Activity01Icon as Activity01IconData,
  Add01Icon as Add01IconData,
  AddCircleIcon as AddCircleIconData,
  Alert02Icon as Alert02IconData,
  AlertCircleIcon as AlertCircleIconData,
  ArrowDown01Icon as ArrowDown01IconData,
  ArrowLeft01Icon as ArrowLeft01IconData,
  ArrowRight01Icon as ArrowRight01IconData,
  ArrowUp01Icon as ArrowUp01IconData,
  BadgeCheckIcon as BadgeCheckIconData,
  Book02Icon as Book02IconData,
  Calendar01Icon as Calendar01IconData,
  Calendar03Icon as Calendar03IconData,
  CalendarCheckIcon as CalendarCheckIconData,
  CalendarClockIcon as CalendarClockIconData,
  CalendarRangeIcon as CalendarRangeIconData,
  Camera01Icon as Camera01IconData,
  Cancel01Icon as Cancel01IconData,
  CancelCircleIcon as CancelCircleIconData,
  ChartUpIcon as ChartUpIconData,
  CheckmarkCircle01Icon as CheckmarkCircle01IconData,
  CheckmarkCircle02Icon as CheckmarkCircle02IconData,
  CircleArrowUp01Icon as CircleArrowUp01IconData,
  Clock01Icon as Clock01IconData,
  CloudIcon as CloudIconData,
  Compass01Icon as Compass01IconData,
  Copy01Icon as Copy01IconData,
  CrownIcon as CrownIconData,
  Delete01Icon as Delete01IconData,
  Delete02Icon as Delete02IconData,
  DropletIcon as DropletIconData,
  EarthIcon as EarthIconData,
  ExternalLinkIcon as ExternalLinkIconData,
  EyeIcon as EyeIconData,
  EyeOffIcon as EyeOffIconData,
  FactoryIcon as FactoryIconData,
  FastWindIcon as FastWindIconData,
  FlashIcon as FlashIconData,
  FootprintsIcon as FootprintsIconData,
  FrownIcon as FrownIconData,
  Gps01Icon as Gps01IconData,
  Gps02Icon as Gps02IconData,
  GripVerticalIcon as GripVerticalIconData,
  HeartIcon as HeartIconData,
  HistoryIcon as HistoryIconData,
  HorizontalResizeIcon as HorizontalResizeIconData,
  InformationCircleIcon as InformationCircleIconData,
  LanguageSkillIcon as LanguageSkillIconData,
  Layers01Icon as Layers01IconData,
  Link01Icon as Link01IconData,
  Location01Icon as Location01IconData,
  LocationOffline01Icon as LocationOffline01IconData,
  Logout01Icon as Logout01IconData,
  MapPinIcon as MapPinIconData,
  MapsIcon as MapsIconData,
  MapsLocation01Icon as MapsLocation01IconData,
  Megaphone01Icon as Megaphone01IconData,
  Message01Icon as Message01IconData,
  MinusSignIcon as MinusSignIconData,
  Moon02Icon as Moon02IconData,
  MountainIcon as MountainIconData,
  Navigation01Icon as Navigation01IconData,
  PackageAdd01Icon as PackageAdd01IconData,
  PencilIcon as PencilIconData,
  PencilRulerIcon as PencilRulerIconData,
  PowerOffIcon as PowerOffIconData,
  RefreshIcon as RefreshIconData,
  RocketIcon as RocketIconData,
  RulerIcon as RulerIconData,
  SatelliteIcon as SatelliteIconData,
  Search01Icon as Search01IconData,
  SecurityCheckIcon as SecurityCheckIconData,
  SentIcon as SentIconData,
  Share03Icon as Share03IconData,
  Shield01Icon as Shield01IconData,
  SparklesIcon as SparklesIconData,
  Sun01Icon as Sun01IconData,
  TentTreeIcon as TentTreeIconData,
  ThermometerIcon as ThermometerIconData,
  ThumbsUpIcon as ThumbsUpIconData,
  Tick01Icon as Tick01IconData,
  Ticket01Icon as Ticket01IconData,
  TorusIcon as TorusIconData,
  Upload04Icon as Upload04IconData,
  UserCircleIcon as UserCircleIconData,
  UserGroupIcon as UserGroupIconData,
  UserMultipleIcon as UserMultipleIconData,
  VerticalResizeIcon as VerticalResizeIconData,
  WifiDisconnected01Icon as WifiDisconnected01IconData,
} from '@hugeicons/core-free-icons';
import {
  HugeiconsIcon,
  type HugeiconsProps,
  type IconSvgElement,
} from '@hugeicons/react-native';
import {
  forwardRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
} from 'react';
import type { Svg } from 'react-native-svg';

export type HugeiconProps = Omit<HugeiconsProps, 'icon'>;
export type Hugeicon = ForwardRefExoticComponent<
  HugeiconProps & RefAttributes<Svg>
>;

function createHugeicon(icon: IconSvgElement, displayName: string): Hugeicon {
  const Component = forwardRef<Svg, HugeiconProps>((props, ref) => (
    <HugeiconsIcon ref={ref} icon={icon} {...props} />
  ));

  Component.displayName = displayName;
  return Component;
}

export const Activity = createHugeicon(Activity01IconData, 'Activity');
export const ActivityIcon = createHugeicon(Activity01IconData, 'ActivityIcon');
export const AlertCircle = createHugeicon(AlertCircleIconData, 'AlertCircle');
export const AlertTriangle = createHugeicon(Alert02IconData, 'AlertTriangle');
export const AlertTriangleIcon = createHugeicon(
  Alert02IconData,
  'AlertTriangleIcon',
);
export const ArrowDownIcon = createHugeicon(
  ArrowDown01IconData,
  'ArrowDownIcon',
);
export const ArrowRightIcon = createHugeicon(
  ArrowRight01IconData,
  'ArrowRightIcon',
);
export const ArrowUpCircle = createHugeicon(
  CircleArrowUp01IconData,
  'ArrowUpCircle',
);
export const BadgeCheckIcon = createHugeicon(
  BadgeCheckIconData,
  'BadgeCheckIcon',
);
export const BookIcon = createHugeicon(Book02IconData, 'BookIcon');
export const CalendarCheck = createHugeicon(
  CalendarCheckIconData,
  'CalendarCheck',
);
export const CalendarCheckIcon = createHugeicon(
  CalendarCheckIconData,
  'CalendarCheckIcon',
);
export const CalendarClockIcon = createHugeicon(
  CalendarClockIconData,
  'CalendarClockIcon',
);
export const CalendarDaysIcon = createHugeicon(
  Calendar01IconData,
  'CalendarDaysIcon',
);
export const CalendarIcon = createHugeicon(Calendar03IconData, 'CalendarIcon');
export const CalendarRangeIcon = createHugeicon(
  CalendarRangeIconData,
  'CalendarRangeIcon',
);
export const CameraIcon = createHugeicon(Camera01IconData, 'CameraIcon');
export const CheckCircle = createHugeicon(
  CheckmarkCircle01IconData,
  'CheckCircle',
);
export const CheckCircle2Icon = createHugeicon(
  CheckmarkCircle02IconData,
  'CheckCircle2Icon',
);
export const CheckIcon = createHugeicon(Tick01IconData, 'CheckIcon');
export const ChevronDownIcon = createHugeicon(
  ArrowDown01IconData,
  'ChevronDownIcon',
);
export const ChevronLeft = createHugeicon(ArrowLeft01IconData, 'ChevronLeft');
export const ChevronLeftIcon = createHugeicon(
  ArrowLeft01IconData,
  'ChevronLeftIcon',
);
export const ChevronRightIcon = createHugeicon(
  ArrowRight01IconData,
  'ChevronRightIcon',
);
export const ChevronUpIcon = createHugeicon(ArrowUp01IconData, 'ChevronUpIcon');
export const CirclePlusIcon = createHugeicon(
  AddCircleIconData,
  'CirclePlusIcon',
);
export const Clock = createHugeicon(Clock01IconData, 'Clock');
export const ClockIcon = createHugeicon(Clock01IconData, 'ClockIcon');
export const CloudIcon = createHugeicon(CloudIconData, 'CloudIcon');
export const Compass = createHugeicon(Compass01IconData, 'Compass');
export const CopyIcon = createHugeicon(Copy01IconData, 'CopyIcon');
export const CrownIcon = createHugeicon(CrownIconData, 'CrownIcon');
export const DropletIcon = createHugeicon(DropletIconData, 'DropletIcon');
export const EarthIcon = createHugeicon(EarthIconData, 'EarthIcon');
export const ExternalLinkIcon = createHugeicon(
  ExternalLinkIconData,
  'ExternalLinkIcon',
);
export const EyeIcon = createHugeicon(EyeIconData, 'EyeIcon');
export const EyeOffIcon = createHugeicon(EyeOffIconData, 'EyeOffIcon');
export const FactoryIcon = createHugeicon(FactoryIconData, 'FactoryIcon');
export const FootprintsIcon = createHugeicon(
  FootprintsIconData,
  'FootprintsIcon',
);
export const FrownIcon = createHugeicon(FrownIconData, 'FrownIcon');
export const GripVerticalIcon = createHugeicon(
  GripVerticalIconData,
  'GripVerticalIcon',
);
export const HeartIcon = createHugeicon(HeartIconData, 'HeartIcon');
export const History = createHugeicon(HistoryIconData, 'History');
export const InfoIcon = createHugeicon(InformationCircleIconData, 'InfoIcon');
export const LanguagesIcon = createHugeicon(
  LanguageSkillIconData,
  'LanguagesIcon',
);
export const LayersIcon = createHugeicon(Layers01IconData, 'LayersIcon');
export const LinkIcon = createHugeicon(Link01IconData, 'LinkIcon');
export const LocateFixedIcon = createHugeicon(Gps02IconData, 'LocateFixedIcon');
export const LocateIcon = createHugeicon(Gps01IconData, 'LocateIcon');
export const LogOutIcon = createHugeicon(Logout01IconData, 'LogOutIcon');
export const MapIcon = createHugeicon(MapsIconData, 'MapIcon');
export const MapPin = createHugeicon(MapPinIconData, 'MapPin');
export const MapPinIcon = createHugeicon(Location01IconData, 'MapPinIcon');
export const MapPinOffIcon = createHugeicon(
  LocationOffline01IconData,
  'MapPinOffIcon',
);
export const MapPinnedIcon = createHugeicon(
  MapsLocation01IconData,
  'MapPinnedIcon',
);
export const MegaphoneIcon = createHugeicon(
  Megaphone01IconData,
  'MegaphoneIcon',
);
export const MessageSquare = createHugeicon(Message01IconData, 'MessageSquare');
export const Minus = createHugeicon(MinusSignIconData, 'Minus');
export const MinusIcon = createHugeicon(MinusSignIconData, 'MinusIcon');
export const MoonStar = createHugeicon(Moon02IconData, 'MoonStar');
export const Mountain = createHugeicon(MountainIconData, 'Mountain');
export const MoveHorizontalIcon = createHugeicon(
  HorizontalResizeIconData,
  'MoveHorizontalIcon',
);
export const MoveVerticalIcon = createHugeicon(
  VerticalResizeIconData,
  'MoveVerticalIcon',
);
export const NavigationIcon = createHugeicon(
  Navigation01IconData,
  'NavigationIcon',
);
export const PackagePlusIcon = createHugeicon(
  PackageAdd01IconData,
  'PackagePlusIcon',
);
export const PencilIcon = createHugeicon(PencilIconData, 'PencilIcon');
export const PencilRulerIcon = createHugeicon(
  PencilRulerIconData,
  'PencilRulerIcon',
);
export const Plus = createHugeicon(Add01IconData, 'Plus');
export const PlusIcon = createHugeicon(Add01IconData, 'PlusIcon');
export const PowerOffIcon = createHugeicon(PowerOffIconData, 'PowerOffIcon');
export const RefreshCw = createHugeicon(RefreshIconData, 'RefreshCw');
export const RefreshCwIcon = createHugeicon(RefreshIconData, 'RefreshCwIcon');
export const Rocket = createHugeicon(RocketIconData, 'Rocket');
export const RulerIcon = createHugeicon(RulerIconData, 'RulerIcon');
export const SatelliteIcon = createHugeicon(SatelliteIconData, 'SatelliteIcon');
export const SearchIcon = createHugeicon(Search01IconData, 'SearchIcon');
export const Send = createHugeicon(SentIconData, 'Send');
export const Share = createHugeicon(Share03IconData, 'Share');
export const ShareIcon = createHugeicon(Share03IconData, 'ShareIcon');
export const Shield = createHugeicon(Shield01IconData, 'Shield');
export const ShieldCheck = createHugeicon(SecurityCheckIconData, 'ShieldCheck');
export const ShieldCheckIcon = createHugeicon(
  SecurityCheckIconData,
  'ShieldCheckIcon',
);
export const ShieldIcon = createHugeicon(Shield01IconData, 'ShieldIcon');
export const Sparkles = createHugeicon(SparklesIconData, 'Sparkles');
export const Sun = createHugeicon(Sun01IconData, 'Sun');
export const SunIcon = createHugeicon(Sun01IconData, 'SunIcon');
export const TentTreeIcon = createHugeicon(TentTreeIconData, 'TentTreeIcon');
export const ThermometerIcon = createHugeicon(
  ThermometerIconData,
  'ThermometerIcon',
);
export const ThumbsUp = createHugeicon(ThumbsUpIconData, 'ThumbsUp');
export const TicketIcon = createHugeicon(Ticket01IconData, 'TicketIcon');
export const TorusIcon = createHugeicon(TorusIconData, 'TorusIcon');
export const Trash2Icon = createHugeicon(Delete02IconData, 'Trash2Icon');
export const TrashIcon = createHugeicon(Delete01IconData, 'TrashIcon');
export const TrendingUp = createHugeicon(ChartUpIconData, 'TrendingUp');
export const TriangleAlertIcon = createHugeicon(
  Alert02IconData,
  'TriangleAlertIcon',
);
export const UploadIcon = createHugeicon(Upload04IconData, 'UploadIcon');
export const UserCircleIcon = createHugeicon(
  UserCircleIconData,
  'UserCircleIcon',
);
export const Users = createHugeicon(UserGroupIconData, 'Users');
export const UsersIcon = createHugeicon(UserGroupIconData, 'UsersIcon');
export const UsersRoundIcon = createHugeicon(
  UserMultipleIconData,
  'UsersRoundIcon',
);
export const WifiOffIcon = createHugeicon(
  WifiDisconnected01IconData,
  'WifiOffIcon',
);
export const Wind = createHugeicon(FastWindIconData, 'Wind');
export const WindIcon = createHugeicon(FastWindIconData, 'WindIcon');
export const X = createHugeicon(Cancel01IconData, 'X');
export const XCircle = createHugeicon(CancelCircleIconData, 'XCircle');
export const XIcon = createHugeicon(Cancel01IconData, 'XIcon');
export const Zap = createHugeicon(FlashIconData, 'Zap');
export const ZapIcon = createHugeicon(FlashIconData, 'ZapIcon');
