import { useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { Platform } from "react-native";

export function useOnlineManager() {
  useEffect(() => {
    if (Platform.OS !== "web") {
      return NetInfo.addEventListener((state) => {
        const status =
          state.isConnected != null &&
          state.isConnected &&
          Boolean(state.isInternetReachable);
        onlineManager.setOnline(status);
      });
    }
  }, []);
}
