"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

export default function DownloadApp() {
  const t = useTranslations("download");

  // You'll need to replace these with your actual app store URLs
  const IOS_APP_STORE_URL = "https://apps.apple.com/us/app/id6745024708";
  const ANDROID_PLAY_STORE_URL =
    "https://play.google.com/store/apps/details?id=com.bodok.chooselife&hl=pt";
  const APP_SCHEME = "com.bodok.chooselife://"; // Your deep link scheme

  function isIOS() {
    return (
      navigator.userAgent.match(/iPhone/i) ||
      navigator.userAgent.match(/iPhone Simulator/i)
    );
  }

  // Check if device is Android
  function isAndroid() {
    return /Android/i.test(navigator.userAgent);
  }

  useEffect(() => {
    if (isIOS()) {
      window.location.href = IOS_APP_STORE_URL;
      return;
    }

    if (isAndroid()) {
      window.location.href = ANDROID_PLAY_STORE_URL;
    }

    // Try to open the app first if it's installed
    setTimeout(() => {
      window.location.href = APP_SCHEME;
    }, 25);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h1 className="mb-6 text-3xl font-bold">{t("title")}</h1>

      <div className="flex flex-col gap-4 md:flex-row">
        <a
          href={IOS_APP_STORE_URL}
          className="flex items-center justify-center rounded-lg bg-black px-6 py-3 text-white"
        >
          <svg className="mr-2 h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          {t("ios")}
        </a>

        <a
          href={ANDROID_PLAY_STORE_URL}
          className="flex items-center justify-center rounded-lg bg-green-600 px-6 py-3 text-white"
        >
          <svg className="mr-2 h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.9,2.4C17.3,1.6,16.4,1,15.5,1c-0.2,0-0.4,0-0.6,0.1l-5.8,3.5L5.2,1.2C5,1.1,4.8,1,4.6,1C3.6,1,2.7,1.7,2.1,2.5 C1.6,3.1,1.3,3.9,1.3,4.7v14.7c0,0.8,0.3,1.6,0.8,2.2C2.8,22.4,3.6,23,4.6,23c0.2,0,0.4-0.1,0.6-0.1l4-2.3l5.8,3.4 c0.2,0.1,0.4,0.1,0.6,0.1c0.9,0,1.7-0.6,2.3-1.4c0.5-0.6,0.8-1.4,0.8-2.2V4.7C18.7,3.9,18.4,3.1,17.9,2.4z M5.3,20.9 c-0.1,0-0.1,0-0.2,0c-0.4,0-0.8-0.3-1.1-0.7C3.8,19.9,3.6,19.5,3.6,19V5c0-0.5,0.1-0.9,0.4-1.3c0.3-0.4,0.7-0.7,1.1-0.7 c0.1,0,0.1,0,0.2,0l3.4,2L5.3,20.9z M16.4,20.3c-0.3,0.4-0.7,0.7-1.1,0.7c-0.1,0-0.1,0-0.2,0L5.3,17l3.4-15.1l9.5,5.7 c0.1,0,0.1,0.1,0.2,0.1c0.4,0,0.8-0.3,1.1-0.7c0.3-0.4,0.4-0.8,0.4-1.3v14c0,0.5-0.1,0.9-0.4,1.3H16.4z" />
          </svg>
          {t("android")}
        </a>
      </div>
    </div>
  );
}
