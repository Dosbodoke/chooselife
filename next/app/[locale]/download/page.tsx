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

  const IOS_APP_STORE_URL = `https://apps.apple.com/us/app/id${process.env.NEXT_PUBLIC_APPLE_APP_ID}`;
  const ANDROID_PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${process.env.NEXT_PUBLIC_APP_SCHEME}&hl=${locale}`;

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
      return;
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h1 className="mb-6 text-3xl font-bold">{t("title")}</h1>
      <div className="flex flex-col gap-4 md:flex-row">
        <a
          href={IOS_APP_STORE_URL}
          className="flex items-center justify-center gap-2 rounded-lg bg-black px-6 py-3 text-white"
        >
          <span>{t("ios")}</span>
        </a>
        <a
          href={ANDROID_PLAY_STORE_URL}
          className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-white"
        >
          <span>{t("android")}</span>
        </a>
      </div>
    </div>
  );
}
