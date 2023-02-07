import { TextInput, ImageInput, PageHeader, TextArea, Divider } from '@src/components';
import { HighlineFormScreenProps } from '@src/navigation/types';
import { trpc } from '@src/utils/trpc';
import { LinearGradient } from 'expo-linear-gradient';
import { useForm, SubmitHandler, Controller, SubmitErrorHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { View, Text, TouchableOpacity, Button } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { z } from 'zod';
import { useAppDispatch } from '@src/redux/hooks';
import { highlightMarker } from '../mapSlice';

const validationSchema = z.object({
  name: z.string().min(3).max(32),
  height: z.string().regex(/^\d+$/),
  textA: z.string(),
  imagesAnchorA: z.string().array(),
  textB: z.string(),
  imagesAnchorB: z.string().array(),
});

type ValidationSchema = z.infer<typeof validationSchema>;

const HighlineFormScreen = ({ navigation, route }: HighlineFormScreenProps) => {
  const dispatch = useAppDispatch();
  const mutation = trpc.highline.createHighline.useMutation({
    onSuccess: (data) => {
      if (!data) return;
      dispatch(
        highlightMarker({
          type: 'Highline',
          id: data.uuid,
          coords: [route.params.markers[0], route.params.markers[1]],
          shouldTriggerUseQueryRefetch: true,
        })
      );
      navigation.popToTop();
    },
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ValidationSchema>({
    mode: 'onTouched',
    resolver: zodResolver(validationSchema),
    defaultValues: {
      name: '',
      height: '',
      textA: '',
      imagesAnchorA: [],
      textB: '',
      imagesAnchorB: [],
    },
  });

  const onSubmit: SubmitHandler<ValidationSchema> = (data) => {
    mutation.mutate({
      name: data.name,
      height: parseInt(data.height),
      length: parseInt(route.params.lenght),
      isRigged: false,
      anchorA: {
        description: data.textA,
        latitude: route.params.markers[0].latitude,
        longitude: route.params.markers[0].longitude,
      },
      anchorB: {
        description: data.textB,
        latitude: route.params.markers[1].latitude,
        longitude: route.params.markers[1].longitude,
      },
    });
  };

  const onInvalid: SubmitErrorHandler<ValidationSchema> = (errors) => console.log({ errors });

  return (
    <View className="flex-1 bg-white px-4">
      <PageHeader text="Informações da via" goBack={() => navigation.goBack()} />
      <KeyboardAwareScrollView showsVerticalScrollIndicator={false} extraHeight={140}>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value }, fieldState: { isTouched, isDirty } }) => {
            return (
              <TextInput
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                touched={isTouched}
                error={errors.name?.message}
                isDirty={isDirty}
                label="Nome"
                accessibilityHint="Nome da via"
              />
            );
          }}
        />
        {/* Lenght and Height */}
        <View className="flex flex-row items-center">
          <TextInput
            isNumeric
            disabled
            suffix="m"
            value={route.params.lenght}
            onChangeText={() => {}}
            onBlur={() => {}}
            label="Comprimento"
            accessibilityHint="Comprimento da via"
          />
          <View className="flex-0 mx-2 h-[1] w-6 bg-gray-600" />
          <Controller
            control={control}
            name="height"
            render={({
              field: { onChange, onBlur, value },
              fieldState: { isTouched, isDirty },
            }) => (
              <TextInput
                isNumeric
                suffix="m"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                isDirty={isDirty}
                touched={isTouched}
                error={errors.height?.message}
                label="Altura"
                accessibilityHint="Altura da via"
              />
            )}
          />
        </View>
        <Divider />
        <View>
          <Text className="flex-1 text-xl font-bold">Ancoragem 🅰️</Text>
          <Text className="text-base text-gray-600">
            Insira imagens e informações sobre ancoragem A para ajudar em montagens futuras
          </Text>
          <ImageInput />
          <Controller
            control={control}
            name="textA"
            render={({
              field: { onChange, onBlur, value },
              fieldState: { isTouched, isDirty },
            }) => {
              return (
                <TextArea
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  touched={isTouched}
                  error={errors.textA?.message}
                  isDirty={isDirty}
                  accessibilityHint="Decrição ancoragem A"
                  placeholder={
                    'Exemplo de descrição:\n🪨 ancoragem de bolt\n⚠️ É necessario rapel para acesso'
                  }
                />
              );
            }}
          />
        </View>
        <Divider />
        <View>
          <Text className="flex-1 text-xl font-bold">Ancoragem 🅱️</Text>
          <Text className="text-base text-gray-600">
            Insira imagens e informações sobre ancoragem A para ajudar em montagens futuras
          </Text>
          <ImageInput />
          <Controller
            control={control}
            name="textB"
            render={({
              field: { onChange, onBlur, value },
              fieldState: { isTouched, isDirty },
            }) => {
              return (
                <TextArea
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  touched={isTouched}
                  error={errors.textB?.message}
                  isDirty={isDirty}
                  accessibilityHint="Decrição ancoragem B"
                  placeholder={
                    'Exemplo de descrição:\n🌲 ancoragem natural\n🪢 levar 6 metros de corda'
                  }
                />
              );
            }}
          />
        </View>
        {/* submit button */}
        <TouchableOpacity
          className="mx-auto mt-4 mb-8 w-3/4 rounded-lg"
          onPress={handleSubmit(onSubmit, onInvalid)}>
          <LinearGradient
            className="rounded-lg"
            colors={['#4caf50', '#2196f3']}
            start={{ x: -1, y: 1 }}
            end={{ x: 3, y: 4 }}>
            <Text className="my-4 text-center text-base font-bold text-white">CADASTRAR VIA</Text>
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default HighlineFormScreen;
