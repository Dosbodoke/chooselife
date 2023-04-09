import { TouchableOpacity, Text } from 'react-native';

import { AppleSvg } from '@src/assets';

const LogInWithApple = () => {
  return (
    <TouchableOpacity
      className="flex flex-row items-center justify-center rounded-md border-[1px] border-slate-300 py-3"
      style={{ columnGap: 8 }}>
      <AppleSvg />
      <Text className="text-base font-semibold">Entrar com Apple</Text>
    </TouchableOpacity>
  );
};

export default LogInWithApple;
