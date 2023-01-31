import { TextInput, ImageInput, PageHeader, TextArea, Divider } from '@src/components';
import { HighlineFormScreenProps } from '@src/navigation/types';
import { LinearGradient } from 'expo-linear-gradient';
import { Formik } from 'formik';
import { View, Text, TouchableOpacity } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { z } from 'zod';

const HighlineFormScreen = ({ navigation, route }: HighlineFormScreenProps) => {
  const validationSchema = z.object({
    name: z.string().min(3).max(15),
    height: z.string().regex(/^\d+$/),
    textA: z.string(),
    imagesAnchorA: z.string().array(),
    textB: z.string(),
    imagesAnchorB: z.string().array(),
  });

  return (
    <View className="px-4 bg-white flex-1">
      <PageHeader text="Informações da via" goBack={() => navigation.goBack()} />
      <KeyboardAwareScrollView showsVerticalScrollIndicator={false} extraHeight={140}>
        <Formik
          initialValues={{
            name: '',
            height: '',
            textA: '',
            imagesAnchorA: [],
            textB: '',
            imagesAnchorB: [],
          }}
          validate={(values) => {
            const result = validationSchema.safeParse(values);
            if (result.success) return;
            const errors: Record<string, string> = {};
            result.error.issues.forEach((error) => {
              errors[error.path[0]] = error.message;
            });
            return errors;
          }}
          onSubmit={(values: z.infer<typeof validationSchema>) => console.log({ values })}>
          {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => {
            return (
              <View>
                <TextInput
                  touched={Boolean(touched.name)}
                  error={errors.name}
                  value={values.name}
                  onChangeText={handleChange('name')}
                  onBlur={handleBlur('name')}
                  label="Nome"
                  accessibilityHint="Nome da via"
                />
                <View className="flex flex-row items-center">
                  <TextInput
                    isNumeric
                    disabled
                    suffix="m"
                    value={route.params.lenght}
                    onChangeText={handleChange('lenght')}
                    onBlur={handleBlur('lenght')}
                    label="Comprimento"
                    accessibilityHint="Comprimento da via"
                  />
                  <View className="flex-0 mx-2 w-6 h-[1] bg-gray-600" />
                  <TextInput
                    isNumeric
                    suffix="m"
                    touched={Boolean(touched.height)}
                    error={errors.height}
                    value={values.height}
                    onChangeText={handleChange('height')}
                    onBlur={handleBlur('height')}
                    label="Altura"
                    accessibilityHint="Altura da via"
                  />
                </View>
                <Divider />
                <View>
                  <Text className="text-xl font-bold flex-1">Ancoragem 🅰️</Text>
                  <Text className="text-base text-gray-600">
                    Insira imagens e informações sobre ancoragem A para ajudar em montagens futuras
                  </Text>
                  <ImageInput />
                  <TextArea
                    value={values.textA}
                    accessibilityHint="Decrição ancoragem A"
                    onChangeText={handleChange('textA')}
                    onBlur={handleBlur('textA')}
                    placeholder={
                      'Exemplo de descrição:\n🪨 ancoragem de bolt\n⚠️ É necessario rapel para acesso'
                    }
                  />
                </View>
                <Divider />
                <View>
                  <Text className="text-xl font-bold flex-1">Ancoragem 🅱️</Text>
                  <Text className="text-base text-gray-600">
                    Insira imagens e informações sobre ancoragem A para ajudar em montagens futuras
                  </Text>
                  <ImageInput />
                  <TextArea
                    value={values.textB}
                    accessibilityHint="Decrição ancoragem B"
                    onChangeText={handleChange('textB')}
                    onBlur={handleBlur('textB')}
                    placeholder={
                      'Exemplo de descrição:\n🌲 ancoragem natural\n🪢 levar 6 metros de corda'
                    }
                  />
                </View>
                <TouchableOpacity
                  className="w-3/4 rounded-lg mx-auto mt-4 mb-8"
                  onPress={() => handleSubmit()}>
                  <LinearGradient
                    className="rounded-lg"
                    colors={['#4caf50', '#2196f3']}
                    start={{ x: -1, y: 1 }}
                    end={{ x: 3, y: 4 }}>
                    <Text className="text-white text-base font-bold text-center my-4">
                      CADASTRAR VIA
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            );
          }}
        </Formik>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default HighlineFormScreen;
