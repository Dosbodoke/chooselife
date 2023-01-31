import { ArrowBackSvg } from '@src/assets';
import { TouchableOpacity, Text, SafeAreaView } from 'react-native';

interface Props {
  goBack: () => void;
  text: string;
}

const PageHeader = ({ goBack, text }: Props) => {
  return (
    <SafeAreaView className="bg-white">
      <TouchableOpacity className="h-10 w-10 rounded-full" onPress={goBack}>
        <ArrowBackSvg color="#1f2937" />
      </TouchableOpacity>

      <Text className="text-3xl font-bold">{text}</Text>
    </SafeAreaView>
  );
};

export default PageHeader;
