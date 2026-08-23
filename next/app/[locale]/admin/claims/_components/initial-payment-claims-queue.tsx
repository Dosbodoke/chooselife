"use client";

import { ShieldCheck } from "lucide-react";
import { useMemo, useReducer } from "react";

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
  InitialPaymentClaimDetail,
  InitialPaymentClaimQueueRow,
} from "@/lib/initial-payment-claims";
import { supabaseBrowser } from "@/utils/supabase/client";

import {
  InitialPaymentClaimReview,
  type ReviewAction,
} from "./initial-payment-claim-review";
import {
  InitialPaymentClaimsList,
  type QueueSort,
  type QueueStatusFilter,
} from "./initial-payment-claims-list";

type QueueState = {
  search: string;
  statusFilter: QueueStatusFilter;
  sort: QueueSort;
  selectedClaimId: string | null;
  selectedDetail: InitialPaymentClaimDetail | null;
  detailLoading: boolean;
  action: ReviewAction;
  actionError: string | null;
  rejectionReason: string;
  resolvedClaimIds: Set<string>;
};

type QueueAction =
  | { type: "search_changed"; value: string }
  | { type: "status_filter_changed"; value: QueueStatusFilter }
  | { type: "sort_changed"; value: QueueSort }
  | { type: "claim_selected"; claimId: string }
  | {
      type: "detail_loaded";
      claimId: string;
      detail: InitialPaymentClaimDetail | null;
      message?: string;
    }
  | { type: "detail_failed"; claimId: string; message: string }
  | { type: "detail_finished"; claimId: string }
  | { type: "action_started"; action: Exclude<ReviewAction, null> }
  | { type: "action_failed"; message: string }
  | { type: "rejection_reason_changed"; value: string }
  | { type: "claim_resolved"; claimId: string }
  | { type: "review_closed" };

const INITIAL_QUEUE_STATE: QueueState = {
  search: "",
  statusFilter: "all",
  sort: "oldest",
  selectedClaimId: null,
  selectedDetail: null,
  detailLoading: false,
  action: null,
  actionError: null,
  rejectionReason: "",
  resolvedClaimIds: new Set(),
};

const supabase = supabaseBrowser();

function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case "search_changed":
      return { ...state, search: action.value };
    case "status_filter_changed":
      return { ...state, statusFilter: action.value };
    case "sort_changed":
      return { ...state, sort: action.value };
    case "claim_selected":
      return {
        ...state,
        selectedClaimId: action.claimId,
        selectedDetail: null,
        detailLoading: true,
        action: null,
        actionError: null,
        rejectionReason: "",
      };
    case "detail_loaded":
      if (state.selectedClaimId !== action.claimId) return state;

      return {
        ...state,
        selectedDetail: action.detail,
        actionError: action.message ?? null,
      };
    case "detail_failed":
      if (state.selectedClaimId !== action.claimId) return state;

      return {
        ...state,
        selectedDetail: null,
        actionError: action.message,
      };
    case "detail_finished":
      if (state.selectedClaimId !== action.claimId) return state;

      return { ...state, detailLoading: false };
    case "action_started":
      return { ...state, action: action.action, actionError: null };
    case "action_failed":
      return { ...state, action: null, actionError: action.message };
    case "rejection_reason_changed":
      return { ...state, rejectionReason: action.value };
    case "claim_resolved": {
      const resolvedClaimIds = new Set(state.resolvedClaimIds);
      resolvedClaimIds.add(action.claimId);

      return {
        ...state,
        selectedClaimId: null,
        selectedDetail: null,
        detailLoading: false,
        action: null,
        actionError: null,
        rejectionReason: "",
        resolvedClaimIds,
      };
    }
    case "review_closed":
      return {
        ...state,
        selectedClaimId: null,
        selectedDetail: null,
        detailLoading: false,
        actionError: null,
        rejectionReason: "",
      };
  }
}

