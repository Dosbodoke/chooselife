import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import React, {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import {
  Controller,
  SubmitHandler,
  useFieldArray,
  useForm,
  UseFormReturn,
} from 'react-hook-form';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import DatePicker from 'react-native-date-picker';
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  LinearTransition,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { useHighline } from '~/hooks/use-highline';
import { useWebbings, type WebbingWithModel } from '~/hooks/useWebbings';
import HighlineRigIllustration from '~/lib/icons/highline-rig';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { supabase } from '~/lib/supabase';
import { useColorScheme } from '~/lib/useColorScheme';
import { cn } from '~/lib/utils';
import type { TablesInsert } from '~/utils/database.types';

import SuccessAnimation from '~/components/animations/success-animation';
import { KeyboardAwareScrollView } from '~/components/KeyboardAwareScrollView';
import { OnboardNavigator, OnboardPaginator } from '~/components/onboard';
import { WebList } from '~/components/sortable-webbing-list';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectTriggerSkeleton,
  SelectValue,
  type Option,
} from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';
import { Text } from '~/components/ui/text';
import { H1, H3, Muted } from '~/components/ui/typography';
import { WebbingInput, webbingSchema } from '~/components/webbing-input';
import {
  WebbingSetup,
  type WebbingValidationErrors,
} from '~/components/webbing-setup';

const DAMPING = 14;

export const _layoutAnimation = LinearTransition.springify().damping(DAMPING);
export const _exitingAnimation = FadeOut.springify().damping(DAMPING);
export const _enteringAnimation = FadeInDown.springify().damping(DAMPING);
const AnimatedCard = Animated.createAnimatedComponent(Card);

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
type WebbingSchemaWithPreffiled = RigSchema['webbing']['main'][number];
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
  setFocusedWebbing: React.Dispatch<React.SetStateAction<FocusedWebbing>>;
};

const RiggingFormContext = React.createContext<RiggingFormContextType | null>(
  null,
);

export function useRiggingForm() {
  const context = useContext(RiggingFormContext);
  if (!context) {
    throw new Error('useRiggingForm must be used within a RiggingFormProvider');
  }
  return context;
}

