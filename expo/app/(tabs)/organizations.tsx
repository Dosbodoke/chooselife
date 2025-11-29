import { useQueryClient } from '@tanstack/react-query';
import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OrganizationProvider, useIsMember, useOrganization, queryKeys } from '@chooselife/ui';
import { useAuth } from '~/context/auth';
import { supabase } from '~/lib/supabase';

import { AssembleiaCard } from '~/components/organizations/assembleia-card';
import { BecomeMember } from '~/components/organizations/BecomeMember';
import { HeaderInfos } from '~/components/organizations/header-infos';
import { News } from '~/components/organizations/News';
import { Subscription } from '~/components/organizations/Subscription';
import { Text } from '~/components/ui/text';

import { OrganizationErrorState } from '~/components/organizations/organization-error-state';

// TODO: When more orgs were to be implemented, it should be created the /organizations/[slug] route
const ORG_SLUG = 'slac' as const;

export default function OrganizationDetailsPageWrapper() {
  const { session } = useAuth();

  return (
    <OrganizationProvider supabase={supabase} userId={session?.user.id}>
      <OrganizationDetailsPage />
    </OrganizationProvider>
  );
}

function OrganizationDetailsPage() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);
  const [bottomPadding, setBottomPadding] = useState(0);
  const becomeMemberRef = useRef<View>(null);

  const {
    data: organization,
  } = useOrganization(ORG_SLUG);

  const {
    data: isMember,
  } = useIsMember(ORG_SLUG);

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

  useLayoutEffect(() => {
    if (isMember) {
      setBottomPadding(0);
      return;
    }

    becomeMemberRef.current?.measureInWindow((_x, _y, _width, height) => {
      setBottomPadding(height);
    });
  }, [isMember, organization?.slug]);

  if (!organization) {
    return <OrganizationErrorState />;
  }

  return (
    <>
      <SafeAreaView
        className="flex-1 bg-white"
        edges={['top', 'left', 'right']}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-8 px-4 py-6"
          contentContainerStyle={{ paddingBottom: bottomPadding + 24 }}
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

            <HeaderInfos slug={organization.slug} />
          </View>

          {isMember ? <Subscription organization={organization} /> : null}
          <AssembleiaCard />
          <News organizationId={organization.id} />
        </ScrollView>
      </SafeAreaView>
      {!isMember ? (
        <BecomeMember slug={organization.slug} ref={becomeMemberRef} />
      ) : null}
    </>
  );
}