function getRpcErrorMessage(error: { code?: string; message?: string }) {
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

export default function InitialPaymentClaimsQueue({
  initialClaims,
}: {
  initialClaims: InitialPaymentClaimQueueRow[];
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(queueReducer, INITIAL_QUEUE_STATE);

  const visibleClaims = useMemo(() => {
    const normalizedSearch = state.search.trim().toLowerCase();
    const filteredClaims = initialClaims.filter((claim) => {
      if (state.resolvedClaimIds.has(claim.claim_id)) return false;
      if (
        state.statusFilter !== "all" &&
        claim.claim_status !== state.statusFilter
      ) {
        return false;
      }

      if (!normalizedSearch) return true;

      return [
        claim.applicant_name,
        claim.applicant_handle,
        claim.payer_name,
        claim.organization_name,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch));
    });

    return [...filteredClaims].sort((left, right) => {
      if (state.sort === "amount") return right.amount - left.amount;
      if (state.sort === "applicant") {
        return (
          left.applicant_name ||
          left.applicant_handle ||
          ""
        ).localeCompare(right.applicant_name || right.applicant_handle || "");
      }

      const leftDate = new Date(left.claim_created_at).getTime();
      const rightDate = new Date(right.claim_created_at).getTime();
      return state.sort === "newest"
        ? rightDate - leftDate
        : leftDate - rightDate;
    });
  }, [initialClaims, state]);

  const loadDetail = async (claimId: string, showLoading = true) => {
    if (showLoading) {
      dispatch({ type: "claim_selected", claimId });
    }

    try {
      const { data, error } = await supabase.rpc(
        "get_initial_payment_claim_detail",
        { p_claim_id: claimId },
      );

      if (error) {
        dispatch({
          type: "detail_failed",
          claimId,
          message: getRpcErrorMessage(error),
        });
      } else if (data?.[0]) {
        dispatch({
          type: "detail_loaded",
          claimId,
          detail: data[0],
        });
      } else {
        dispatch({
          type: "detail_loaded",
          claimId,
          detail: null,
          message:
            "This claim is no longer available to your reviewer scope. Refresh the queue.",
        });
      }
    } catch {
      dispatch({
        type: "detail_failed",
        claimId,
        message: "The claim details could not be loaded. Try again.",
      });
    } finally {
      if (showLoading) {
        dispatch({ type: "detail_finished", claimId });
      }
    }
  };

  const openClaim = async (claimId: string) => {
    await loadDetail(claimId);
  };

  const closeClaim = () => {
    if (state.action) return;
    dispatch({ type: "review_closed" });
  };

  const handleApprove = async () => {
    const claimId = state.selectedClaimId;
    if (!claimId || state.action) return;

    dispatch({ type: "action_started", action: "approve" });

    try {
      const { error } = await supabase.rpc("approve_initial_claim", {
        p_claim_id: claimId,
      });

      if (error) {
        dispatch({
          type: "action_failed",
          message: getRpcErrorMessage(error),
        });
        if (error.code === "40001") {
          await loadDetail(claimId, false);
          router.refresh();
        }
        return;
      }

      dispatch({ type: "claim_resolved", claimId });
      router.refresh();
    } catch {
      dispatch({
        type: "action_failed",
        message: "The decision could not be completed. Try again.",
      });
    }
  };

  const handleReject = async () => {
    const claimId = state.selectedClaimId;
    if (!claimId || state.action) return;

    const normalizedReason = state.rejectionReason.trim().replace(/\s+/g, " ");
    if (!normalizedReason) {
      dispatch({
        type: "action_failed",
        message: "A rejection reason is required.",
      });
      return;
    }

    dispatch({ type: "action_started", action: "reject" });

    try {
      const { error } = await supabase.rpc("reject_initial_claim", {
        p_claim_id: claimId,
        p_reason: normalizedReason,
      });

      if (error) {
        dispatch({
          type: "action_failed",
          message: getRpcErrorMessage(error),
        });
        if (error.code === "40001") {
          await loadDetail(claimId, false);
          router.refresh();
        }
        return;
      }

      dispatch({ type: "claim_resolved", claimId });
      router.refresh();
    } catch {
      dispatch({
        type: "action_failed",
        message: "The decision could not be completed. Try again.",
      });
    }
  };

  const reviewSurface = (
    <InitialPaymentClaimReview
      action={state.action}
      actionError={state.actionError}
      detail={state.selectedDetail}
      detailLoading={state.detailLoading}
      onApprove={handleApprove}
      onClose={closeClaim}
      onReject={handleReject}
      rejectionReason={state.rejectionReason}
      onRejectionReasonChange={(value) =>
        dispatch({ type: "rejection_reason_changed", value })
      }
    />
  );

  return (
    <section className="min-h-[calc(100vh-5rem)] bg-muted/20 px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Association administration
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">
              Initial payment claims
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Verify a payment and admit one applicant at a time. Every action
              is checked and committed by the database as one decision.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm shadow-sm">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="text-sm font-semibold tabular-nums">
                {visibleClaims.length}
              </span>
            </span>
            <span className="text-muted-foreground">visible claims</span>
          </div>
        </div>

        <InitialPaymentClaimsList
          claims={visibleClaims}
          initialClaimsCount={initialClaims.length}
          onOpenClaim={(claimId) => void openClaim(claimId)}
          onSearchChange={(value) =>
            dispatch({ type: "search_changed", value })
          }
          onSortChange={(value) => dispatch({ type: "sort_changed", value })}
          onStatusFilterChange={(value) =>
            dispatch({ type: "status_filter_changed", value })
          }
          search={state.search}
          sort={state.sort}
          statusFilter={state.statusFilter}
        />
      </div>

      <div className="hidden md:block">
        <Dialog
          open={state.selectedClaimId !== null}
          onOpenChange={(open) => {
            if (!open) closeClaim();
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden rounded-3xl p-0">
            <DialogHeader className="sr-only">
              <DialogTitle>Review initial payment claim</DialogTitle>
              <DialogDescription>
                Inspect the submitted application revision and decide this
                payment claim.
              </DialogDescription>
            </DialogHeader>
            {reviewSurface}
          </DialogContent>
        </Dialog>
      </div>

      <div className="md:hidden">
        <Drawer
          open={state.selectedClaimId !== null}
          onOpenChange={(open) => {
            if (!open) closeClaim();
          }}
        >
          <DrawerContent className="max-h-[96vh] overflow-hidden rounded-t-3xl p-0">
            <DrawerHeader className="sr-only">
              <DrawerTitle>Review initial payment claim</DrawerTitle>
              <DrawerDescription>
                Inspect the submitted application revision and decide this
                payment claim.
              </DrawerDescription>
            </DrawerHeader>
            {reviewSurface}
          </DrawerContent>
        </Drawer>
      </div>
    </section>
  );
}
