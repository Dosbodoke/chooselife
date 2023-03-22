import { View, Text } from 'react-native';
import React from 'react';
import { RouterOutput } from '@src/utils/trpc';

// Is this the correct way to get types from trpc?
interface HighlineDetailsProps {
  highline: RouterOutput['highline']['createHighline'];
}

const DetailRow = ({ label, value }: { label: string; value: string }) => {
  return (
    <View className="flex flex-row justify-between">
      <Text className="text-base text-neutral-500">{label}</Text>
      <Text className="text-base font-semibold">{value}</Text>
    </View>
  );
};

const HighlineDetails = ({ highline }: HighlineDetailsProps) => {
  return (
    <View className="flex flex-col" style={{ rowGap: 4 }}>
      <DetailRow label="Tipo" value="Highline **mockado" />
      <DetailRow label="Comprimento" value={`${highline?.length}m`} />
      <DetailRow label="Altura" value={`${highline?.height}m`} />
    </View>
  );
};

export default HighlineDetails;
