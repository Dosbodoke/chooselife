import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  rigSetupKeyFactory,
  Setup,
  useRigSetupById,
} from '~/hooks/use-rig-setup';
import RigCarabiner from '~/lib/icons/rig-carabiner';
import { supabase } from '~/lib/supabase';

import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';

export const RigModal: React.FC<{ highlineID: string; setupID?: string }> = ({
  highlineID,
  setupID,
}) => {
  const router = useRouter();
  const bottomSheetModalRef = React.useRef<BottomSheetModal>(null);

  const closeModal = () => {
    bottomSheetModalRef.current?.close();
  };

  React.useEffect(() => {
    if (setupID) {
      bottomSheetModalRef.current?.present({
        velocity: 200,
        stiffness: 200,
        damping: 80,
      });
    } else {
      bottomSheetModalRef.current?.close();
    }
  }, [setupID]);

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
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={renderBackdrop}
      handleComponent={null}
      onDismiss={() => {
        if (setupID && setupID !== '') {
          router.setParams({ setupID: '' });
        }
      }}
      detached={true}
      bottomInset={46}
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
        <SheetBody
          highlineID={highlineID}
          setupID={setupID}
          closeModal={closeModal}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const SheetBody: React.FC<{
  highlineID: string;
  setupID?: string;
  closeModal: () => void;
}> = ({ highlineID, setupID, closeModal }) => {
  if (!setupID) {
    return null;
  }
  const setup = useRigSetupById({ highlineID, rigSetupID: setupID });

  if (setup.isPending) {
    return <ModalSkeleton />;
  }

  if (!setup.data) {
    return <SetupNotFound closeModal={closeModal} />;
  }

  if (setup.data?.is_rigged) {
    return <UnrigSetup setup={setup.data} closeModal={closeModal} />;
  }

  // Has setup and it's not rigged
  return <ConfirmDate setup={setup.data} closeModal={closeModal} />;
};

interface UnrigSetupProps {
  setup: Setup[number];
  closeModal: () => void;
}

const UnrigSetup: React.FC<UnrigSetupProps> = ({ setup, closeModal }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const unrigMutation = useMutation({
    mutationFn: async (setupID: number) => {
      const { data: rigSetupData, error: rigSetupError } = await supabase
        .from('rig_setup')
        .update({
          unrigged_at: new Date().toISOString(),
          is_rigged: false,
        })
        .eq('id', setupID)
        .select()
        .single();

      if (rigSetupError || !rigSetupData) {
        throw new Error(rigSetupError?.message || 'Failed to update rig setup');
      }
      return rigSetupData;
    },
    onSuccess: (response) => {
      // Update cached setups
      queryClient.setQueryData<Setup>(
        rigSetupKeyFactory.all({ highlineID: response.highline_id }),
        (oldData) => {
          return oldData?.map((item) =>
            item.id === response.id ? { ...item, ...response } : item,
          );
        },
      );
      queryClient.setQueryData<Setup[number]>(
        rigSetupKeyFactory.single({
          highlineID: response.highline_id,
          rigSetupID: response.id.toString(),
        }),
        (oldData) => {
          if (!oldData) return;
          return { ...oldData, ...response };
        },
      );
      closeModal();
    },
    onError: (error) => {
      console.error('Error unrigging:', error);
    },
  });

  const handleConfirmUnrig = () => {
    if (setup.id) {
      unrigMutation.mutate(setup.id);
    }
  };

  return (
    <>
      <Text className="text-2xl font-bold">
        {t('components.highline.rig-confirmation.unrig.title')}
      </Text>
      <RigCarabiner />
      <Text className="text-muted-foreground text-center">
        {t('components.highline.rig-confirmation.unrig.description')}
      </Text>
      <Button
        variant="destructive"
        onPress={handleConfirmUnrig}
        disabled={unrigMutation.isPending}
        className="w-full"
      >
        <Text>{t('components.highline.rig-confirmation.unrig.button')}</Text>
      </Button>
      <Button
        variant="outline"
        onPress={() => {
          closeModal();
        }}
        className="w-full"
      >
        <Text>{t('components.highline.rig-confirmation.unrig.cancel')}</Text>
      </Button>
    </>
  );
};

interface ConfirmDateProps {
  setup: Setup[number];
  closeModal: () => void;
}

const ConfirmDate: React.FC<ConfirmDateProps> = ({ setup, closeModal }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (setupID: number) => {
      const { data: rigSetupData, error: rigSetupError } = await supabase
        .from('rig_setup')
        .update({
          is_rigged: true,
        })
        .eq('id', setupID)
        .select()
        .single();

      if (rigSetupError || !rigSetupData) {
        throw new Error(rigSetupError?.message || 'Failed to update rig setup');
      }
      return rigSetupData;
    },
    onSuccess: (response) => {
      queryClient.setQueryData<Setup>(
        rigSetupKeyFactory.all({ highlineID: response.highline_id }),
        (oldData) => {
          return oldData?.map((item) =>
            item.id === response.id ? { ...item, ...response } : item,
          );
        },
      );
      queryClient.setQueryData<Setup[number]>(
        rigSetupKeyFactory.single({
          highlineID: response.highline_id,
          rigSetupID: response.id.toString(),
        }),
        (oldData) => {
          if (!oldData) return;
          return { ...oldData, ...response };
        },
      );
      closeModal();
    },
    onError: (error) => {
      console.error('Error updating rig setup:', error);
    },
  });

  const rigDate = new Date(setup.rig_date);

  return (
    <>
      <Text className="text-2xl font-bold">
        {t('components.highline.rig-confirmation.confirm.title')}
      </Text>
      <Text className="text-muted-foreground text-center">
        {t('components.highline.rig-confirmation.confirm.description', {
          date: rigDate.toLocaleDateString('pt-BR'),
        })}
      </Text>
      <Button
        variant="default"
        onPress={() => mutation.mutate(setup.id)}
        disabled={mutation.isPending}
        className="w-full"
      >
        <Text>
          {t('components.highline.rig-confirmation.confirm.buttonConfirm')}
        </Text>
      </Button>
      <Link href={`/highline/${setup.highline_id}/rig`} asChild>
        <Button
          variant="secondary"
          disabled={mutation.isPending}
          className="w-full"
        >
          <Text>
            {t('components.highline.rig-confirmation.confirm.buttonChange')}
          </Text>
        </Button>
      </Link>
      <Button
        variant="outline"
        onPress={() => {
          closeModal();
        }}
        disabled={mutation.isPending}
        className="w-full"
      >
        <Text>
          {t('components.highline.rig-confirmation.confirm.buttonBack')}
        </Text>
      </Button>
    </>
  );
};

const ModalSkeleton: React.FC = () => (
  <>
    <Skeleton className="w-5/6 h-6" />
    <View className="w-full items-center gap-1">
      <Skeleton className="w-5/6 h-3" />
      <Skeleton className="w-3/5 h-3" />
    </View>
    <View className="h-12 w-full" />
    <Skeleton className="w-full h-14 rounded-md" />
  </>
);

const SetupNotFound: React.FC<{ closeModal: () => void }> = ({
  closeModal,
}) => {
  const { t } = useTranslation();
  return (
    <>
      <Text className="text-2xl font-bold">
        {t('components.highline.rig-confirmation.notFound.title')}
      </Text>
      <RigCarabiner />
      <Text className="text-muted-foreground text-center">
        {t('components.highline.rig-confirmation.notFound.description')}
      </Text>
      <Button
        variant="outline"
        onPress={() => {
          closeModal();
        }}
        className="w-full"
      >
        <Text>
          {t('components.highline.rig-confirmation.notFound.buttonCancel')}
        </Text>
      </Button>
    </>
  );
};
