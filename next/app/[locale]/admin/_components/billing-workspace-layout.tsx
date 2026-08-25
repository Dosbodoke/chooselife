"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useSyncExternalStore } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { BillingWorkspaceOrganization } from "@/lib/billing-workspace";

const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";

function subscribeToDesktopMediaQuery(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);

  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getDesktopMediaQuerySnapshot() {
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function getServerDesktopMediaQuerySnapshot() {
  return false;
}

function useIsDesktop() {
  return useSyncExternalStore(
    subscribeToDesktopMediaQuery,
    getDesktopMediaQuerySnapshot,
    getServerDesktopMediaQuerySnapshot,
  );
}

type BillingWorkspaceLayoutProps = {
  organizations: BillingWorkspaceOrganization[];
  memberCount: number;
  workspaceIsPending: boolean;
  workspaceErrorMessage: string | null;
  workspaceHasLoadedLedger: boolean;
  ledger: ReactNode;
  reviewOpen: boolean;
  reviewSurface: ReactNode;
  onCloseReview: () => void;
};

export default function BillingWorkspaceLayout({
  ledger,
  memberCount,
  onCloseReview,
  organizations,
  reviewOpen,
  reviewSurface,
  workspaceErrorMessage,
  workspaceHasLoadedLedger,
  workspaceIsPending,
}: BillingWorkspaceLayoutProps) {
  const t = useTranslations("admin");
  const isDesktop = useIsDesktop();
  const reviewDirection = isDesktop ? "right" : "bottom";

  if (organizations.length === 0) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-3xl items-center px-4 py-12 md:px-6">
        <div className="w-full rounded-3xl border bg-card p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t("common.associationAdministration")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {t("workspace.noAccessTitle")}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {t("workspace.noAccessDescription")}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-[calc(100dvh-5rem)] min-h-0 flex-col overflow-hidden bg-muted/20 pb-4 md:pb-6">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 md:px-6">
        {workspaceIsPending ? (
          <div className="flex min-h-72 flex-1 items-center justify-center">
            <Loader2
              className="size-7 animate-spin text-muted-foreground"
              aria-label={t("workspace.loadingLabel")}
            />
          </div>
        ) : workspaceErrorMessage ? (
          <Alert variant="destructive" className="shrink-0">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertTitle>{t("workspace.unavailableTitle")}</AlertTitle>
            <AlertDescription>
              {workspaceErrorMessage} {t("workspace.tryRefreshing")}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">{ledger}</div>
        )}
      </div>

      <Drawer
        open={reviewOpen}
        direction={reviewDirection}
        onOpenChange={(open) => {
          if (!open) onCloseReview();
        }}
      >
        <DrawerContent
          direction={reviewDirection}
          className={
            isDesktop
              ? "max-w-xl overflow-hidden rounded-none border-l p-0"
              : "max-h-[96dvh] overflow-hidden rounded-t-3xl p-0"
          }
        >
          <DrawerHeader className="sr-only">
            <DrawerTitle>{t("workspace.reviewTitle")}</DrawerTitle>
            <DrawerDescription>
              {t("workspace.reviewDescription")}
            </DrawerDescription>
          </DrawerHeader>
          {reviewSurface}
        </DrawerContent>
      </Drawer>

      {workspaceHasLoadedLedger ? (
        <div className="sr-only" aria-live="polite">
          <CheckCircle2 aria-hidden="true" />
          {t("ledger.loadedAnnouncement", { count: memberCount })}
        </div>
      ) : null}
    </section>
  );
}
