import * as StoreReview from 'expo-store-review';
import AsyncStorage from "expo-sqlite/kv-store";

const SUCCESSFUL_ACTIONS_KEY = 'successful_actions_count';
const REVIEW_REQUESTED_KEY = 'review_requested';
const MIN_SUCCESSFULLY_ACTIONS = 5

export async function requestReview(): Promise<boolean> {
    try {
      const storedCount = await AsyncStorage.getItem(SUCCESSFUL_ACTIONS_KEY);
      const storedReviewRequested = await AsyncStorage.getItem(REVIEW_REQUESTED_KEY);
      let successfulActions = storedCount ? parseInt(storedCount, 10) : 0;
      let reviewRequested = storedReviewRequested ? JSON.parse(storedReviewRequested) : false;
      
      // Increment successful actions for the current call
      successfulActions++;
  
      // Check conditions and request review
      if (successfulActions >= MIN_SUCCESSFULLY_ACTIONS && !reviewRequested) {
        const hasAction = await StoreReview.hasAction();
        if (hasAction) {
          await StoreReview.requestReview();
          reviewRequested = true;
          // Save updated data to storage
          await AsyncStorage.setItem(SUCCESSFUL_ACTIONS_KEY, successfulActions.toString());
          await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, JSON.stringify(reviewRequested));
          return true; // Review requested successfully
        }
      }
  
			await AsyncStorage.setItem(SUCCESSFUL_ACTIONS_KEY, successfulActions.toString());
			await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, JSON.stringify(reviewRequested));
	
      return false;
    } catch (error) {
      console.error("Error requesting review:", error);
      return false;
    }
  }