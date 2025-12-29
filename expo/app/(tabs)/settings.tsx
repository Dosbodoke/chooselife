import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import {
  ChevronRightIcon,
  LanguagesIcon,
  LogOutIcon,
  PencilIcon,
  Trash2Icon,
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, TouchableOpacity, View } from 'react-native';

import { useAuth } from '~/context/auth';
import { supabase } from '~/lib/supabase';
import { cn } from '~/lib/utils';
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
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { profile, logout, isLoginPending } = useAuth();

  if (profile && profile.username) {
    return (
      <SafeAreaOfflineView className="h-full w-full bg-gray-100">
        <ScrollView contentContainerClassName="py-8 px-4 gap-6">
          {/* Profile Header */}
          <Link
            href={{
              pathname: '/profile/[username]',
              params: { username: profile.username },
            }}
            asChild
          >
            <TouchableOpacity className="flex-row items-center gap-4 bg-white p-4 rounded-xl">
              <View className="relative overflow-hidden size-16 rounded-full">
                <SupabaseAvatar profileID={profile.id} />
              </View>
              <View className="flex-1">
                <Text variant="h2" className="text-xl">
                  {profile.name}
                </Text>
                <Text className="text-muted-foreground">
                  {t('app.(tabs).settings.viewProfile')}
                </Text>
              </View>
              <Icon
                as={ChevronRightIcon}
                className="size-5 text-muted-foreground"
              />
            </TouchableOpacity>
          </Link>

          {/* My Webbings */}
          <View>
            <MyWebbings />
          </View>

          {/* Settings Group */}
          <View className="bg-white rounded-xl overflow-hidden">
            <EditProfileButton />
            <ChangeLanguage isLast />
          </View>

          {/* Account Actions */}
          <View className="bg-white rounded-xl overflow-hidden">
            <SettingsItem
              icon={LogOutIcon}
              iconColor="#8E8E93"
              label={t('app.(tabs).settings.logOut')}
              onPress={logout}
            />
            <DeleteAccount isLast />
          </View>

          <Text className="text-center text-muted-foreground text-xs mt-4">
            Version 1.3.14
          </Text>
        </ScrollView>
      </SafeAreaOfflineView>
    );
  }

  return (
    <SafeAreaOfflineView className="flex-1 bg-gray-100">
      <View className="p-4 gap-4 flex justify-end h-full">
        <View className="bg-white rounded-xl overflow-hidden">
          <ChangeLanguage isLast />
        </View>
        <Link href={`/login?redirect_to=settings`} asChild>
          <Button disabled={isLoginPending} className="w-full bg-primary">
            <Text>{t('app.(tabs).settings.logIn')}</Text>
          </Button>
        </Link>
        <Text className="text-center text-muted-foreground text-xs mt-4">
          Version 1.3.14
        </Text>
      </View>
    </SafeAreaOfflineView>
  );
}

// Reusable Settings Item Component
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
  iconColor = '#007AFF', // Default iOS Blue
  label,
  onPress,
  rightElement,
  isLast = false,
  destructive = false,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
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
          <Icon
            as={ChevronRightIcon}
            className="size-5 text-muted-foreground/60"
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const ChangeLanguage: React.FC<{ isLast?: boolean }> = ({ isLast }) => {
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
      <SettingsItem
        icon={LanguagesIcon}
        iconColor="#34C759" // iOS Green
        label={t('app.(tabs).settings.changeLanguage')}
        onPress={openModal}
        isLast={isLast}
      />
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
        <BottomSheetView className="p-4 items-center gap-4 bg-white rounded-3xl">
          <LanguageSwitcher
            onSwitch={() => bottomSheetModalRef.current?.dismiss()}
          />
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
      <SettingsItem
        icon={PencilIcon}
        iconColor="#007AFF" // iOS Blue
        label={t('app.(tabs).settings.editProfile.triggerLabel')}
        onPress={openModal}
      />
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
        <BottomSheetView className="p-4 items-center gap-4 bg-white">
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

const DeleteAccount: React.FC<{ isLast?: boolean }> = ({ isLast }) => {
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
    <SettingsItem
      icon={Trash2Icon}
      iconColor="#FF3B30" // iOS Red
      label={t('app.(tabs).settings.delete.label')}
      onPress={handleDeleteAccount}
      isLast={isLast}
      destructive
    />
  );
};
