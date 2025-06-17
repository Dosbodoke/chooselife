"use client";

import { useState, useEffect } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import HighlineCard from "./HighlineCard";

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

function isMobile(): boolean {
  return isIOS() || isAndroid();
}

// Tipagem para os dados do highline que vêm do Server Component
type HighlineData = NonNullable<
  Awaited<ReturnType<typeof import("../page").default>>["props"]["highline"]
>;

export default function OpenInAPP({ highline }: { highline: HighlineData }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const appScheme = process.env.NEXT_PUBLIC_APP_SCHEME;
  const appleAppId = process.env.NEXT_PUBLIC_APPLE_APP_ID;

  const appUrl = `${appScheme}://highline/${highline.id}`;
  const appStoreUrl = `https://apps.apple.com/app/id${appleAppId}`;
  const playStoreUrl = `https://play.google.com/store/apps/details?id=${appScheme}`;

  // Determina qual store mostrar baseado no dispositivo
  const storeUrl = isIOS() ? appStoreUrl : playStoreUrl;
  const storeName = isIOS() ? "App Store" : "Play Store";

  useEffect(() => {
    // Abre o drawer automaticamente se for um usuário mobile (iOS ou Android)
    if (isMobile()) {
      setIsDrawerOpen(true);
    }
  }, []);

  return (
    <>
      {/* O conteúdo principal da página sempre é renderizado */}
      <HighlineCard highline={highline} />

      {/* O Drawer que será visível no mobile (iOS e Android) */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="mx-auto max-w-md">
          <DrawerHeader className="pb-2 text-center">
            <DrawerTitle className="text-xl font-bold">
              APP ChooseLife
            </DrawerTitle>
          </DrawerHeader>

          <div className="space-y-4 px-6 pb-6">
            {/* Multilingual descriptions */}
            <div className="space-y-2 text-sm text-zinc-600">
              <div className="flex items-center gap-2">
                <span className="text-base">🇺🇸</span>
                <span>Open in app for the full experience</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base">🇧🇷</span>
                <span>Abra no app para a experiência completa</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base">🇪🇸</span>
                <span>Abre en la app para la experiencia completa</span>
              </div>
            </div>

            <a
              href={appUrl}
              className="block w-full rounded-lg bg-accent px-6 py-3 text-center text-base font-semibold text-accent-foreground transition hover:bg-accent/90"
            >
              Choose App
            </a>

            <div className="text-center">
              <a
                href={storeUrl}
                className="text-sm text-zinc-500 hover:underline"
              >
                Download/Baixe/Descargar APP
              </a>
              <div className="mt-1 text-xs text-zinc-400">{storeName}</div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
