import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Mountain, Users, Zap } from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';

import { useAuth } from '~/context/auth';
import { supabase } from '~/lib/supabase';

import { BecomeMember } from '~/components/organizations/BecomeMember';
import { Payments } from '~/components/organizations/Payments';
import { Text } from '~/components/ui/text';

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

const fetchMemberCount = async (organizationId: string) => {
  const { count, error } = await supabase
    .from('organization_members')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (error) {
    console.error('Error fetching member count:', error);
    return 0;
  }

  return count || 0;
};

export default function OrganizationDetailsPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  const {
    data: organization,
    isLoading: isLoadingOrg,
    isError: isErrorOrg,
    refetch: refetchOrg,
  } = useQuery({
    queryKey: ['organization', slug],
    queryFn: () => fetchOrganization(slug as string),
    enabled: !!slug,
  });

  const {
    data: isMember,
    isLoading: isLoadingMember,
    isError: isErrorMember,
    refetch: refetchMember,
  } = useQuery({
    queryKey: ['organization_members', organization?.id, profile?.id],
    queryFn: () => checkMembership(organization!.id, profile!.id),
    enabled: !!organization && !!profile,
  });

  const { data: memberCount, refetch: refetchCount } = useQuery({
    queryKey: ['memberCount', organization?.id],
    queryFn: () => fetchMemberCount(organization!.id),
    enabled: !!organization?.id,
  });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchOrg(), refetchMember(), refetchCount()]);
    setRefreshing(false);
  }, [refetchOrg, refetchMember, refetchCount]);

  const isLoading = isLoadingOrg || isLoadingMember;
  const isError = isErrorOrg || isErrorMember;

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <View className="flex-1 bg-white justify-center items-center">
          <ActivityIndicator size="large" color="#059669" />
          <Text className="text-gray-600 mt-4">Loading team...</Text>
        </View>
      </>
    );
  }

  if (isError || !organization) {
    return (
      <>
        <Stack.Screen options={{ title: 'Team Not Found' }} />
        <View className="flex-1 bg-white justify-center items-center px-6">
          <Mountain className="text-gray-300 mb-4" size={64} />
          <Text className="text-gray-900 text-2xl font-bold mb-2">
            Team Not Found
          </Text>
          <Text className="text-gray-600 text-center">
            This team doesn't exist or you don't have access to it.
          </Text>
        </View>
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
      <ScrollView
        className="flex-1 bg-white"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#059669"
          />
        }
      >
        {/* Organization Hero Section */}
        <View className="bg-gradient-to-br from-emerald-600 to-emerald-700 px-6 pt-6 pb-8">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1">
              <Text className="text-black/80 text-sm font-semibold uppercase tracking-wider mb-1">
                Your Team
              </Text>
              <Text className="text-black text-3xl font-black">
                {organization.name}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-6 mt-4">
            <View className="flex-row items-center gap-2">
              <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
                <Users className="text-black" size={20} />
              </View>
              <View>
                <Text className="text-black/70 text-xs font-semibold">
                  Members
                </Text>
                <Text className="text-black text-lg font-bold">
                  {memberCount || 0}
                </Text>
              </View>
            </View>

            {isMember && (
              <View className="flex-row items-center gap-2">
                <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
                  <Zap className="text-black" size={20} />
                </View>
                <View>
                  <Text className="text-black/70 text-xs font-semibold">
                    Status
                  </Text>
                  <Text className="text-black text-lg font-bold">Active</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Content */}
        <View className="flex-1">
          {isMember ? (
            <Payments organization={organization} />
          ) : (
            <BecomeMember />
          )}
        </View>
      </ScrollView>
    </>
  );
}
