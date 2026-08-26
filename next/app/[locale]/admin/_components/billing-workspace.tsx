"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { useState } from "react";

import {
  memberLedgerParsers,
  type MemberTableRow,
  resolvePeriodRows,
} from "@/components/admin/member-ledger";
import { useRouter } from "@/i18n/navigation";
import type {
  BillingWorkspaceClaimDetail,
  BillingWorkspaceOrganization,
  BillingWorkspacePaymentRow,
  BillingWorkspacePersonRow,
  BillingWorkspaceQueueRow,
} from "@/lib/billing-workspace";
import { buildBillingWorkspaceMemberRows } from "@/lib/billing-workspace-ledger";
import { supabaseBrowser } from "@/utils/supabase/client";

import BillingWorkspaceClaimReview from "./billing-workspace-claim-review";
import BillingWorkspaceLayout from "./billing-workspace-layout";
import BillingWorkspaceLedger from "./billing-workspace-ledger";
import BillingWorkspaceMemberReview from "./billing-workspace-member-review";
import {
  InitialPaymentClaimReview,
  type ReviewAction,
} from "./initial-payment-claim-review";

type RpcError = {
  code?: string;
  message?: string;
};

type WorkspaceData = {
  payments: BillingWorkspacePaymentRow[];
  people: BillingWorkspacePersonRow[];
};

type ClaimDetailEnvelope =
  | { kind: "initial"; detail: import("@/lib/initial-payment-claims").InitialPaymentClaimDetail }
  | { kind: "recurring"; detail: BillingWorkspaceClaimDetail };

type DecisionVariables = {
  action: Exclude<ReviewAction, null>;
  claim: BillingWorkspaceQueueRow;
  reason?: string;
};

type WorkspaceErrorCopy = {
  concurrent: string;
  unauthorized: string;
  checkInformation: string;
  decisionNotCompleted: string;
  claimNoLongerActionable: string;
  rejectionReasonRequired: string;
};

const supabase = supabaseBrowser();

function getRpcErrorMessage(error: RpcError, copy: WorkspaceErrorCopy) {
  if (error.code === "40001") return copy.concurrent;
  if (error.code === "42501") return copy.unauthorized;
  if (error.code === "22023") return error.message || copy.checkInformation;
  return copy.decisionNotCompleted;
}

async function fetchWorkspaceData(
  organizationId: string,
): Promise<WorkspaceData> {
  const [peopleResult, paymentsResult] = await Promise.all([
    supabase.rpc("get_billing_workspace_people", {
      p_organization_id: organizationId,
    }),
    supabase.rpc("get_billing_workspace_payments", {
      p_organization_id: organizationId,
    }),
  ]);

  if (peopleResult.error) throw peopleResult.error;
  if (paymentsResult.error) throw paymentsResult.error;

  return {
    people: peopleResult.data ?? [],
    payments: paymentsResult.data ?? [],
  };
}

function memberToClaim(member: MemberTableRow): BillingWorkspaceQueueRow | null {
  const period = member.selectedPeriod;
  if (!period.claimId || !period.obligationId || !period.obligationKind) {
    return null;
  }

  return {
    claim_id: period.claimId,
    obligation_id: period.obligationId,
    organization_id: "",
    purpose: period.obligationKind,
    member_user_id: member.id,
    member_name: member.name,
    member_handle: member.handle,
    member_profile_picture: member.profilePicture,
    payer_type: "applicant",
    payer_name: "",
    plan_type: member.plan ?? "monthly",
    amount: period.amount ?? 0,
    currency: period.currency,
    period_key: period.periodKey,
    period_start: period.periodKey ? `${period.periodKey}-01` : "",
    period_end: period.dueDate ?? "",
    available_on: period.availableDate ?? "",
    due_on: period.dueDate ?? "",
    claim_created_at: period.claimCreatedAt ?? "",
    claim_decided_at: period.claimDecidedAt ?? "",
    claim_decision_reason: period.claimReason ?? "",
    claim_status: period.claimStatus ?? "under_review",
    attempt_count: 1,
    approve_command:
      period.obligationKind === "initial_admission"
        ? "approve_initial_claim"
        : "approve_recurring_payment_claim",
    reject_command:
      period.obligationKind === "initial_admission"
        ? "reject_initial_claim"
        : "reject_recurring_payment_claim",
  } as unknown as BillingWorkspaceQueueRow;
}

