import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export function useOnlineManager() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Set up the event listener
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online =
        state.isConnected != null &&
        state.isConnected &&
        Boolean(state.isInternetReachable);

      setIsOnline(online);
      onlineManager.setOnline(online);
    });

    // Get the initial state
    NetInfo.fetch().then((state) => {
      const online =
        state.isConnected != null &&
        state.isConnected &&
        Boolean(state.isInternetReachable);
      setIsOnline(online);
      onlineManager.setOnline(online);
    });

    // Clean up
    return () => {
      unsubscribe();
    };
  }, []);

  return isOnline;
}