export default function HighlineSetup() {
  const router = useRouter();
  const { id: highlineId } = useLocalSearchParams<{ id: string }>();
  const { highline } = useHighline({ id: highlineId });
  if (!highline) return null;

  const [step, setStep] = useState(0);
  const [focusedWebbing, setFocusedWebbing] = useState<FocusedWebbing | null>(
    null,
  );

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
          },
        ],
        backup: [
          {
            length: highline?.length.toString(),
            leftLoop: true,
            rightLoop: true,
          },
        ],
      },
      rigDate: new Date(),
    },
  });

  // ---------------------------
  // 1. Fetch saved rig setup data
  // ---------------------------
  // This query fetches the rig setup row for this highline along with its related webbing rows.
  const {
    data: savedRig,
    isPending: isRigPending,
    error: rigError,
  } = useQuery({
    queryKey: ['rigSetup', highlineId],
    queryFn: async () => {
      // We assume that a relationship exists between rig_setup and rig_setup_webbing
      const { data, error } = await supabase
        .from('rig_setup')
        .select(
          `
            *,
            rig_setup_webbing ( *, webbing_id ( *, model ( * ) ) )
          `,
        )
        .eq('highline_id', highlineId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // ---------------------------
  // 2. Hydrate the form with the saved data
  // ---------------------------
  useEffect(
    function hydrateForm() {
      if (savedRig) {
        const main: WebbingSchemaWithPreffiled[] = savedRig.rig_setup_webbing
          .filter((row) => row.webbing_type === 'main')
          .map((row) => ({
            length: row.length.toString(),
            leftLoop: row.left_loop,
            rightLoop: row.right_loop,
            webbingId: row.webbing_id ? row.webbing_id.toString() : undefined,
            tagName: getWebbingName(row.webbing_id),
          }));

        const backup: WebbingSchemaWithPreffiled[] = savedRig.rig_setup_webbing
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
          rigDate: new Date(savedRig.rig_date),
          webbing: { main, backup },
        });
      }
    },
    [savedRig, form],
  );

  const mutation = useMutation({
    mutationFn: async (data: RigSchema) => {
      let setupId: number;

      // Check if a saved rig setup already exists
      if (savedRig) {
        setupId = savedRig.id;

        // Delete existing webbing rows associated with this rig setup.
        // This way we avoid having to individually update or delete each row.
        const { error: deleteError } = await supabase
          .from('rig_setup_webbing')
          .delete()
          .eq('setup_id', setupId);

        if (deleteError) {
          throw new Error(deleteError.message);
        }
      } else {
        // No rig exists yet, so insert a new rig_setup row.
        const rigSetupInsert = {
          highline_id: highlineId,
          rig_date: data.rigDate.toISOString(), // converting Date to string
          riggers: [],
          unrigged_at: null,
        };

        const { data: rigSetupData, error: rigSetupError } = await supabase
          .from('rig_setup')
          .insert(rigSetupInsert)
          .select()
          .single();

        if (rigSetupError || !rigSetupData) {
          throw new Error(
            rigSetupError?.message || 'Failed to insert rig setup',
          );
        }

        setupId = rigSetupData.id;
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
          setup_id: setupId,
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
          setup_id: setupId,
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

      return { rigSetup: setupId, webbing: webbingData };
    },
    onSuccess: (result) => {
      console.log('Rig setup saved successfully:', result);
    },
    onError: (error) => {
      console.error('Error saving rig setup:', error);
    },
  });

  // Implement handleSave to call the mutation.
  const handleSave: SubmitHandler<RigSchema> = async (data) => {
    await mutation.mutateAsync(data);
  };

  const steps = useMemo(
    () => [
      <DateForm key="DateForm" form={form} />,
      <Equipments key="Equipments" form={form} />,
    ],
    [form],
  );

  const handleNextStep = async (newStep: number) => {
    // Move back
    if (newStep >= 0 && newStep < step) {
      setStep((prevStep) => prevStep - 1);
      return;
    }

    // Move forward
    if (step < steps.length - 1) {
      setStep((prevStep) => prevStep + 1);
    }
  };

  const main = useFieldArray({ control: form.control, name: 'webbing.main' });
  const backup = useFieldArray({
    control: form.control,
    name: 'webbing.backup',
  });

  if (mutation.isSuccess) {
    return (
      <SafeAreaView className="items-center justify-center gap-8 flex-1">
        <View>
          <H1 className="text-center">BOA CHOOSEN</H1>
          <Text className="text-3xl text-center">🆑 🆑 🆑 🆑 🆑</Text>
        </View>
        <View className="h-52 items-center justify-center">
          <SuccessAnimation />
        </View>
        <Text className="text-center w-3/4">
          A montagem está planejada para{' '}
          {form.getValues('rigDate').toDateString()}, você pode voltar e fazer
          modificações quando precisar.
        </Text>
        <Link
          href={{
            pathname: '/highline/[id]',
            params: { id: highline.id },
          }}
          asChild
        >
          <Button>
            <Text>Ver o Highline</Text>
          </Button>
        </Link>
      </SafeAreaView>
    );
  }

  return (
    <RiggingFormContext.Provider
      value={{
        form,
        main: { ...main, fields: main.fields },
        backup: { ...backup, fields: backup.fields },
        focusedWebbing,
        highlineLength: highline.length,
        setFocusedWebbing,
      }}
    >
      <SafeAreaView className="flex-1">
        {/* Parent takes full screen height */}
        <KeyboardAwareScrollView
          contentContainerClassName="flex-grow px-6 pt-8 gap-4"
          keyboardShouldPersistTaps="handled"
        >
          {/* Step content - sizes naturally */}
          <Animated.View
            className="gap-4 items-center"
            entering={FadeInRight}
            exiting={FadeOutLeft}
          >
            {steps[step]}
          </Animated.View>

          {/* Spacer to push paginator down */}
          <View className="flex-grow" />

          {/* Paginator/Navigator - stays at bottom when content is short */}
          <View className="gap-4 pb-8">
            <OnboardPaginator total={steps.length} selectedIndex={step} />
            <OnboardNavigator
              total={steps.length}
              selectedIndex={step}
              onIndexChange={handleNextStep}
              onFinish={form.handleSubmit(handleSave)}
              goBack={router.back}
              isLoading={mutation.isPending}
            />
          </View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </RiggingFormContext.Provider>
  );
}

const DateForm: React.FC<{ form: UseFormReturn<RigSchema> }> = ({ form }) => {
  const colorScheme = useColorScheme();

  return (
    <>
      <HighlineRigIllustration
        mode={colorScheme.colorScheme}
        className="w-full h-auto"
      />

      <View>
        <H3 className="text-center">Primeiro, escolha uma data</H3>
        <Muted className="text-center">
          A data em que a missão irá acontecer
        </Muted>
      </View>

      <Controller
        control={form.control}
        name="rigDate"
        render={({ field: { value } }) => (
          <DatePicker
            mode="date"
            locale="pt-BR"
            date={value}
            minimumDate={new Date()}
            onConfirm={(date) => {
              form.setValue('rigDate', date);
            }}
            timeZoneOffsetInMinutes={0} // https://github.com/henninghall/react-native-date-picker/issues/841
            theme={colorScheme.colorScheme}
          />
        )}
      />
    </>
  );
};

const Equipments: React.FC<{
  form: UseFormReturn<RigSchema>;
}> = ({ form }) => {
  const { main, backup, focusedWebbing, highlineLength, setFocusedWebbing } =
    useRiggingForm();

  const [webbingValidationErrors, setWebbingValidationErrors] =
    useState<WebbingValidationErrors>({});

  const handleNewSection = useCallback((type: WebType) => {
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
    <AnimatedCard layout={_layoutAnimation} className="w-full">
      <CardHeader className="gap-3">
        <CardTitle>Setup da fita</CardTitle>
        <View className="flex-row justify-between">
          <View className="flex-row gap-1 items-center">
            <View className="w-6 h-2 bg-red-500" />
            <Text className="text-muted-foreground">Principal</Text>
          </View>

          <View className="flex-row gap-1 items-center">
            <View className="w-6 h-2 bg-blue-500" />
            <Text className="text-muted-foreground">Backup</Text>
          </View>

          <View className="flex-row gap-1 items-center">
            <View className="w-4 h-2 bg-black" />
            <Text className="text-muted-foreground">Loop</Text>
          </View>

          <View className="flex-row gap-1 items-center">
            <View className="w-4 h-2 bg-green-500" />
            <Text className="text-muted-foreground">Conexão</Text>
          </View>
        </View>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden">
        <WebbingSetup
          form={form}
          mainSections={main.fields}
          backupSections={backup.fields}
          focusedWebbing={focusedWebbing}
          highlineLength={highlineLength}
          setFocusedWebbing={setFocusedWebbing}
          onValidationError={setWebbingValidationErrors}
        />
      </CardContent>

      <CardFooter className="border-border border-t pt-4">
        {focusedWebbing ? (
          <WebForm />
        ) : (
          <WebList
            backupSections={backup.fields}
            mainSections={main.fields}
            errorMessages={webbingValidationErrors}
            setFocusedWebbing={setFocusedWebbing}
            swapMain={main.swap}
            swapBackup={backup.swap}
            handleNewSection={handleNewSection}
          />
        )}
      </CardFooter>
    </AnimatedCard>
  );
};

const WebForm: React.FC = () => {
  const { form, main, backup, focusedWebbing, setFocusedWebbing } =
    useRiggingForm();

  if (!focusedWebbing) return;

  const webbing = form.watch(
    `webbing.${focusedWebbing.type}.${focusedWebbing.index}`,
  );

  const handleDeleteSection = useCallback((type: WebType, index: number) => {
    if (type === 'main') {
      main.remove(index);
    } else {
      backup.remove(index);
    }
    setFocusedWebbing(null);
  }, []);

  const handleLoopChange = useCallback(
    (loopType: 'leftLoop' | 'rightLoop') => (checked: boolean) => {
      if (!focusedWebbing) return;

      const path =
        `webbing.${focusedWebbing.type}.${focusedWebbing.index}` as const;
      const webbing = form.getValues(path);

      const updatedWebbing: WebbingSchemaWithPreffiled = {
        ...webbing,
        ...(loopType === 'leftLoop' ? { leftLoop: checked } : {}),
        ...(loopType === 'rightLoop' ? { rightLoop: checked } : {}),
      };

      if (focusedWebbing.type === 'main') {
        main.update(focusedWebbing.index, updatedWebbing);
      } else {
        backup.update(focusedWebbing.index, updatedWebbing);
      }
    },
    [focusedWebbing],
  );

  const handleChangeLength = useCallback(
    (txt: string) => {
      if (!focusedWebbing) return;

      const path =
        `webbing.${focusedWebbing.type}.${focusedWebbing.index}` as const;
      const webbing = form.getValues(path);

      const updatedWebbing: WebbingSchemaWithPreffiled = {
        ...webbing,
        length: txt,
      };

      if (focusedWebbing.type === 'main') {
        main.update(focusedWebbing.index, updatedWebbing);
      } else {
        backup.update(focusedWebbing.index, updatedWebbing);
      }
    },
    [focusedWebbing],
  );

  const handleSelectWebbing = useCallback(
    (webbing: WebbingWithModel[number] | null) => {
      if (!focusedWebbing) return;

      const path =
        `webbing.${focusedWebbing.type}.${focusedWebbing.index}` as const;
      const formWebbing = form.getValues(path);

      const updatedWebbing: WebbingSchemaWithPreffiled = {
        ...formWebbing,
        ...(webbing
          ? {
              webbingId: webbing.id.toString(),
              leftLoop: webbing.left_loop,
              rightLoop: webbing.right_loop,
              length: webbing.length.toString(),
              tagName: getWebbingName(webbing),
            }
          : { webbingId: undefined }),
      };

      if (focusedWebbing.type === 'main') {
        main.update(focusedWebbing.index, updatedWebbing);
      } else {
        backup.update(focusedWebbing.index, updatedWebbing);
      }
    },
    [focusedWebbing],
  );

  return (
    <Animated.View
      entering={_enteringAnimation}
      exiting={_exitingAnimation}
      className="flex-1 items-center gap-6"
    >
      <View className="flex-row justify-between w-full">
        <TouchableOpacity
          onPress={() => setFocusedWebbing(null)}
          className="p-1"
        >
          <LucideIcon
            name="ChevronLeft"
            size={16}
            className="text-primary text-center"
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleDeleteSection} className="p-1">
          <LucideIcon
            name="Trash"
            size={16}
            className="text-red-500 text-center"
          />
        </TouchableOpacity>
      </View>
      <SelectMyWebbing
        webbing={webbing}
        onSelectWebbing={handleSelectWebbing}
      />
      <WebbingInput
        leftLoop={webbing.leftLoop}
        rightLoop={webbing.rightLoop}
        length={webbing.length.toString()}
        disabled={!!webbing.webbingId}
        onLeftLoopChange={handleLoopChange('leftLoop')}
        onRightLoopChange={handleLoopChange('rightLoop')}
        onLengthChange={handleChangeLength}
      />
    </Animated.View>
  );
};

const SelectMyWebbing: React.FC<{
  webbing: WebbingSchemaWithPreffiled;
  onSelectWebbing: (webbing: WebbingWithModel[number] | null) => void;
}> = ({ webbing, onSelectWebbing }) => {
  const id = useId();
  const [triggerWidth, setTriggerWidth] = useState<number>(0);
  const { data, isPending } = useWebbings();

  // Access the current rigging form values
  const { main, backup, focusedWebbing } = useRiggingForm();

  // Build a set of ID's of webbings that are in use on the current form
  const usedWebbingIds = new Set<string>();
  main.fields.forEach((item, index) => {
    const isSelected =
      focusedWebbing?.type === 'main' && focusedWebbing.index === index;
    if (!isSelected && item.webbingId) {
      usedWebbingIds.add(item.webbingId);
    }
  });
  backup.fields.forEach((item, index) => {
    const isSelected =
      focusedWebbing?.type === 'main' && focusedWebbing.index === index;
    if (!isSelected && item.webbingId) {
      usedWebbingIds.add(item.webbingId);
    }
  });

  const getDefaultValue = (): Option | undefined => {
    if (!webbing.webbingId) return undefined;
    const selectedWebbingData = data?.find(
      (web) => web.id.toString() === webbing.webbingId,
    );
    if (!selectedWebbingData) return undefined;
    return {
      value: selectedWebbingData.id.toString(),
      label: getWebbingName(selectedWebbingData),
    };
  };

  return (
    <View className="gap-2 w-full">
      <Label htmlFor={id} nativeID={id}>
        Minhas fitas
      </Label>

      {isPending ? (
        <SelectTriggerSkeleton />
      ) : (
        <Select
          defaultValue={getDefaultValue()}
          onValueChange={(opt) => {
            if (opt) {
              const selectedWeb = data?.find(
                (web) => web.id.toString() === opt.value,
              );
              if (selectedWeb) onSelectWebbing(selectedWeb);
            } else {
              onSelectWebbing(null);
            }
          }}
        >
          <SelectTrigger
            id={id}
            aria-labelledby={id}
            onLayout={(e) => {
              const { width } = e.nativeEvent.layout;
              setTriggerWidth(width);
            }}
          >
            <SelectValue
              className={cn(
                webbing.webbingId ? 'text-primary' : 'text-muted-foreground',
              )}
              placeholder="Ex.: Brasileirinha"
            />
          </SelectTrigger>
          <SelectContent style={{ width: triggerWidth }}>
            <ScrollView
              contentContainerStyle={{ flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
            >
              {data?.map((item) => {
                const itemId = item.id.toString();
                const isUsed = usedWebbingIds.has(itemId) || item.isUsed;
                // Append a note to the label if this webbing is already in use.
                const label =
                  getWebbingName(item) + (isUsed ? ' (em uso)' : '');
                return (
                  <SelectItem
                    key={item.id}
                    value={itemId}
                    label={label}
                    disabled={isUsed}
                  />
                );
              })}
              <Separator />
              <Button variant="ghost" onPress={() => onSelectWebbing(null)}>
                <Text>limpar</Text>
              </Button>
            </ScrollView>
          </SelectContent>
        </Select>
      )}
    </View>
  );
};

function getWebbingName(
  webbing: Omit<WebbingWithModel[number], 'rig_setup_webbing'> | null,
) {
  return webbing?.model?.name || webbing?.tag_name || `Fita não registrada`;
}
