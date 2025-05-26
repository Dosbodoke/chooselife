import { Ionicons } from '@expo/vector-icons';
import {
  createMaterialTopTabNavigator,
  MaterialTopTabNavigationEventMap,
  MaterialTopTabNavigationOptions,
} from '@react-navigation/material-top-tabs';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { useRouter, withLayoutContext } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { Navigator } = createMaterialTopTabNavigator();

export const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

export default function FestivalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBackPress = () => {
    router.push('/');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Custom Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackPress}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Tab Navigator */}
      <MaterialTopTabs
        screenOptions={{
          // Tab Bar Styling
          tabBarStyle: {
            backgroundColor: '#ffffff',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: '#f0f0f0',
            paddingHorizontal: 0,
          },

          // Active Tab Styling
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#8E8E93',

          // Indicator Styling
          tabBarIndicatorStyle: {
            backgroundColor: '#007AFF',
            height: 3,
            borderRadius: 1.5,
          },

          // Label Styling
          tabBarLabelStyle: {
            fontSize: 16,
            fontWeight: '600',
            textTransform: 'none',
            textAlign: 'center',
          },

          // Tab Styling - Equal width distribution
          tabBarItemStyle: {
            flex: 1, // Distribute space equally
            height: 48, // Explicit height
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 0, // Remove inner padding
          },

          // Content Container - Set to full screen width
          tabBarContentContainerStyle: {
            display: 'flex',
            flexDirection: 'row', // Arrange tabs in a row
            flex: 1, // Take full width
          },

          // Smooth animation
          animationEnabled: true,
          swipeEnabled: true,

          // Remove indicator container margin to align with tabs
          tabBarIndicatorContainerStyle: {
            marginHorizontal: 0,
          },

          // Pressable styling
          tabBarPressColor: 'rgba(0, 122, 255, 0.1)',
          tabBarPressOpacity: 0.8,
        }}
      >
        <MaterialTopTabs.Screen
          name="index"
          options={{
            tabBarLabel: 'Programação',
          }}
        />
        <MaterialTopTabs.Screen
          name="ranking"
          options={{
            tabBarLabel: 'Ranking',
          }}
        />
        <MaterialTopTabs.Screen
          name="schedule"
          options={{
            tabBarLabel: 'Vias',
          }}
        />
      </MaterialTopTabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    borderRadius: 20,
  },
});
