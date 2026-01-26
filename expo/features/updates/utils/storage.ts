import AsyncStorage from 'expo-sqlite/kv-store';

const LAST_OTA_CHECK_KEY = 'ota_last_check_timestamp';

/**
 * Save the last OTA check timestamp
 */
export async function setLastOtaCheckTime(): Promise<void> {
  await AsyncStorage.setItem(LAST_OTA_CHECK_KEY, Date.now().toString());
}

/**
 * Get the last OTA check timestamp
 */
export async function getLastOtaCheckTime(): Promise<number | null> {
  const timestamp = await AsyncStorage.getItem(LAST_OTA_CHECK_KEY);
  return timestamp ? parseInt(timestamp, 10) : null;
}
