import { useLocalSearchParams, Stack, router } from 'expo-router';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ExternalLinkIcon,
  FactoryIcon,
  LayersIcon,
  LinkIcon,
  MapPinIcon,
  MoveHorizontalIcon,
  ShieldIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWebbingUsage, useWebbingHistory, getTranslatedStatus } from '@chooselife/ui';
import { getWebbingName, useUserWebbings } from '~/hooks/use-webbings';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

export default function WebbingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const webbingId = id ? parseInt(id, 10) : undefined;

  // Get webbing data from user webbings
  const { data: webbings, isPending } = useUserWebbings();
  const webbing = webbings?.find((w) => w.id === webbingId);

  // Get recommended lifetime and strength class from model
  const recommendedDays = (webbing?.model as { recommended_lifetime_days?: number | null } | null)?.recommended_lifetime_days ?? null;
  const strengthClass = (webbing?.model as { strength_class?: string | null } | null)?.strength_class ?? null;

  // Get usage stats and history from shared hooks
  const { data: usageData } = useWebbingUsage(webbingId, recommendedDays);
  const { data: historyData } = useWebbingHistory(webbingId);

  // ISA webbing document URL
  const ISA_WEBBING_PDF_URL = 'https://data.slacklineinternational.org/publications/accident-reports/highline_webbing_lifetime_warning_2022_v1_en.pdf/';



  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!webbing) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-muted-foreground">{t('components.webbing-detail.notFound')}</Text>
      </View>
    );
  }

  // Get loop info
  let loopQuantity = 0;
  if (webbing.left_loop) loopQuantity += 1;
  if (webbing.right_loop) loopQuantity += 1;

  const statusColors = {
    good: { bg: 'bg-emerald-100', text: 'text-emerald-700', bar: 'bg-emerald-500' },
    inspect: { bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-500' },
    replace: { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500' },
  };
  const statusColor = statusColors[usageData.status];

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerTransparent: true,
        }}
      />
      <ScrollView
        className="flex-1 bg-muted/30"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="pt-16 pb-12"
      >
        {/* Header Card */}
        <View className="mx-4 p-4 rounded-2xl bg-card border border-border">
          <View className="flex-row gap-4">
            {/* ID Badge */}
            <View className="items-center justify-center w-20 h-20 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5">
              <Text className="text-xs font-medium text-primary/70 uppercase tracking-wide">ID</Text>
              <Text className="text-3xl font-bold text-primary">{webbing.id}</Text>
            </View>

            {/* Name, Model, and Type */}
            <View className="flex-1 justify-center gap-2">
              <Text className="text-xl font-bold text-foreground" numberOfLines={2}>
                {getWebbingName(webbing)}
              </Text>
              {webbing.model && (
                <Text className="text-sm text-muted-foreground">
                  {webbing.model.name}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Lifetime Card */}
        {(recommendedDays || strengthClass) && (
          <View className="mx-4 mt-4 p-4 rounded-2xl bg-card border border-border overflow-hidden">
            {/* Large decorative strength class text - blends into background */}
            {strengthClass && (
              <View 
                className="absolute -top-4 -right-2"
                style={{ opacity: 0.06 }}
                pointerEvents="none"
              >
                <Text 
                  style={{ 
                    fontSize: 140, 
                    fontWeight: '900',
                    lineHeight: 140,
                  }}
                  className="text-primary"
                >
                  {strengthClass}
                </Text>
              </View>
            )}
            
            {/* Header with title and status underneath */}
            <View className="mb-4">
              <View className="flex-row items-center gap-2">
                <Icon as={ShieldIcon} size={20} className="text-primary" />
                <Text className="text-lg font-semibold text-foreground">
                  {t('components.webbing-detail.lifetime.title')}
                </Text>
              </View>
              <Text className={`text-sm mt-1 ${statusColor.text}`}>
                {t('components.webbing-detail.lifetime.status', { status: getTranslatedStatus(usageData.status, i18n.language) })}
              </Text>
              {recommendedDays && (
                <Text className="text-xs text-muted-foreground mt-0.5">
                  {t('components.webbing-detail.lifetime.recommendedLifetime', { days: recommendedDays })}
                </Text>
              )}
            </View>

            {recommendedDays && (
              <>
                {/* Progress Bar */}
                <View className="mb-2">
                  <View className="h-3 rounded-full bg-muted overflow-hidden">
                    <View
                      className={`h-full rounded-full ${statusColor.bar}`}
                      style={{ width: `${Math.min(100, usageData.percentageUsed)}%` }}
                    />
                  </View>
                </View>

                {/* Stats */}
                <View className="flex-row justify-between mb-3">
                  <Text className="text-sm text-muted-foreground">
                    {t('components.webbing-detail.lifetime.daysUsed', { days: usageData.usageDays })}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {t('components.webbing-detail.lifetime.daysRemaining', { days: recommendedDays - usageData.usageDays })}
                  </Text>
                </View>
              </>
            )}

            {/* ISA Document Link */}
            <TouchableOpacity
              onPress={() => Linking.openURL(ISA_WEBBING_PDF_URL)}
              className="flex-row items-center justify-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200"
            >
              <Icon as={ExternalLinkIcon} size={16} className="text-blue-600" />
              <Text className="text-sm font-medium text-blue-700">
                {t('components.webbing-detail.lifetime.learnMore')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Specifications Card */}
        <View className="mx-4 mt-4 p-4 rounded-2xl bg-card border border-border">
          <Text className="text-lg font-semibold text-foreground mb-3">
            {t('components.webbing-detail.specifications.title')}
          </Text>
          
          <View className="gap-3">
            {/* Length */}
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-lg bg-blue-100 items-center justify-center">
                <Icon as={MoveHorizontalIcon} size={20} className="text-blue-600" />
              </View>
              <View>
                <Text className="text-xs text-muted-foreground">
                  {t('components.webbing-detail.specifications.length')}
                </Text>
                <Text className="font-medium">{webbing.length}m</Text>
              </View>
            </View>

            {webbing.model && (
              <>
                {/* Material */}
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-lg bg-emerald-100 items-center justify-center">
                    <Icon as={FactoryIcon} size={20} className="text-emerald-600" />
                  </View>
                  <View>
                    <Text className="text-xs text-muted-foreground">
                      {t('components.webbing-detail.specifications.material')}
                    </Text>
                    <Text className="font-medium capitalize">{webbing.model.material}</Text>
                  </View>
                </View>

                {/* Weave */}
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-lg bg-amber-100 items-center justify-center">
                    <Icon as={LayersIcon} size={20} className="text-amber-600" />
                  </View>
                  <View>
                    <Text className="text-xs text-muted-foreground">
                      {t('components.webbing-detail.specifications.weave')}
                    </Text>
                    <Text className="font-medium capitalize">{webbing.model.weave}</Text>
                  </View>
                </View>
              </>
            )}

            {/* Loops */}
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-lg bg-violet-100 items-center justify-center">
                <Icon as={LinkIcon} size={20} className="text-violet-600" />
              </View>
              <View>
                <Text className="text-xs text-muted-foreground">
                  {t('components.webbing-detail.specifications.loops')}
                </Text>
                <Text className="font-medium">
                  {`${loopQuantity} ${loopQuantity === 2 ? t('common.loops') : t('common.loop')}`}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Usage History Card */}
        <View className="mx-4 mt-4 p-4 rounded-2xl bg-card border border-border">
          <Text className="text-lg font-semibold text-foreground mb-3">
            {t('components.webbing-detail.history.title', { count: usageData.rigCount })}
          </Text>

          {historyData.length === 0 ? (
            <View className="py-6 items-center">
              <Text className="text-muted-foreground text-center">
                {t('components.webbing-detail.history.empty')}
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {historyData.map((rig) => (
                <View
                  key={rig.setupId}
                  className="flex-row items-center gap-3 p-3 rounded-lg bg-muted/30"
                >
                  <View className="w-10 h-10 rounded-lg bg-blue-100 items-center justify-center">
                    <Icon as={MapPinIcon} size={20} className="text-blue-600" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-medium" numberOfLines={1}>
                      {rig.highlineName}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <Icon as={CalendarIcon} size={12} className="text-muted-foreground" />
                      <Text className="text-xs text-muted-foreground">
                        {new Date(rig.rigDate).toLocaleDateString()} • {t('components.webbing-detail.history.days', { days: rig.durationDays })}
                      </Text>
                    </View>
                  </View>
                  <View className={`px-2 py-0.5 rounded-full ${rig.webbingType === 'main' ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Text className={`text-[10px] font-medium uppercase ${rig.webbingType === 'main' ? 'text-primary' : 'text-muted-foreground'}`}>
                      {rig.webbingType}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}
