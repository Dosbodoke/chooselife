import {
  createMaterialTopTabNavigator,
  MaterialTopTabNavigationEventMap,
  MaterialTopTabNavigationOptions,
} from '@react-navigation/material-top-tabs';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { Stack, withLayoutContext } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Navigator } = createMaterialTopTabNavigator();

export const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

export default function FestivalScreen() {
  const { t } = useTranslation();

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
            tabBarLabel: t('app.(festival).tabs.schedule'),
          }}
        />
        <MaterialTopTabs.Screen
          name="ranking"
          options={{
            tabBarLabel: 'Ranking',
          }}
        />
        <MaterialTopTabs.Screen
          name="highlines"
          options={{
            tabBarLabel: 'Highlines',
          }}
        />
      </MaterialTopTabs>
    </>
  );
}
