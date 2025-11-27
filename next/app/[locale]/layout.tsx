import "./globals.css";

import { Analytics } from "@vercel/analytics/react";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { Footer } from "@/components/Footer";
import NavBar from "@/components/layout/navbar";
import { routing } from "@/i18n/routing";
import type { Locales } from "@/utils/supabase/database.types";

import UsernameDialog from "./_components/UsernameDialog";
import Providers from "./Providers";

const APP_NAME = "Chooselife";
const APP_DEFAULT_TITLE = "Chooselife";
const APP_TITLE_TEMPLATE = "%s - Chooselife";
const APP_DESCRIPTION = "O aplicativo feito para o Highliner";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  keywords: ["Highline", "Slackline", "Slackmap", "Freestyle"],
  applicationName: APP_NAME,
  title: {
    default: APP_DEFAULT_TITLE,
    template: APP_TITLE_TEMPLATE,
  },
  description: APP_DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_DEFAULT_TITLE,
    // startUpImage: [],
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
    images: ["/icon.png"],
  },
  twitter: {
    card: "summary",
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
  },
  other: {
    "apple-itunes-app": `app-id=${process.env.NEXT_PUBLIC_APPLE_APP_ID}, app-argument=${BASE_URL}`,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    // suppressHydrationWarning because of `next-themes`
    // refer to https://github.com/pacocoursey/next-themes#with-app
    <html lang={locale} suppressHydrationWarning>
      <body className={`min-h-screen md:px-0 ${GeistSans.variable} font-sans`}>
        <Providers locale={locale as Locales} messages={messages}>
          <div className="relative flex h-full min-h-screen flex-col">
            <NavBar />
            <main className="flex-1">
              <UsernameDialog />
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
