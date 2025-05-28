import {
  createMaterialTopTabNavigator,
  MaterialTopTabNavigationEventMap,
  MaterialTopTabNavigationOptions,
} from '@react-navigation/material-top-tabs';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { Stack, useRouter, withLayoutContext } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

const { Navigator } = createMaterialTopTabNavigator();

export const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

export default function FestivalScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen
        options={{
          title: 'FHCL 2025',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <MaterialTopTabs
        screenOptions={{
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
    </>
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
