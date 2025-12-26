import {
  queryKeys,
  SupabaseProvider,
  useIsMember,
  useOrganization,
} from '@chooselife/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import SlacCabeMaisImage from '~/assets/images/slac-cabe-mais.png';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import {
  ChevronRightIcon,
  MapPinIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import {
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '~/context/auth';
import { supabase } from '~/lib/supabase';
import { cn } from '~/lib/utils';

import { SafeAreaOfflineView } from '~/components/offline-banner';
import { AssembleiaCard } from '~/components/organizations/assembleia-card';
import { News } from '~/components/organizations/News';
import { OrganizationErrorState } from '~/components/organizations/organization-error-state';
import { Subscription } from '~/components/organizations/Subscription';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';

// TODO: When more orgs were to be implemented, it should be created the /organizations/[slug] route
const ORG_SLUG = 'slac' as const;

export default function OrganizationDetailsPageWrapper() {
  const { session } = useAuth();

  return (
    <SupabaseProvider supabase={supabase} userId={session?.user.id}>
      <OrganizationDetailsPage />
    </SupabaseProvider>
  );
}

function OrganizationDetailsPage() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: organization } = useOrganization(ORG_SLUG);

  const { data: isMember } = useIsMember(ORG_SLUG);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.bySlug(ORG_SLUG),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.isMember(ORG_SLUG, session?.user.id),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.memberCount(ORG_SLUG),
      }),
    ]);
    setRefreshing(false);
  };

  if (!organization) {
    return <OrganizationErrorState />;
  }

  return (
    <SafeAreaOfflineView className="flex-1 bg-gray-100">
      <ScrollView
        className="flex-1"
        contentContainerClassName="py-8 px-4 gap-6"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#059669"
          />
        }
      >
        {/* Header Group */}
        <View className="bg-white rounded-xl p-4 gap-2">
          <View className="flex-row items-center gap-4">
            {/* Placeholder for Logo if needed, matching Settings profile pic style if we had one */}
            {/* <View className="size-16 rounded-full bg-gray-200" /> */}
            <View className="flex-1">
              <Text className="text-xl font-bold text-foreground">
                {organization.name}
              </Text>
              <Text className="text-muted-foreground">
                Slackliners Associados do Cerrado
              </Text>
            </View>
          </View>
          <Text className="text-gray-600 leading-6 mt-2">
            Associação esportiva, cultural e artística de slackline sem fins
            lucrativos, dedicada ao desenvolvimento e disseminação do esporte.
          </Text>
        </View>

        {/* Info Group */}
        <View className="bg-white rounded-xl overflow-hidden">
          <OrganizationStatsGroup slug={organization.slug} />
        </View>

        {/* Membership Section */}
        {isMember ? (
          <Subscription organization={organization} />
        ) : (
          <View className="relative bg-zinc-900 rounded-xl overflow-hidden min-h-[200px] justify-end p-6 gap-4">
            {/* Spotlight Effect */}
            <View
              className="absolute left-0 top-0 w-full h-full"
              style={{
                experimental_backgroundImage:
                  'radial-gradient(circle at 0% 0%, rgba(139, 92, 246, 0.6) 0%, rgba(24, 24, 27, 0) 60%)',
              }}
            />

            <Image
              source={SlacCabeMaisImage}
              style={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 250,
                height: 250,
                transform: [{ rotate: '25deg' }],
                opacity: 0.4,
              }}
              contentFit="contain"
            />

            {/* Gradient Overlay for Text Readability */}
            <View
              className="absolute inset-0"
              style={{
                experimental_backgroundImage:
                  'linear-gradient(to top, rgba(24, 24, 27, 1) 10%, rgba(24, 24, 27, 0.4) 100%)',
              }}
            />

            <View className="gap-2 z-10">
              <Text className="text-2xl font-black text-white">
                Torne-se um membro
              </Text>
              <Text className="text-zinc-400 text-base font-medium leading-6">
                Junte-se a nós e apoie o desenvolvimento do slackline no
                Cerrado.
              </Text>
            </View>

            <Link href={`/organizations/${organization.slug}/member`} asChild>
              <Button className="w-full bg-white active:bg-gray-100">
                <Text className="text-black font-bold">Seja Membro</Text>
              </Button>
            </Link>
          </View>
        )}

        {/* Activities / Content */}
        <AssembleiaCard />

        <View className="gap-4">
          <Text className="text-lg font-bold ml-1 text-gray-700">Notícias</Text>
          <News organizationId={organization.id} />
        </View>

        <Text className="text-center text-muted-foreground text-xs mt-4">
          Organization ID: {organization.slug}
        </Text>
      </ScrollView>
    </SafeAreaOfflineView>
  );
}

// --- Helper Components ---

const fetchMemberCount = async (slug: string) => {
  const { count, error } = await supabase
    .from('organization_members')
    .select('*, organizations!inner(*)', { count: 'exact', head: true })
    .eq('organizations.slug', slug);

  if (error) {
    console.error('Error fetching member count:', error);
    return 0;
  }

  return count || 0;
};

const OrganizationStatsGroup = ({ slug }: { slug: string }) => {
  const { data: memberCount, isLoading } = useQuery({
    queryKey: queryKeys.organizations.memberCount(slug),
    queryFn: () => fetchMemberCount(slug),
    enabled: !!slug,
  });

  return (
    <>
      <SettingsItem
        icon={UsersIcon}
        iconColor="#007AFF"
        label="Membros"
        rightElement={
          isLoading ? (
            <Skeleton className="h-5 w-8 rounded bg-gray-200" />
          ) : (
            <Text className="text-gray-500 font-medium">{memberCount}</Text>
          )
        }
      />
      <SettingsItem
        icon={MapPinIcon}
        iconColor="#FF3B30"
        label="Sede"
        rightElement={
          <Text className="text-gray-500 font-medium">Anápolis</Text>
        }
        isLast
      />
    </>
  );
};

// Reusable Settings Item Component (Copied from settings.tsx style)
interface SettingsItemProps {
  icon?: LucideIcon;
  iconColor?: string;
  label: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  isLast?: boolean;
  destructive?: boolean;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
  icon: IconComponent,
  iconColor = '#007AFF',
  label,
  onPress,
  rightElement,
  isLast = false,
  destructive = false,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
      className={cn(
        'flex-row items-center pl-4 bg-white active:bg-gray-50',
        !isLast && '',
      )}
    >
      {/* Icon Container */}
      {IconComponent && (
        <View
          className="size-8 rounded-md items-center justify-center mr-4"
          style={{ backgroundColor: iconColor }}
        >
          <Icon as={IconComponent} className="text-white size-5" />
        </View>
      )}

      {/* Content */}
      <View
        className={cn(
          'flex-1 flex-row items-center justify-between py-3 pr-4',
          !isLast && 'border-b border-gray-100',
        )}
      >
        <Text
          className={cn(
            'text-base',
            destructive ? 'text-red-500' : 'text-foreground',
          )}
        >
          {label}
        </Text>
        <View className="flex-row items-center gap-2">
          {rightElement}
          {onPress && (
            <Icon
              as={ChevronRightIcon}
              className="size-5 text-muted-foreground/60"
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};
