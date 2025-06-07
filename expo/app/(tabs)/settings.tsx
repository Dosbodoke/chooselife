import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, TouchableOpacity, View } from 'react-native';

import { useAuth } from '~/context/auth';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { supabase } from '~/lib/supabase';
import { Tables } from '~/utils/database.types';

import {
  ProfileInfoForm,
  profileInfoSchema,
  type ProfileInfoSchema,
} from '~/components/edit-profile-info';
import { LanguageSwitcher } from '~/components/language-switcher';
import { SafeAreaOfflineView } from '~/components/offline-banner';
import { MyWebbings } from '~/components/settings/my-webbing';
import { SupabaseAvatar } from '~/components/supabase-avatar';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { Text } from '~/components/ui/text';
import { H2, Muted } from '~/components/ui/typography';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { profile, logout, isLoginPending } = useAuth();

  if (profile && profile.username) {
    return (
      <SafeAreaOfflineView className="h-full w-full">
        <ScrollView contentContainerClassName="min-h-screen justify-between h-full flex-1 p-4 pt-9">
          <View className="gap-6">
            <Link
              href={{
                pathname: '/profile/[username]',
                params: { username: profile.username },
              }}
              asChild
            >
              <TouchableOpacity className="flex flex-row gap-4">
                <View className="overflow-hidden size-16">
                  <SupabaseAvatar profileID={profile.id} />
                </View>
                <View className="flex-1">
                  <H2 className="flex-shrink">{profile.name}</H2>
                  <Muted>{t('app.(tabs).settings.viewProfile')}</Muted>
                </View>
              </TouchableOpacity>
            </Link>

            <MyWebbings />
          </View>

          <View className="gap-4">
            <View>
              <EditProfileButton />
              <ChangeLanguage />
            </View>

            <View className="gap-2">
              <Button variant="link" onPress={logout}>
                <Text className="text-foreground underline">
                  {t('app.(tabs).settings.logOut')}
                </Text>
              </Button>
              <DeleteAccount />
            </View>
          </View>
        </ScrollView>
      </SafeAreaOfflineView>
    );
  }

  return (
    <SafeAreaOfflineView className="flex-1">
      <View className="p-4 gap-4 flex justify-end h-full">
        <ChangeLanguage />
        <Link href={`/login?redirect_to=settings`} asChild>
          <Button
            disabled={isLoginPending}
            className="w-fit bg-primary text-center py-4 text-primary-foreground"
          >
            <Text>{t('app.(tabs).settings.logIn')}</Text>
          </Button>
        </Link>
      </View>
    </SafeAreaOfflineView>
  );
}

const ChangeLanguage: React.FC = () => {
  const { t } = useTranslation();
  const bottomSheetModalRef = React.useRef<BottomSheetModal>(null);

  const openModal = () => {
    bottomSheetModalRef.current?.present({
      velocity: 200,
      stiffness: 200,
      damping: 80,
    });
  };

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  return (
    <>
      <TouchableOpacity className="gap-4" onPress={openModal}>
        <Separator></Separator>
        <View className="flex-row justify-between">
          <View className="flex-row gap-2">
            <LucideIcon
              name="Languages"
              className="size-6 text-muted-foreground"
            />
            <Text>{t('app.(tabs).settings.changeLanguage')}</Text>
          </View>
          <LucideIcon name="ChevronRight" className="size-6 text-foreground" />
        </View>
        <Separator></Separator>
      </TouchableOpacity>
      <BottomSheetModal
        ref={bottomSheetModalRef}
        backdropComponent={renderBackdrop}
        handleComponent={null}
        detached={true}
        bottomInset={46}
        enablePanDownToClose={true}
        style={{
          marginHorizontal: 24,
          elevation: 4,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 4,
          shadowOffset: {
            width: 1,
            height: 1,
          },
        }}
      >
        <BottomSheetView className="p-4 items-center gap-4">
          <LanguageSwitcher />
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
};

const EditProfileButton: React.FC = () => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const bottomSheetModalRef = React.useRef<BottomSheetModal>(null);

  const mutation = useMutation({
    mutationFn: async (data: ProfileInfoSchema) => {
      if (!profile) throw Error('No profile to update');
      const { data: profileData, error: upsertError } = await supabase
        .from('profiles')
        .update({
          name: data.name,
          profile_picture: data.profilePicture,
          description: data.description,
          birthday: data.birthday,
        })
        .eq('id', profile.id)
        .select()
        .single();

      if (upsertError) {
        throw upsertError;
      }
      return profileData;
    },
    onSuccess: (profileData: Tables<'profiles'>) => {
      queryClient.setQueryData<Tables<'profiles'>>(
        ['profile', profileData.id],
        profileData,
      );
      bottomSheetModalRef.current?.dismiss();
    },
    onError: (error) => {
      console.log({ error });
      form.setError('root', {
        message: t('app.setProfile.errors.saveProfile'),
      });
    },
  });

  const form = useForm<ProfileInfoSchema>({
    resolver: zodResolver(profileInfoSchema),
    mode: 'onChange',
    defaultValues: {
      name: profile?.name ?? '',
      profilePicture: profile?.profile_picture || undefined,
      description: profile?.description ?? '',
      birthday: profile?.birthday ?? '',
    },
  });

  const openModal = () => {
    bottomSheetModalRef.current?.present({
      velocity: 200,
      stiffness: 200,
      damping: 80,
    });
  };

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  return (
    <>
      <TouchableOpacity className="gap-4" onPress={openModal}>
        <Separator></Separator>
        <View className="flex-row justify-between">
          <View className="flex-row gap-2">
            <LucideIcon
              name="Pencil"
              className="size-6 text-muted-foreground"
            />
            <Text>{t('app.(tabs).settings.editProfile.triggerLabel')}</Text>
          </View>
          <LucideIcon name="ChevronRight" className="size-6 text-foreground" />
        </View>
        <View></View>
      </TouchableOpacity>
      <BottomSheetModal
        ref={bottomSheetModalRef}
        backdropComponent={renderBackdrop}
        enablePanDownToClose={true}
        style={{
          elevation: 4,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 4,
          shadowOffset: {
            width: 1,
            height: 1,
          },
        }}
      >
        <BottomSheetView className="p-4 items-center gap-4">
          <ProfileInfoForm form={form} />
          <Button
            className="w-full"
            onPress={form.handleSubmit((data) => mutation.mutate(data))}
            disabled={!form.formState.isDirty || mutation.isPending}
          >
            <Text>{t('app.(tabs).settings.editProfile.submitLabel')}</Text>
          </Button>
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
};

const DeleteAccount: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { logout, profile } = useAuth();

  const handleDeleteAccount = () => {
    if (!profile?.id) return;

    Alert.alert(
      t('app.(tabs).settings.delete.alertLabel'),
      t('app.(tabs).settings.delete.alertDescription'),
      [
        { text: t('app.(tabs).settings.delete.alertCancel'), style: 'cancel' },
        {
          text: t('app.(tabs).settings.delete.alertConfirm'),
          style: 'destructive',
          onPress: async () => {
            const { error } =
              await supabase.functions.invoke('user-self-deletion');

            if (error) {
              Alert.alert('Error', t('app.(tabs).settings.delete.alertError'));
              return;
            }

            await logout();
            router.replace('/(tabs)/home');
          },
        },
      ],
    );
  };
  return (
    <Button variant="link" onPress={handleDeleteAccount}>
      <Text className="text-red-500">
        {t('app.(tabs).settings.delete.label')}
      </Text>
    </Button>
  );
};
