import type { Database, Json } from "@chooselife/database";

export type PaymentReminderPreview =
  Database["public"]["Functions"]["get_membership_payment_reminder_preview"]["Returns"][number];

export type PaymentReminderSent =
  Database["public"]["Functions"]["send_membership_payment_reminder"]["Returns"][number];

/** Why `send_membership_payment_reminder` would refuse, as the RPC spells it. */
export type PaymentReminderBlock =
  | "not_member"
  | "nothing_due"
  | "no_devices"
  | "cooldown";

export type PaymentReminderFailure =
  | PaymentReminderBlock
  | "unauthorized"
  | "unknown";

const BLOCKS: readonly PaymentReminderBlock[] = [
  "not_member",
  "nothing_due",
  "no_devices",
  "cooldown",
];

/**
 * The RPC's `blocked_reason`, or null when a reminder can go out now. A reason
 * this screen does not know yet still blocks: it reads as "unknown", never as
 * permission to send.
 */
export function reminderBlock(
  preview: Pick<PaymentReminderPreview, "blocked_reason"> | null,
): PaymentReminderBlock | "unknown" | null {
  const reason = preview?.blocked_reason;
  if (!reason) return null;
  return BLOCKS.find((block) => block === reason) ?? "unknown";
}

/**
 * The send command refuses with SQLSTATE 22023 and puts the reason in the
 * hint, so the screen can say why instead of a generic failure. Anything it
 * does not recognize is reported as unknown, never as sent.
 */
export function reminderFailure(error: {
  code?: string;
  hint?: string | null;
}): PaymentReminderFailure {
  if (error.code === "42501") return "unauthorized";
  return BLOCKS.find((block) => block === error.hint) ?? "unknown";
}

/**
 * The text exactly as the recipient's device will show it. The Edge Function
 * picks the device language and falls back to Portuguese, and so does this.
 */
export function localizedReminderText(value: Json, language: string): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";

  const text = value as Record<string, Json | undefined>;
  const localized = text[language] ?? text.pt;
  return typeof localized === "string" ? localized : "";
}
