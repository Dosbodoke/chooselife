import { useState } from 'react';
import { View, Text } from 'react-native';

import { PrimaryButton } from '@src/components';
import SegmentedCode from './SegmentedCode';

interface Props {
  onPressVerify: (code: string, handleError: (error: string) => void) => void;
}

const Verification = ({ onPressVerify }: Props) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isPinReady, setIsPinReady] = useState(false);

  function handleVerifyPress() {
    onPressVerify(code, (error: string) => {
      setError(error);
    });
  }

  return (
    <View>
      <Text className="text-2xl font-bold">Verifique seu email 📧</Text>
      <Text className="mt-2 text-gray-500">
        Enviamos um código de seis digitos para o seu email. Insira o código abaixo para prosseguir
        com a criação da sua conta.
      </Text>
      <View className="py-4">
        <SegmentedCode code={code} setCode={setCode} setIsPinReady={setIsPinReady} />
        {error && <Text className="mt-2 text-center text-red-500">{error}</Text>}
      </View>
      <PrimaryButton onPress={handleVerifyPress} label="Confirmar email" isDisabled={!isPinReady} />
    </View>
  );
};

export default Verification;
