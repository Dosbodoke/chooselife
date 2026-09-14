import type { Database } from "@chooselife/database";

export type InitialPaymentClaimQueueRow =
  Database["public"]["Functions"]["get_initial_payment_claim_queue"]["Returns"][number];

export type InitialPaymentClaimDetail =
  Database["public"]["Functions"]["get_initial_payment_claim_detail"]["Returns"][number];

export type ApproveInitialClaimResult =
  Database["public"]["Functions"]["approve_initial_claim"]["Returns"][number];

export type RejectInitialClaimResult =
  Database["public"]["Functions"]["reject_initial_claim"]["Returns"][number];
