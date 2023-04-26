import { View, TouchableOpacity, TextInput, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { ArrowBackSvg } from '@src/assets';

interface Props {
  onSearch: (filter: string) => void;
  goBack: () => void;
}

const Header = ({ onSearch, goBack }: Props) => {
  return (
    <>
      <View
        className={`flex flex-row items-center px-2 ${Platform.OS === 'ios' ? 'pb-3' : 'py-3'}`}>
        <TouchableOpacity onPress={goBack} className="h-9 w-9">
          <ArrowBackSvg className="text-black" />
        </TouchableOpacity>
        <TextInput
          className="grow rounded-md border-[1px] border-gray-300 bg-gray-50 py-2 px-3 leading-6"
          placeholder="Nome da Via"
          onSubmitEditing={(e) => {
            onSearch(e.nativeEvent.text.trim());
          }}
          autoFocus
        />
      </View>
      <LinearGradient
        className="h-2 w-full"
        colors={['transparent', '#111111']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 20 }}
      />
    </>
  );
};

export default Header;
