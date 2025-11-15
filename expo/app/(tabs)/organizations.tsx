import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Mountain } from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '~/context/auth';
import { queryKeys } from '~/lib/query-keys';
import { supabase } from '~/lib/supabase';

import { AssembleiaCard } from '~/components/organizations/assembleia-card';
import { BecomeMember } from '~/components/organizations/BecomeMember';
import { News } from '~/components/organizations/News';
import { Subscription } from '~/components/organizations/Subscription';
import { Text } from '~/components/ui/text';

import { HeaderInfos } from '../organizations/header-infos';

// TODO: When more orgs were to be implemented, it should be created the /organizations/[slug] route
const ORG_SLUG = 'slac' as const;

const fetchOrganization = async (slug: string) => {
  if (!slug) return null;
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error) throw error;
  return data;
};

const checkMembership = async (organizationID: string, userId: string) => {
  if (!organizationID || !userId) return false;
  const { data, error } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationID)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return !!data;
};

export default function OrganizationDetailsPage() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  const {
    data: organization,
    isLoading: isLoadingOrg,
    isError: isErrorOrg,
  } = useQuery({
    queryKey: queryKeys.organizations.bySlug(ORG_SLUG),
    queryFn: () => fetchOrganization(ORG_SLUG),
    enabled: !!ORG_SLUG,
  });

  const {
    data: isMember,
    isLoading: isLoadingMember,
    isError: isErrorMember,
  } = useQuery({
    queryKey: queryKeys.organizations.members(ORG_SLUG, profile!.id),
    queryFn: () => checkMembership(organization!.id, profile!.id),
    enabled: !!organization?.id && !!profile,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.bySlug(ORG_SLUG),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.members(ORG_SLUG, profile!.id),
      }),
    ]);
    setRefreshing(false);
  };

  const isLoading = isLoadingOrg || isLoadingMember;
  const isError = isErrorOrg || isErrorMember;

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <SafeAreaView className="h-full w-full">
          <View className="flex-1 bg-white justify-center items-center">
            <ActivityIndicator size="large" color="#059669" />
            <Text className="text-gray-600 mt-4">Loading team...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (isError || !organization) {
    console.log({ isError, organization });
    return (
      <>
        <Stack.Screen options={{ title: 'Team Not Found' }} />
        <SafeAreaView className="h-full w-full">
          <View className="flex-1 bg-white justify-center items-center px-6">
            <Mountain className="text-gray-300 mb-4" size={64} />
            <Text className="text-gray-900 text-2xl font-bold mb-2">
              Team Not Found
            </Text>
            <Text className="text-gray-600 text-center">
              This team doesn't exist or you don't have access to it.
            </Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerBackButtonDisplayMode: 'minimal',
          title: organization.name,
        }}
      />
      <SafeAreaView className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-8 px-4 py-6"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#059669"
            />
          }
        >
          <View>
            <View className="pt-6 pb-4">
              <Text className="text-black text-4xl font-black">
                {organization.name}
              </Text>
              <Text className="text-lg font-medium mb-2">
                Slackliners Associados do Cerrado
              </Text>
              <Text className="text-base text-gray-600 leading-6">
                Associação esportiva, cultural e artística de slackline sem fins
                lucrativos, dedicada ao desenvolvimento e disseminação do
                esporte.
              </Text>
            </View>

            <HeaderInfos />
          </View>

          {isMember ? <Subscription organization={organization} /> : null}
          <AssembleiaCard />
          <News />
        </ScrollView>
      </SafeAreaView>
      {!isMember ? <BecomeMember /> : null}
    </>
  );
}
