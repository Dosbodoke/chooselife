"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
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
import { useRouter } from "@/i18n/navigation";
import type {
  BillingWorkspaceClaimDetail,
  BillingWorkspaceMemberRow,
  BillingWorkspaceOrganization,
  BillingWorkspacePaymentRow,
  BillingWorkspaceQueueRow,
  BillingWorkspaceView,
  InitialPaymentClaimDetail,
} from "@/lib/billing-workspace";
import { supabaseBrowser } from "@/utils/supabase/client";

import {
  InitialPaymentClaimReview,
  type ReviewAction,
} from "../claims/_components/initial-payment-claim-review";
import BillingWorkspaceClaimReview from "./billing-workspace-claim-review";
import BillingWorkspaceMembers from "./billing-workspace-members";
import BillingWorkspacePayments from "./billing-workspace-payments";
import BillingWorkspaceQueue, {
  WorkspaceHeading,
} from "./billing-workspace-queue";

type RpcError = {
  code?: string;
  message?: string;
};

type WorkspaceData =
  | BillingWorkspaceQueueRow[]
  | BillingWorkspacePaymentRow[]
  | BillingWorkspaceMemberRow[];

type ClaimDetailEnvelope =
  | { kind: "initial"; detail: InitialPaymentClaimDetail }
  | { kind: "recurring"; detail: BillingWorkspaceClaimDetail };

type DecisionVariables = {
  action: Exclude<ReviewAction, null>;
  claim: BillingWorkspaceQueueRow;
  reason?: string;
};

const supabase = supabaseBrowser();

function getRpcErrorMessage(error: RpcError) {
  if (error.code === "40001") {
    return "Another reviewer may have acted on this claim. The review stays open while we refresh the authoritative state.";
  }

  if (error.code === "42501") {
    return "You are not authorized to inspect or decide this claim.";
  }

  if (error.code === "22023") {
    return error.message || "Check the information and try again.";
  }

  return "The decision could not be completed. Nothing was changed; try again.";
}

async function fetchWorkspaceData(
  organizationId: string,
  view: BillingWorkspaceView,
): Promise<WorkspaceData> {
  if (view === "queue") {
    const { data, error } = await supabase.rpc("get_billing_workspace_queue", {
      p_organization_id: organizationId,
    });
    if (error) throw error;
    return data ?? [];
  }

  if (view === "payments") {
    const { data, error } = await supabase.rpc("get_billing_workspace_payments", {
      p_organization_id: organizationId,
    });
    if (error) throw error;
    return data ?? [];
  }

  const { data, error } = await supabase.rpc("get_billing_workspace_members", {
    p_organization_id: organizationId,
  });
  if (error) throw error;
  return data ?? [];
}

