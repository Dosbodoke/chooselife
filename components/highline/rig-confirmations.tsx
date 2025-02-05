import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import {
  queryKeys as rigQueryKeys,
  Setup,
  useRigSetupById,
} from '~/hooks/use-rig-setup';
import RigCarabiner from '~/lib/icons/rig-carabiner';
import { supabase } from '~/lib/supabase';

import { Button } from '~/components/ui/button';
// 1. Import the Skeleton component
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';

export const RigModal: React.FC = () => {
  const { setupID } = useLocalSearchParams<{ setupID?: string }>();
  const router = useRouter();
  const bottomSheetRef = React.useRef<BottomSheet>(null);

  const closeModal = () => {
    bottomSheetRef.current?.close();
  };

  React.useEffect(() => {
    if (setupID) {
      bottomSheetRef.current?.expand({
        velocity: 200,
        stiffness: 200,
        damping: 80,
      });
    } else {
      bottomSheetRef.current?.close();
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
    <BottomSheet
      ref={bottomSheetRef}
      backdropComponent={renderBackdrop}
      handleComponent={null}
      onClose={() => {
        if (setupID && setupID !== '') {
          router.setParams({ setupID: '' });
        }
      }}
      detached={true}
      bottomInset={46}
      index={-1}
      enablePanDownToClose={false}
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
        <SheetBody setupID={setupID} closeModal={closeModal} />
      </BottomSheetView>
    </BottomSheet>
  );
};

interface SheetBodyProps {
  setupID?: string;
  closeModal: () => void;
}

const SheetBody: React.FC<SheetBodyProps> = ({ setupID, closeModal }) => {
  const setup = useRigSetupById(setupID);

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
  const queryClient = useQueryClient();

  const handleConfirmUnrig = () => {
    if (setup.id) {
      unrigMutation.mutate(setup.id);
    }
  };

  const unrigMutation = useMutation({
    mutationFn: async (setupID: number) => {
      const { data: rigSetupData, error: rigSetupError } = await supabase
        .from('rig_setup')
        .update({
          unrigged_at: new Date().toISOString(),
        })
        .eq('id', setupID)
        .select()
        .single();

      if (rigSetupError || !rigSetupData) {
        throw new Error(rigSetupError?.message || 'Failed to insert rig setup');
      }

      return rigSetupData;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: ['rigSetup', response.highline_id],
      });
      closeModal();
    },
    onError: (error) => {
      console.error('Error unrigging:', error);
    },
  });

  return (
    <>
      <Text className="text-2xl font-bold">Confirmar desmontagem</Text>
      <RigCarabiner />
      <Text className="text-muted-foreground text-center">
        O tempo que o Highline ficou montado será adicionado ao tempo de uso das
        fitas que foram usadas no setup
      </Text>
      <Button
        variant="destructive"
        onPress={handleConfirmUnrig}
        disabled={unrigMutation.isPending}
        className="w-full"
      >
        <Text>Desmontar highline</Text>
      </Button>
      <Button
        variant="outline"
        onPress={() => {
          closeModal();
        }}
        className="w-full"
      >
        <Text>Cancelar</Text>
      </Button>
    </>
  );
};

interface ConfirmDateProps {
  setup: Setup[number];
  closeModal: () => void;
}

const ConfirmDate: React.FC<ConfirmDateProps> = ({ setup, closeModal }) => {
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
        throw new Error(rigSetupError?.message || 'Failed to insert rig setup');
      }

      return rigSetupData;
    },
    onSuccess: (response) => {
      // Update the cached list of setups for this highline
      queryClient.setQueryData<Setup>(
        rigQueryKeys.all(response.highline_id),
        (oldData) => {
          return oldData?.map((item) =>
            item.id === response.id ? { ...item, is_rigged: true } : item,
          );
        },
      );

      // Update the specfici setups cache
      queryClient.setQueryData<Setup[number]>(
        rigQueryKeys.single(response.highline_id),
        (oldData) => {
          if (!oldData) return;
          return { ...oldData, is_rigged: true };
        },
      );

      closeModal();
    },
    onError: (error) => {
      console.error('Error unrigging:', error);
    },
  });

  return (
    <>
      <Text className="text-2xl font-bold">Esse highline foi montado?</Text>
      <Text className="text-muted-foreground text-center">
        A data planejada para montagem era 02/02/2024
      </Text>
      <Button
        variant="default"
        onPress={() => mutation.mutate(setup.id)}
        disabled={mutation.isPending}
        className="w-full"
      >
        <Text>Confirmar montagem</Text>
      </Button>
      <Link href={`/highline/${setup.highline_id}/rig`} asChild>
        <Button
          variant="secondary"
          disabled={mutation.isPending}
          className="w-full"
        >
          <Text>Trocar data</Text>
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
        <Text>Voltar</Text>
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
  return (
    <>
      <Text className="text-2xl font-bold">Setup não encontrado</Text>
      <RigCarabiner />
      <Text className="text-muted-foreground text-center">
        Algo de inesperado aconteceu e o setup não foi encontrado, por favor,
        tente novamente mais tarde
      </Text>
      <Button
        variant="outline"
        onPress={() => {
          closeModal();
        }}
        className="w-full"
      >
        <Text>Cancelar</Text>
      </Button>
    </>
  );
};
