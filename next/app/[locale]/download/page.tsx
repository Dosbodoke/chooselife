"use client";

import { useTranslations } from "next-intl";
import { use, useEffect } from "react";

type Props = {
  params: Promise<{ locale: string; username: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
};

export default function DownloadApp(props: Props) {
  const params = use(props.params);

  const { locale } = params;
  const t = useTranslations("download");

  // You'll need to replace these with your actual app store URLs
  const IOS_APP_STORE_URL = `https://apps.apple.com/us/app/id${process.env.APPLE_APP_ID}`;
  const ANDROID_PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${process.env.APP_SCHEME}&hl=${locale}`;
  const APP_SCHEME = `${process.env.APP_SCHEME}://`; // Your deep link scheme

  function isIOS() {
    return (
      navigator.userAgent.match(/iPhone/i) ||
      navigator.userAgent.match(/iPhone Simulator/i)
    );
  }

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
          className="flex items-center justify-center gap-2 rounded-lg bg-black px-6 py-3 text-white"
        >
          <div className="h-6 w-6">
            <svg className="mr-2 h-6 w-6" viewBox="0 0 24 24" fill="#FFF">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
          </div>

          <span>{t("ios")}</span>
        </a>

        <a
          href={ANDROID_PLAY_STORE_URL}
          className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-white"
        >
          <div className="h-6 w-6">
            <svg viewBox="0 0 128 128">
              <path
                fill="#FFF"
                d="M21.005 43.003c-4.053-.002-7.338 3.291-7.339 7.341l.005 30.736a7.338 7.338 0 007.342 7.343 7.33 7.33 0 007.338-7.342V50.34a7.345 7.345 0 00-7.346-7.337m59.193-27.602l5.123-9.355a1.023 1.023 0 00-.401-1.388 1.022 1.022 0 00-1.382.407l-5.175 9.453c-4.354-1.938-9.227-3.024-14.383-3.019-5.142-.005-10.013 1.078-14.349 3.005L44.45 5.075a1.01 1.01 0 00-1.378-.406 1.007 1.007 0 00-.404 1.38l5.125 9.349c-10.07 5.193-16.874 15.083-16.868 26.438l66.118-.008c.002-11.351-6.79-21.221-16.845-26.427M48.942 29.858a2.772 2.772 0 01.003-5.545 2.78 2.78 0 012.775 2.774 2.776 2.776 0 01-2.778 2.771m30.106-.005a2.77 2.77 0 01-2.772-2.771 2.793 2.793 0 012.773-2.778 2.79 2.79 0 012.767 2.779 2.767 2.767 0 01-2.768 2.77M31.195 44.39l.011 47.635a7.822 7.822 0 007.832 7.831l5.333.002.006 16.264c-.001 4.05 3.291 7.342 7.335 7.342 4.056 0 7.342-3.295 7.343-7.347l-.004-16.26 9.909-.003.004 16.263c0 4.047 3.293 7.346 7.338 7.338 4.056.003 7.344-3.292 7.343-7.344l-.005-16.259 5.352-.004a7.835 7.835 0 007.836-7.834l-.009-47.635-65.624.011zm83.134 5.943a7.338 7.338 0 00-7.341-7.339c-4.053-.004-7.337 3.287-7.337 7.342l.006 30.738a7.334 7.334 0 007.339 7.339 7.337 7.337 0 007.338-7.343l-.005-30.737z"
              ></path>
            </svg>
          </div>

          <span>{t("android")}</span>
        </a>
      </div>
    </div>
  );
}