export default function BillingWorkspace({
  organizations,
}: {
  organizations: BillingWorkspaceOrganization[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [organizationId, setOrganizationId] = useState(
    organizations[0]?.organization_id ?? "",
  );
  const [view, setView] = useState<BillingWorkspaceView>("queue");
  const [selectedClaim, setSelectedClaim] =
    useState<BillingWorkspaceQueueRow | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedOrganization =
    organizations.find((organization) => organization.organization_id === organizationId) ??
    organizations[0];
  const activeOrganizationId = selectedOrganization?.organization_id ?? "";

  const workspaceQuery = useQuery<WorkspaceData, RpcError>({
    queryKey: ["billing-workspace", activeOrganizationId, view],
    queryFn: () => fetchWorkspaceData(activeOrganizationId, view),
    enabled: activeOrganizationId.length > 0,
  });

  const detailQuery = useQuery<ClaimDetailEnvelope | null, RpcError>({
    queryKey: ["billing-workspace-claim", selectedClaim?.claim_id],
    queryFn: async () => {
      if (!selectedClaim) return null;

      if (selectedClaim.purpose === "initial_admission") {
        const { data, error } = await supabase.rpc(
          "get_initial_payment_claim_detail",
          { p_claim_id: selectedClaim.claim_id },
        );
        if (error) throw error;
        return data?.[0]
          ? { kind: "initial", detail: data[0] }
          : null;
      }

      const { data, error } = await supabase.rpc(
        "get_billing_workspace_claim_detail",
        { p_claim_id: selectedClaim.claim_id },
      );
      if (error) throw error;
      return data?.[0]
        ? { kind: "recurring", detail: data[0] }
        : null;
    },
    enabled: selectedClaim !== null,
  });

  const decisionMutation = useMutation<void, RpcError, DecisionVariables>({
    mutationFn: async ({ action, claim, reason }) => {
      const rpcName =
        action === "approve" ? claim.approve_command : claim.reject_command;

      if (!rpcName) {
        throw {
          code: "40001",
          message: "This claim is no longer actionable. Refresh before deciding.",
        } satisfies RpcError;
      }

      if (action === "approve") {
        const { error } = await (claim.purpose === "initial_admission"
          ? supabase.rpc("approve_initial_claim", {
              p_claim_id: claim.claim_id,
            })
          : supabase.rpc("approve_recurring_payment_claim", {
              p_claim_id: claim.claim_id,
            }));
        if (error) throw error;
        return;
      }

      const normalizedReason = reason?.trim().replace(/\s+/g, " ");
      if (!normalizedReason) {
        throw {
          code: "22023",
          message: "A rejection reason is required.",
        } satisfies RpcError;
      }

      const { error } = await (claim.purpose === "initial_admission"
        ? supabase.rpc("reject_initial_claim", {
            p_claim_id: claim.claim_id,
            p_reason: normalizedReason,
          })
        : supabase.rpc("reject_recurring_payment_claim", {
            p_claim_id: claim.claim_id,
            p_reason: normalizedReason,
          }));
      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["billing-workspace", activeOrganizationId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["billing-workspace-claim", variables.claim.claim_id],
      });
      setSelectedClaim(null);
      setRejectionReason("");
      setActionError(null);
      router.refresh();
    },
    onError: async (error, variables) => {
      setActionError(getRpcErrorMessage(error));
      if (error.code === "40001") {
        await queryClient.invalidateQueries({
          queryKey: ["billing-workspace", activeOrganizationId],
        });
        await detailQuery.refetch();
      }
      void variables;
    },
  });

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
            An authorized association admin can review payment claims and member financial standing here.
          </p>
        </div>
      </section>
    );
  }

  const data = workspaceQuery.data ?? [];
  const queue = view === "queue" ? (data as BillingWorkspaceQueueRow[]) : [];
  const payments = view === "payments" ? (data as BillingWorkspacePaymentRow[]) : [];
  const members = view === "members" ? (data as BillingWorkspaceMemberRow[]) : [];

  const openClaim = (claim: BillingWorkspaceQueueRow) => {
    setActionError(null);
    setRejectionReason("");
    setSelectedClaim(claim);
  };

  const closeClaim = () => {
    if (decisionMutation.isPending) return;
    setSelectedClaim(null);
    setActionError(null);
    setRejectionReason("");
  };

  const handleApprove = async () => {
    if (!selectedClaim || decisionMutation.isPending) return;
    setActionError(null);
    await decisionMutation.mutateAsync({
      action: "approve",
      claim: selectedClaim,
    });
  };

  const handleReject = async () => {
    if (!selectedClaim || decisionMutation.isPending) return;
    await decisionMutation.mutateAsync({
      action: "reject",
      claim: selectedClaim,
      reason: rejectionReason,
    });
  };

  const reviewSurface =
    selectedClaim?.purpose === "initial_admission" ? (
      <InitialPaymentClaimReview
        action={decisionMutation.isPending ? decisionMutation.variables?.action ?? null : null}
        actionError={
          actionError || (detailQuery.error ? getRpcErrorMessage(detailQuery.error) : null)
        }
        detail={detailQuery.data?.kind === "initial" ? detailQuery.data.detail : null}
        detailLoading={detailQuery.isPending}
        onApprove={handleApprove}
        onClose={closeClaim}
        onReject={handleReject}
        rejectionReason={rejectionReason}
        onRejectionReasonChange={setRejectionReason}
      />
    ) : (
      <BillingWorkspaceClaimReview
        action={decisionMutation.isPending ? decisionMutation.variables?.action ?? null : null}
        actionError={
          actionError || (detailQuery.error ? getRpcErrorMessage(detailQuery.error) : null)
        }
        detail={detailQuery.data?.kind === "recurring" ? detailQuery.data.detail : null}
        detailLoading={detailQuery.isPending}
        onApprove={handleApprove}
        onClose={closeClaim}
        onReject={handleReject}
        rejectionReason={rejectionReason}
        onRejectionReasonChange={setRejectionReason}
      />
    );

  return (
    <section className="min-h-[calc(100vh-5rem)] bg-muted/20 px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Association</span>
            <select
              value={activeOrganizationId}
              onChange={(event) => {
                setOrganizationId(event.target.value);
                setSelectedClaim(null);
                setActionError(null);
              }}
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
              onClick={() => void workspaceQuery.refetch()}
              disabled={workspaceQuery.isFetching}
              aria-label="Refresh workspace"
            >
              <RefreshCw
                className={workspaceQuery.isFetching ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border bg-card p-2" role="tablist" aria-label="Billing workspace views">
          {([
            ["queue", "Queue"],
            ["payments", "Payments"],
            ["members", "Members"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => {
                setView(value);
                setSelectedClaim(null);
                setActionError(null);
              }}
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
          organizationName={selectedOrganization?.organization_name ?? "Association"}
        />

        {workspaceQuery.isPending ? (
          <div className="mt-8 flex min-h-72 items-center justify-center rounded-3xl border bg-card">
            <Loader2 className="size-7 animate-spin text-muted-foreground" aria-label="Loading workspace" />
          </div>
        ) : workspaceQuery.error ? (
          <Alert variant="destructive" className="mt-8">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertTitle>Workspace unavailable</AlertTitle>
            <AlertDescription>
              {getRpcErrorMessage(workspaceQuery.error)} Try refreshing the workspace.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="mt-8">
            {view === "queue" ? (
              <BillingWorkspaceQueue
                key={activeOrganizationId}
                claims={queue}
                onOpenClaim={openClaim}
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
          open={selectedClaim !== null}
          onOpenChange={(open) => {
            if (!open) closeClaim();
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
          open={selectedClaim !== null}
          onOpenChange={(open) => {
            if (!open) closeClaim();
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

      {workspaceQuery.data && view === "queue" && queue.length > 0 ? (
        <div className="sr-only" aria-live="polite">
          <CheckCircle2 aria-hidden="true" />
          Workspace loaded with {queue.length} claims.
        </div>
      ) : null}
    </section>
  );
}
