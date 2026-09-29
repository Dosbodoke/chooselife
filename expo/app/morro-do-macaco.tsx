import { Stack } from 'expo-router';
import { Text, View } from 'react-native';

import RockViewer from '~/components/rock-viewer';

export default function MorroDoMacacoScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#e9e7e2' }}>
      <Stack.Screen options={{ title: 'Morro do Macaco' }} />
      <RockViewer dom={{ style: { flex: 1 }, scrollEnabled: false }} />
      <View style={{ paddingHorizontal: 20, paddingVertical: 14 }}>
        <Text style={{ color: '#333333', textAlign: 'center' }}>
          Drag to rotate · Pinch to zoom
        </Text>
      </View>
    </View>
  );
}
