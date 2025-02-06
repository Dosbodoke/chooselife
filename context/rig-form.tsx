import { zodResolver } from '@hookform/resolvers/zod';
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import React from 'react';
import { useFieldArray, useForm, type UseFormReturn } from 'react-hook-form';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { useHighline, type Highline } from '~/hooks/use-highline';
import { useRigSetup } from '~/hooks/use-rig-setup';
import { type WebbingWithModel } from '~/hooks/use-webbings';
import { supabase } from '~/lib/supabase';
import type { Tables, TablesInsert } from '~/utils/database.types';

import { webbingSchema } from '~/components/webbing-input';

import { useAuth } from './auth';

// SCHEMA related schema and types
const webbingSchemaWithPreffiled = webbingSchema.extend({
  // Id of the webbing from "webbing" table
  webbingId: z.string().optional(),
  tagName: z.string(),
});
const rigSchema = z.object({
  webbing: z.object({
    main: z.array(webbingSchemaWithPreffiled),
    backup: z.array(webbingSchemaWithPreffiled),
  }),
  rigDate: z.date(),
});
export type RigSchema = z.infer<typeof rigSchema>;
export type WebbingSchemaWithPreffiled = RigSchema['webbing']['main'][number];
// React hook form `useFieldArray` add's id to each item in the array
export type WebbingWithId = WebbingSchemaWithPreffiled & {
  id: string;
};

export type WebType = 'main' | 'backup';
export type FocusedWebbing = {
  type: WebType;
  index: number;
} | null;

type SectionContext = {
  fields: WebbingWithId[];
  append: (webbing: WebbingSchemaWithPreffiled) => void;
  update: (index: number, webbing: WebbingSchemaWithPreffiled) => void;
  remove: (index: number) => void;
  swap: (indexA: number, indexB: number) => void;
};
type RiggingFormContextType = {
  form: UseFormReturn<RigSchema>;
  main: SectionContext;
  backup: SectionContext;
  focusedWebbing: FocusedWebbing;
  highlineLength: number;
  highline: Highline;
  // Fetching alrady registered setup, need to wait to so the form can be populated
  setupIsPending: boolean;
  mutation: UseMutationResult<
    { setupID: number; webbings: Tables<'rig_setup_webbing'>[] },
    Error,
    RigSchema,
    unknown
  >;
  handleNewSection: (type: WebType) => void;
  setFocusedWebbing: React.Dispatch<React.SetStateAction<FocusedWebbing>>;
};

const RiggingFormContext = React.createContext<RiggingFormContextType | null>(
  null,
);