export default function BillingWorkspace({
  organizations,
}: {
  organizations: BillingWorkspaceOrganization[];
}) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("admin");
  const queryClient = useQueryClient();
  const errorCopy: WorkspaceErrorCopy = {
    concurrent: t("errors.concurrent"),
    unauthorized: t("errors.unauthorized"),
    checkInformation: t("errors.checkInformation"),
    decisionNotCompleted: t("errors.decisionNotCompleted"),
    claimNoLongerActionable: t("errors.claimNoLongerActionable"),
    rejectionReasonRequired: t("errors.rejectionReasonRequired"),
  };
  // The drawer is addressed by the same URL the ledger filters live in, so a
  // pasted link reopens on the exact person the sender was looking at.
  const [memberId, setMemberId] = useQueryState(
    "member",
    memberLedgerParsers.member,
  );
  const [periodKey] = useQueryState("period", memberLedgerParsers.period);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [focusedMemberId, setFocusedMemberId] = useState(memberId);

  // Moving to another person mid-review must not carry that review's typed
  // rejection reason or error across with it.
  if (focusedMemberId !== memberId) {
    setFocusedMemberId(memberId);
    setRejectionReason("");
    setActionError(null);
  }

  const activeOrganizationId = organizations[0]?.organization_id ?? "";

  const workspaceQuery = useQuery<WorkspaceData, RpcError>({
    queryKey: ["billing-workspace", activeOrganizationId],
    queryFn: () => fetchWorkspaceData(activeOrganizationId),
    enabled: activeOrganizationId.length > 0,
  });

  const workspaceData = workspaceQuery.data ?? { people: [], payments: [] };
  const ledger = buildBillingWorkspaceMemberRows(
    workspaceData.people,
    workspaceData.payments,
    locale.toLowerCase().startsWith("pt") ? "pt-BR" : "en-US",
  );

  const selectedMember =
    memberId === null
      ? null
      : (resolvePeriodRows(ledger.rows, periodKey, ledger.periodOptions).find(
          (row) => row.id === memberId,
        ) ?? null);
  const selectedClaim = selectedMember ? memberToClaim(selectedMember) : null;

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
      void setMemberId(null);
      setRejectionReason("");
      setActionError(null);
      router.refresh();
    },
    onError: async (error) => {
      setActionError(getRpcErrorMessage(error, errorCopy));
      if (error.code === "40001") {
        await queryClient.invalidateQueries({
          queryKey: ["billing-workspace", activeOrganizationId],
        });
        await detailQuery.refetch();
      }
    },
  });

  const closeReview = () => {
    if (decisionMutation.isPending) return;
    void setMemberId(null);
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

  const reviewSurface = selectedClaim ? (
    selectedClaim.purpose === "initial_admission" ? (
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
        onClose={closeReview}
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
        onClose={closeReview}
        onReject={handleReject}
        rejectionReason={rejectionReason}
        onRejectionReasonChange={setRejectionReason}
      />
    )
  ) : selectedMember ? (
    <BillingWorkspaceMemberReview
      member={selectedMember}
      onClose={closeReview}
      organizationId={activeOrganizationId}
    />
  ) : null;

  return (
    <BillingWorkspaceLayout
      organizations={organizations}
      memberCount={ledger.rows.length}
      workspaceIsPending={workspaceQuery.isPending}
      workspaceErrorMessage={
        workspaceQuery.error
          ? getRpcErrorMessage(workspaceQuery.error, errorCopy)
          : null
      }
      workspaceHasLoadedLedger={Boolean(workspaceQuery.data)}
      ledger={
        <BillingWorkspaceLedger
          key={activeOrganizationId}
          data={ledger.rows}
          periodOptions={ledger.periodOptions}
        />
      }
      reviewOpen={selectedMember !== null}
      reviewSurface={reviewSurface}
      onCloseReview={closeReview}
    />
  );
}
