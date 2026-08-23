"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

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
import BillingWorkspaceLayout from "./billing-workspace-layout";

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

type WorkspaceErrorCopy = {
  concurrent: string;
  unauthorized: string;
  checkInformation: string;
  decisionNotCompleted: string;
  claimNoLongerActionable: string;
  rejectionReasonRequired: string;
};

function getRpcErrorMessage(error: RpcError, copy: WorkspaceErrorCopy) {
  if (error.code === "40001") {
    return copy.concurrent;
  }

  if (error.code === "42501") {
    return copy.unauthorized;
  }

  if (error.code === "22023") {
    return error.message || copy.checkInformation;
  }

  return copy.decisionNotCompleted;
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
    const { data, error } = await supabase.rpc(
      "get_billing_workspace_payments",
      {
        p_organization_id: organizationId,
      },
    );
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
  const t = useTranslations("admin");
  const errorCopy: WorkspaceErrorCopy = {
    concurrent: t("errors.concurrent"),
    unauthorized: t("errors.unauthorized"),
    checkInformation: t("errors.checkInformation"),
    decisionNotCompleted: t("errors.decisionNotCompleted"),
    claimNoLongerActionable: t("errors.claimNoLongerActionable"),
    rejectionReasonRequired: t("errors.rejectionReasonRequired"),
  };
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
    organizations.find(
      (organization) => organization.organization_id === organizationId,
    ) ?? organizations[0];
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
        return data?.[0] ? { kind: "initial", detail: data[0] } : null;
      }

      const { data, error } = await supabase.rpc(
        "get_billing_workspace_claim_detail",
        { p_claim_id: selectedClaim.claim_id },
      );
      if (error) throw error;
      return data?.[0] ? { kind: "recurring", detail: data[0] } : null;
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
          message:
            errorCopy.claimNoLongerActionable,
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
          message: errorCopy.rejectionReasonRequired,
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
      setActionError(getRpcErrorMessage(error, errorCopy));
      if (error.code === "40001") {
        await queryClient.invalidateQueries({
          queryKey: ["billing-workspace", activeOrganizationId],
        });
        await detailQuery.refetch();
      }
      void variables;
    },
  });

  const data = workspaceQuery.data ?? [];
  const queue = view === "queue" ? (data as BillingWorkspaceQueueRow[]) : [];
  const payments =
    view === "payments" ? (data as BillingWorkspacePaymentRow[]) : [];
  const members =
    view === "members" ? (data as BillingWorkspaceMemberRow[]) : [];

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

  const handleOrganizationChange = (nextOrganizationId: string) => {
    setOrganizationId(nextOrganizationId);
    setSelectedClaim(null);
    setActionError(null);
  };

  const handleViewChange = (nextView: BillingWorkspaceView) => {
    setView(nextView);
    setSelectedClaim(null);
    setActionError(null);
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
        action={
          decisionMutation.isPending
            ? (decisionMutation.variables?.action ?? null)
            : null
        }
        actionError={
          actionError ||
          (detailQuery.error
            ? getRpcErrorMessage(detailQuery.error, errorCopy)
            : null)
        }
        detail={
          detailQuery.data?.kind === "initial" ? detailQuery.data.detail : null
        }
        detailLoading={detailQuery.isPending}
        onApprove={handleApprove}
        onClose={closeClaim}
        onReject={handleReject}
        rejectionReason={rejectionReason}
        onRejectionReasonChange={setRejectionReason}
      />
    ) : (
      <BillingWorkspaceClaimReview
        action={
          decisionMutation.isPending
            ? (decisionMutation.variables?.action ?? null)
            : null
        }
        actionError={
          actionError ||
          (detailQuery.error
            ? getRpcErrorMessage(detailQuery.error, errorCopy)
            : null)
        }
        detail={
          detailQuery.data?.kind === "recurring"
            ? detailQuery.data.detail
            : null
        }
        detailLoading={detailQuery.isPending}
        onApprove={handleApprove}
        onClose={closeClaim}
        onReject={handleReject}
        rejectionReason={rejectionReason}
        onRejectionReasonChange={setRejectionReason}
      />
    );

  return (
    <BillingWorkspaceLayout
      organizations={organizations}
      activeOrganizationId={activeOrganizationId}
      view={view}
      queue={queue}
      payments={payments}
      members={members}
      workspaceIsPending={workspaceQuery.isPending}
      workspaceIsFetching={workspaceQuery.isFetching}
      workspaceErrorMessage={
        workspaceQuery.error
          ? getRpcErrorMessage(workspaceQuery.error, errorCopy)
          : null
      }
      workspaceHasLoadedQueue={Boolean(workspaceQuery.data) && queue.length > 0}
      reviewOpen={selectedClaim !== null}
      reviewSurface={reviewSurface}
      onOrganizationChange={handleOrganizationChange}
      onViewChange={handleViewChange}
      onRefresh={() => void workspaceQuery.refetch()}
      onOpenClaim={openClaim}
      onCloseReview={closeClaim}
    />
  );
}
