"use client";

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
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
import type {
  BillingWorkspaceMemberRow,
  BillingWorkspaceOrganization,
  BillingWorkspacePaymentRow,
  BillingWorkspaceQueueRow,
  BillingWorkspaceView,
} from "@/lib/billing-workspace";

import BillingWorkspaceMembers from "./billing-workspace-members";
import BillingWorkspacePayments from "./billing-workspace-payments";
import BillingWorkspaceQueue, {
  WorkspaceHeading,
} from "./billing-workspace-queue";

type BillingWorkspaceLayoutProps = {
  organizations: BillingWorkspaceOrganization[];
  activeOrganizationId: string;
  view: BillingWorkspaceView;
  queue: BillingWorkspaceQueueRow[];
  payments: BillingWorkspacePaymentRow[];
  members: BillingWorkspaceMemberRow[];
  workspaceIsPending: boolean;
  workspaceIsFetching: boolean;
  workspaceErrorMessage: string | null;
  workspaceHasLoadedQueue: boolean;
  reviewOpen: boolean;
  reviewSurface: ReactNode;
  onOrganizationChange: (organizationId: string) => void;
  onViewChange: (view: BillingWorkspaceView) => void;
  onRefresh: () => void;
  onOpenClaim: (claim: BillingWorkspaceQueueRow) => void;
  onCloseReview: () => void;
};

export default function BillingWorkspaceLayout({
  organizations,
  activeOrganizationId,
  view,
  queue,
  payments,
  members,
  workspaceIsPending,
  workspaceIsFetching,
  workspaceErrorMessage,
  workspaceHasLoadedQueue,
  reviewOpen,
  reviewSurface,
  onOrganizationChange,
  onViewChange,
  onRefresh,
  onOpenClaim,
  onCloseReview,
}: BillingWorkspaceLayoutProps) {
  const selectedOrganization =
    organizations.find(
      (organization) => organization.organization_id === activeOrganizationId,
    ) ?? organizations[0];

  if (organizations.length === 0) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-3xl items-center px-4 py-12 md:px-6">
        <div className="w-full rounded-3xl border bg-card p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Association administration
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            No billing workspace access
          </h1>
          <p className="mt-3 text-muted-foreground">
            An authorized association admin can review payment claims and member
            financial standing here.
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
              Association
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
              {view === "queue"
                ? `${queue.filter((claim) => claim.claim_status === "under_review").length} awaiting review`
                : view === "payments"
                  ? `${payments.length} obligations`
                  : `${members.length} active members`}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onRefresh}
              disabled={workspaceIsFetching}
              aria-label="Refresh workspace"
            >
              <RefreshCw
                className={
                  workspaceIsFetching ? "size-4 animate-spin" : "size-4"
                }
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>

        <div
          className="mb-6 flex flex-wrap gap-2 rounded-2xl border bg-card p-2"
          role="tablist"
          aria-label="Billing workspace views"
        >
          {(
            [
              ["queue", "Queue"],
              ["payments", "Payments"],
              ["members", "Members"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => onViewChange(value)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                view === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <WorkspaceHeading
          view={view}
          organizationName={
            selectedOrganization?.organization_name ?? "Association"
          }
        />

        {workspaceIsPending ? (
          <div className="mt-8 flex min-h-72 items-center justify-center rounded-3xl border bg-card">
            <Loader2
              className="size-7 animate-spin text-muted-foreground"
              aria-label="Loading workspace"
            />
          </div>
        ) : workspaceErrorMessage ? (
          <Alert variant="destructive" className="mt-8">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertTitle>Workspace unavailable</AlertTitle>
            <AlertDescription>
              {workspaceErrorMessage} Try refreshing the workspace.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="mt-8">
            {view === "queue" ? (
              <BillingWorkspaceQueue
                key={activeOrganizationId}
                claims={queue}
                onOpenClaim={onOpenClaim}
              />
            ) : view === "payments" ? (
              <BillingWorkspacePayments
                key={activeOrganizationId}
                payments={payments}
              />
            ) : (
              <BillingWorkspaceMembers
                key={activeOrganizationId}
                members={members}
              />
            )}
          </div>
        )}
      </div>

      <div className="hidden md:block">
        <Dialog
          open={reviewOpen}
          onOpenChange={(open) => {
            if (!open) onCloseReview();
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden rounded-3xl p-0">
            <DialogHeader className="sr-only">
              <DialogTitle>Review payment claim</DialogTitle>
              <DialogDescription>
                Inspect the authoritative obligation and decide this claim.
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
              <DrawerTitle>Review payment claim</DrawerTitle>
              <DrawerDescription>
                Inspect the authoritative obligation and decide this claim.
              </DrawerDescription>
            </DrawerHeader>
            {reviewSurface}
          </DrawerContent>
        </Drawer>
      </div>

      {workspaceHasLoadedQueue ? (
        <div className="sr-only" aria-live="polite">
          <CheckCircle2 aria-hidden="true" />
          Workspace loaded with {queue.length} claims.
        </div>
      ) : null}
    </section>
  );
}
