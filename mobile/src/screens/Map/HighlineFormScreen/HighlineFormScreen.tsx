import { ArrowBackSvg } from '@src/assets';
import TextInput from '@src/components/TextInput/TextInput';
import { HighlineFormScreenProps } from '@src/navigation/types';
import { Formik } from 'formik';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, Button } from 'react-native';
import { z } from 'zod';

interface Props {
  navigation: HighlineFormScreenProps['navigation'];
}

const HighlineFormScreen = ({ navigation }: Props) => {
  const validationSchema = z.object({
    name: z.string().min(3).max(15),
    height: z.string().regex(/^\d+$/),
    anchorA: z.string(),
    anchorB: z.string(),
  });

  return (
    <ScrollView className="h-full bg-white pb-8 px-4">
      <SafeAreaView>
        <TouchableOpacity
          className="w-12 h-12 rounded-full -ml-2"
          onPress={() => navigation.goBack()}>
          <ArrowBackSvg color="#1f2937" />
        </TouchableOpacity>

        <Text className="text-3xl font-bold flex-1">Informações da via</Text>

        <Formik
          initialValues={{
            name: '',
            lenght: '12',
            height: '',
            anchorA: '',
            anchorB: '',
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
                    touched={Boolean(touched.lenght)}
                    error={errors.lenght}
                    value={values.lenght}
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
                <Button title="Enviar" onPress={() => handleSubmit()} />
              </View>
            );
          }}
        </Formik>
      </SafeAreaView>
    </ScrollView>
  );
};

export default HighlineFormScreen;
