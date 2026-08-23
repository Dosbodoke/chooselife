"use client";

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { BillingWorkspaceOrganization } from "@/lib/billing-workspace";

type BillingWorkspaceLayoutProps = {
  organizations: BillingWorkspaceOrganization[];
  activeOrganizationId: string;
  memberCount: number;
  workspaceIsPending: boolean;
  workspaceIsFetching: boolean;
  workspaceErrorMessage: string | null;
  workspaceHasLoadedLedger: boolean;
  ledger: ReactNode;
  reviewOpen: boolean;
  reviewSurface: ReactNode;
  onOrganizationChange: (organizationId: string) => void;
  onRefresh: () => void;
  onCloseReview: () => void;
};

export default function BillingWorkspaceLayout({
  activeOrganizationId,
  ledger,
  memberCount,
  onCloseReview,
  onOrganizationChange,
  onRefresh,
  organizations,
  reviewOpen,
  reviewSurface,
  workspaceErrorMessage,
  workspaceHasLoadedLedger,
  workspaceIsFetching,
  workspaceIsPending,
}: BillingWorkspaceLayoutProps) {
  const t = useTranslations("admin");

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
    <section className="min-h-[calc(100vh-5rem)] bg-muted/20 px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">
              {t("common.association")}
            </span>
            <select
              value={activeOrganizationId}
              onChange={(event) => onOrganizationChange(event.target.value)}
              className="h-11 min-w-64 rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
            >
              {organizations.map((organization) => (
                <option
                  key={organization.organization_id}
                  value={organization.organization_id}
                >
                  {organization.organization_name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <Badge variant="outline">
              {t("ledger.peopleCount", { count: memberCount })}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onRefresh}
              disabled={workspaceIsFetching}
              aria-label={t("workspace.refreshLabel")}
            >
              <RefreshCw
                className={workspaceIsFetching ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>

        {workspaceIsPending ? (
          <div className="mt-8 flex min-h-72 items-center justify-center rounded-3xl border bg-card">
            <Loader2
              className="size-7 animate-spin text-muted-foreground"
              aria-label={t("workspace.loadingLabel")}
            />
          </div>
        ) : workspaceErrorMessage ? (
          <Alert variant="destructive" className="mt-8">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertTitle>{t("workspace.unavailableTitle")}</AlertTitle>
            <AlertDescription>
              {workspaceErrorMessage} {t("workspace.tryRefreshing")}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="mt-8">{ledger}</div>
        )}
      </div>

      <div className="hidden md:block">
        <Dialog
          open={reviewOpen}
          onOpenChange={(open) => {
            if (!open) onCloseReview();
          }}
        >
          <DialogContent className="fixed left-auto right-0 top-0 h-full max-h-none w-full max-w-xl translate-x-0 translate-y-0 rounded-none border-l p-0 sm:max-w-xl">
            <DialogHeader className="sr-only">
              <DialogTitle>{t("workspace.reviewTitle")}</DialogTitle>
              <DialogDescription>
                {t("workspace.reviewDescription")}
              </DialogDescription>
            </DialogHeader>
            {reviewSurface}
          </DialogContent>
        </Dialog>
      </div>

      <div className="md:hidden">
        <Drawer
          open={reviewOpen}
          onOpenChange={(open) => {
            if (!open) onCloseReview();
          }}
        >
          <DrawerContent className="max-h-[96vh] overflow-hidden rounded-t-3xl p-0">
            <DrawerHeader className="sr-only">
              <DrawerTitle>{t("workspace.reviewTitle")}</DrawerTitle>
              <DrawerDescription>
                {t("workspace.reviewDescription")}
              </DrawerDescription>
            </DrawerHeader>
            {reviewSurface}
          </DrawerContent>
        </Drawer>
      </div>

      {workspaceHasLoadedLedger ? (
        <div className="sr-only" aria-live="polite">
          <CheckCircle2 aria-hidden="true" />
          {t("ledger.loadedAnnouncement", { count: memberCount })}
        </div>
      ) : null}
    </section>
  );
}
