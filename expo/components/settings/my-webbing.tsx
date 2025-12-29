import { Link } from 'expo-router';
import {
  FactoryIcon,
  FrownIcon,
  LayersIcon,
  LinkIcon,
  MoveHorizontalIcon,
  PlusIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';

import { useWebbingUsage, getTranslatedStatus } from '@chooselife/ui';
import { getWebbingName, useUserWebbings } from '~/hooks/use-webbings';
import { Tables } from '~/utils/database.types';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';
import { WebbingCardBackground } from '~/components/webbing-card-background';

import { Skeleton } from '../ui/skeleton';

type WebbingWithModel = Tables<'webbing'> & {
  model: Tables<'webbing_model'> | null;
};

const MyWebbings: React.FC = () => {
  const { t } = useTranslation();
  const { data: webbings, isPending } = useUserWebbings();

  return (
    <Card className="overflow-hidden relative min-h-[140px]">
      <WebbingCardBackground />

      <CardHeader className="relative z-10">
        <View className="flex-row items-center justify-between gap-4">
          <View className="flex-1 gap-1">
            <CardTitle className="text-xl tracking-tight">
              {t('components.settings.my-webbing.title')}
            </CardTitle>
            <CardDescription className="text-sm leading-snug">
              {t('components.settings.my-webbing.description')}
            </CardDescription>
          </View>
          <Link asChild href={`/(modals)/register-webbing`}>
            <TouchableOpacity 
              activeOpacity={0.7}
              className="flex-row items-center gap-1.5 px-3 py-2 bg-primary/10 rounded-full border border-primary/20"
            >
              <Icon as={PlusIcon} size={16} className="text-primary" />
              <Text className="text-xs font-bold text-primary uppercase tracking-wide">
                {t('components.settings.my-webbing.add')}
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </CardHeader>
      <CardContent className="relative z-10">
        {isPending ? (
          <View className="gap-2">
            <SkeletonWebbingitem />
            <SkeletonWebbingitem />
            <SkeletonWebbingitem />
          </View>
        ) : webbings && webbings?.length > 0 ? (
          <WebbingList webbings={webbings} />
        ) : (
          <EmptyWebbing />
        )}
      </CardContent>
    </Card>
  );
};

const EmptyWebbing: React.FC = () => {
  const { t } = useTranslation();
  return (
    <View className="justify-center items-center py-6 gap-3">
      <View className="w-16 h-16 rounded-full bg-muted items-center justify-center">
        <Icon
          as={FrownIcon}
          size={32}
          className="text-muted-foreground"
          strokeWidth={1.5}
        />
      </View>
      <Text className="text-muted-foreground text-center">
        {t('components.settings.my-webbing.empty')}
      </Text>
    </View>
  );
};

const WebbingList: React.FC<{
  webbings: WebbingWithModel[];
}> = ({ webbings }) => {
  return (
    <View className="gap-3">
      {webbings.map((webbing) => (
        <WebbingItem key={webbing.id} webbing={webbing} />
      ))}
    </View>
  );
};

const WebbingItem: React.FC<{
  webbing: WebbingWithModel;
}> = ({ webbing }) => {
  const { t, i18n } = useTranslation();
  
  // Get loop status info
  let loopQuantity = 0;
  if (webbing.left_loop) loopQuantity += 1;
  if (webbing.right_loop) loopQuantity += 1;

  // Get recommended lifetime and strength class from model
  const recommendedDays = (webbing.model as { recommended_lifetime_days?: number | null } | null)?.recommended_lifetime_days ?? null;
  const strengthClass = (webbing.model as { strength_class?: string | null } | null)?.strength_class ?? null;

  // Get usage stats from shared hook (returns guaranteed non-undefined data)
  const { data: usageData } = useWebbingUsage(webbing.id, recommendedDays);

  const statusColors = {
    good: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    inspect: { bg: 'bg-amber-100', text: 'text-amber-700' },
    replace: { bg: 'bg-red-100', text: 'text-red-700' },
  };

  const statusColor = statusColors[usageData.status];

  return (
    <Link href={`/webbing/${webbing.id}` as `/webbing/${number}`} asChild>
      <TouchableOpacity activeOpacity={0.7}>
        <View className="flex-row gap-3 p-3 rounded-xl bg-muted/30 border border-border">
          {/* ID Badge - designed to suggest physical marking */}
          <View className="items-center justify-center w-14 py-2 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5">
            <Text className="text-[10px] font-medium text-primary/70 uppercase tracking-wide">ID</Text>
            <Text className="text-lg font-bold text-primary">{webbing.id}</Text>
          </View>

          {/* Content */}
          <View className="flex-1 gap-2">
            {/* Header: Name + Type + Status */}
            <View className="flex-row items-center justify-between gap-2">
              <Text className="font-semibold text-base text-foreground flex-1" numberOfLines={1}>
                {getWebbingName(webbing)}
              </Text>
              {strengthClass && (
                <View className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30">
                  <Text className="text-[10px] font-bold text-primary">
                    Type {strengthClass}
                  </Text>
                </View>
              )}
              {recommendedDays && (
                <View className={`px-2 py-0.5 rounded-full ${statusColor.bg}`}>
                  <Text className={`text-[10px] font-semibold uppercase ${statusColor.text}`}>
                    {getTranslatedStatus(usageData.status, i18n.language)}
                  </Text>
                </View>
              )}
            </View>

            {/* Lifetime Progress Bar */}
            {recommendedDays && (
              <View className="gap-1">
                <View className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <View
                    className={`h-full rounded-full ${
                      usageData.status === 'replace'
                        ? 'bg-red-500'
                        : usageData.status === 'inspect'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, usageData.percentageUsed)}%` }}
                  />
                </View>
                <Text className="text-[10px] text-muted-foreground">
                  {usageData.usageDays} / {recommendedDays} days used
                </Text>
              </View>
            )}

            {/* Properties */}
            <View className="flex-row flex-wrap gap-2">
              {/* Length */}
              <View className="flex-row items-center gap-1 px-2 py-1 rounded-full bg-blue-100">
                <Icon as={MoveHorizontalIcon} size={12} className="text-blue-600" />
                <Text className="text-xs font-medium text-blue-700">{webbing.length}m</Text>
              </View>

              {webbing.model ? (
                <>
                  {/* Material */}
                  <View className="flex-row items-center gap-1 px-2 py-1 rounded-full bg-emerald-100">
                    <Icon as={FactoryIcon} size={12} className="text-emerald-600" />
                    <Text className="text-xs font-medium text-emerald-700 capitalize">
                      {webbing.model.material}
                    </Text>
                  </View>

                  {/* Weave */}
                  <View className="flex-row items-center gap-1 px-2 py-1 rounded-full bg-amber-100">
                    <Icon as={LayersIcon} size={12} className="text-amber-600" />
                    <Text className="text-xs font-medium text-amber-700 capitalize">
                      {webbing.model.weave}
                    </Text>
                  </View>
                </>
              ) : null}

              {/* Loops */}
              <View className="flex-row items-center gap-1 px-2 py-1 rounded-full bg-violet-100">
                <Icon as={LinkIcon} size={12} className="text-violet-600" />
                <Text className="text-xs font-medium text-violet-700">
                  {`${loopQuantity} ${loopQuantity === 2 ? t('common.loops') : t('common.loop')}`}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
};

const SkeletonWebbingitem: React.FC = () => {
  return (
    <View className="flex-row justify-between items-center gap-4">
      <View className="flex-1 gap-2">
        <Skeleton className="h-4 rounded-full w-[60%]" />
        <Skeleton className="h-3 rounded-full w-[40%]" />
      </View>
      <Skeleton className="h-6 w-6 rounded-full" />
    </View>
  );
};

export { MyWebbings };
