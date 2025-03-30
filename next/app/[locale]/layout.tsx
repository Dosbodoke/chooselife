import "./globals.css";

import { Analytics } from "@vercel/analytics/react";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { useMessages } from "next-intl";
import { unstable_setRequestLocale } from "next-intl/server";
import { use } from "react";

// import Footer from "@/components/Footer";
import NavBar from "@/components/layout/navbar";
import { locales } from "@/navigation";

import { PromptPwa } from "./_components/PromptPwa";
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
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function RootLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: "en" | "pt" }>;
}) {
  const params = use(props.params);

  const { locale } = params;

  const { children } = props;

  unstable_setRequestLocale(locale);
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale)) notFound();
  const messages = useMessages();

  return (
    // suppressHydrationWarning because of `next-themes`
    // refer to https://github.com/pacocoursey/next-themes#with-app
    (<html lang={locale} suppressHydrationWarning>
      <body className={`min-h-screen md:px-0 ${GeistSans.variable} font-sans`}>
        <Providers locale={locale} messages={messages}>
          <div className="relative flex h-full min-h-screen flex-col">
            <PromptPwa />
            <NavBar />
            <main className="flex-1">
              <UsernameDialog />
              {children}
            </main>
            {/* <Footer /> */}
          </div>
        </Providers>
        <Analytics />
      </body>
    </html>)
  );
}