export const RigFormProvider: React.FC<{
  highlineID: string;
  children: React.ReactNode;
}> = ({ highlineID, children }) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { highline } = useHighline({ id: highlineID });
  if (!highline) return null;

  const [focusedWebbing, setFocusedWebbing] =
    React.useState<FocusedWebbing | null>(null);

  const { isPending: setupIsPending, latestSetup } = useRigSetup({
    highlineID,
  });

  const form = useForm<RigSchema>({
    resolver: zodResolver(rigSchema),
    mode: 'onChange',
    defaultValues: {
      webbing: {
        main: [
          {
            length: highline?.length.toString(),
            leftLoop: true,
            rightLoop: true,
            tagName: getWebbingName(null),
          },
        ],
        backup: [
          {
            length: highline?.length.toString(),
            leftLoop: true,
            rightLoop: true,
            tagName: getWebbingName(null),
          },
        ],
      },
      rigDate: new Date(),
    },
  });

  const main = useFieldArray({ control: form.control, name: 'webbing.main' });
  const backup = useFieldArray({
    control: form.control,
    name: 'webbing.backup',
  });

  // ---------------------------
  // Hydrate the form with the saved data
  // ---------------------------
  React.useEffect(
    function hydrateForm() {
      // Rig is planned
      if (
        latestSetup &&
        latestSetup.is_rigged === false &&
        !latestSetup.unrigged_at
      ) {
        const main: WebbingSchemaWithPreffiled[] = latestSetup.rig_setup_webbing
          .filter((row) => row.webbing_type === 'main')
          .map((row) => ({
            length: row.length.toString(),
            leftLoop: row.left_loop,
            rightLoop: row.right_loop,
            webbingId: row.webbing_id ? row.webbing_id.toString() : undefined,
            tagName: getWebbingName(row.webbing_id),
          }));

        const backup: WebbingSchemaWithPreffiled[] =
          latestSetup.rig_setup_webbing
            .filter((row) => row.webbing_type === 'backup')
            .map((row) => ({
              length: row.length.toString(),
              leftLoop: row.left_loop,
              rightLoop: row.right_loop,
              webbingId: row.webbing_id ? row.webbing_id.toString() : undefined,
              tagName: getWebbingName(row.webbing_id),
            }));

        // Reset the form with the saved values.
        form.reset({
          rigDate: new Date(latestSetup.rig_date),
          webbing: { main, backup },
        });
      }
    },
    [latestSetup],
  );

  const mutation = useMutation({
    mutationFn: async (data: RigSchema) => {
      let setupID: number;

      // Check if a saved rig setup already exists
      if (latestSetup) {
        setupID = latestSetup.id;

        // Delete existing webbing rows associated with this rig setup.
        // This way we avoid having to individually update or delete each row.
        const { error: deleteError } = await supabase
          .from('rig_setup_webbing')
          .delete()
          .eq('setup_id', setupID);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        const { data: rigSetupData, error: rigSetupError } = await supabase
          .from('rig_setup')
          .update({
            rig_date: data.rigDate.toISOString(), // converting Date to string
          })
          .eq('id', setupID)
          .select()
          .single();

        if (rigSetupError || !rigSetupData) {
          throw new Error(
            rigSetupError?.message || 'Failed to insert rig setup',
          );
        }
      } else {
        const { data: rigSetupData, error: rigSetupError } = await supabase
          .from('rig_setup')
          .insert({
            highline_id: highlineID,
            rig_date: data.rigDate.toISOString(), // converting Date to string
            riggers: profile?.id ? [profile.id] : [],
            unrigged_at: null,
          })
          .select()
          .single();

        if (rigSetupError || !rigSetupData) {
          throw new Error(
            rigSetupError?.message || 'Failed to insert rig setup',
          );
        }

        setupID = rigSetupData.id;
      }

      // Prepare webbing rows for insertion into `rig_setup_webbing`
      // We assume that the types for rig_setup_webbing rows have been imported
      const webbingRows: TablesInsert<'rig_setup_webbing'>[] = [];

      // Process the "main" webbing items
      data.webbing.main.forEach((item) => {
        webbingRows.push({
          left_loop: item.leftLoop,
          length: Number(item.length), // convert the string to a number
          right_loop: item.rightLoop,
          setup_id: setupID,
          webbing_id: item.webbingId ? Number(item.webbingId) : null,
          webbing_type: 'main',
        });
      });

      // Process the "backup" webbing items
      data.webbing.backup.forEach((item) => {
        webbingRows.push({
          left_loop: item.leftLoop,
          length: Number(item.length),
          right_loop: item.rightLoop,
          setup_id: setupID,
          webbing_id: item.webbingId ? Number(item.webbingId) : null,
          webbing_type: 'backup',
        });
      });

      // Insert the new webbing rows for the current setup
      const { data: webbingData, error: webbingError } = await supabase
        .from('rig_setup_webbing')
        .insert(webbingRows)
        .select();

      if (webbingError) {
        throw new Error(webbingError.message);
      }

      return { setupID, webbings: webbingData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rigSetup', highlineID] });
    },
    onError: (error) => {
      console.error('Error saving rig setup:', error);
    },
  });

  const handleNewSection = React.useCallback((type: WebType) => {
    const webbing: WebbingSchemaWithPreffiled = {
      length: '50',
      leftLoop: false,
      rightLoop: false,
      tagName: getWebbingName(null),
    };

    if (type === 'main') {
      main.append(webbing);
    } else if (type === 'backup') {
      backup.append(webbing);
    }

    setFocusedWebbing({
      type,
      index: type === 'main' ? main.fields.length : backup.fields.length,
    });
  }, []);

  return (
    <RiggingFormContext.Provider
      value={{
        form,
        main: { ...main, fields: main.fields },
        backup: { ...backup, fields: backup.fields },
        focusedWebbing,
        highlineLength: highline.length,
        highline,
        setupIsPending,
        mutation,
        handleNewSection,
        setFocusedWebbing,
      }}
    >
      <SafeAreaView className="flex-1">{children}</SafeAreaView>
    </RiggingFormContext.Provider>
  );
};

export function useRiggingForm() {
  const context = React.useContext(RiggingFormContext);
  if (!context) {
    throw new Error('useRiggingForm must be used within a RiggingFormProvider');
  }
  return context;
}

export function getWebbingName(
  webbing: Omit<WebbingWithModel[number], 'rig_setup_webbing'> | null,
) {
  return webbing?.model?.name || webbing?.tag_name || `Fita não registrada`;
}
