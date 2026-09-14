import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Href, router } from 'expo-router';
import React, { createContext, useContext, useState } from 'react';
import { Platform } from 'react-native';

import { useMountEffect } from '~/hooks/use-mount-effect';
import { registerPushTokenForProfile } from '~/lib/push-token-registration';

import { useAuth } from './auth';
import { useI18n } from './i18n';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type PushNotificationPayload = {
  expoPushToken: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

export async function sendPushNotification({
  expoPushToken,
  title,
  body,
  data,
}: PushNotificationPayload) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data,
  };

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'A channel is needed for the permissions prompt to appear',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }

    // Learn more about projectId:
    // https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectid
    // EAS projectId is used here.
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;
      if (!projectId) {
        throw new Error('Project ID not found');
      }
      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
    } catch (e) {
      console.error('Failed to get an Expo push token:', e);
      return;
    }
  } else {
    console.warn('Must use physical device for Push Notifications');
  }

  return token;
}

interface NotificationContextType {
  expoPushToken: string;
  notification: Notifications.Notification | undefined;
  sendPushNotification: (payload: PushNotificationPayload) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useNotificationObserver();
  const { profile } = useAuth();
  const { locale } = useI18n();

  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState<
    Notifications.Notification | undefined
  >(undefined);

  useMountEffect(() => {
    registerForPushNotificationsAsync().then(
      (token) => token && setExpoPushToken(token),
    );

    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        setNotification(notification);
      },
    );

    return () => {
      notificationListener.remove();
    };
  });

  useQuery({
    queryKey: ['push-token-registration', expoPushToken, profile?.id, locale],
    queryFn: async () => {
      try {
        return await registerPushTokenForProfile({
          expoPushToken,
          locale,
          profileId: profile?.id,
        });
      } catch (error) {
        console.error('Error managing push token:', error);
        throw error;
      }
    },
    enabled: Boolean(expoPushToken && profile?.id),
    refetchOnMount: 'always',
    retry: 1,
    staleTime: 0,
  });

  const contextValue = {
    expoPushToken,
    notification,
    sendPushNotification,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

function useNotificationObserver() {
  useMountEffect(() => {
    let isMounted = true;

    function redirect(notification: Notifications.Notification) {
      const url = notification.request.content.data?.url;
      if (url && typeof url === 'string') {
        router.push(url as Href);
      }
    }

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!isMounted || !response?.notification) {
        return;
      }
      redirect(response?.notification);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        redirect(response.notification);
      },
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  });
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      'useNotification must be used within a NotificationProvider',
    );
  }
  return context;
}
