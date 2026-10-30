"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCircle2, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { formatDate, formatDateTime } from "@/components/admin/member-ledger";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  localizedReminderText,
  type PaymentReminderFailure,
  type PaymentReminderPreview,
  type PaymentReminderSent,
  reminderBlock,
  reminderFailure,
} from "@/lib/payment-reminder";
import { supabaseBrowser } from "@/utils/supabase/client";

const supabase = supabaseBrowser();

type RpcError = { code?: string; hint?: string | null; message?: string };

/**
 * One push reminder to one person, reviewed before it goes out.
 *
 * The database decides everything that matters -- who may send, whether this
 * person owes anything, how many devices would receive it, the wording, and the
 * 20-hour cooldown -- and this panel only shows that verdict. Sending enqueues
 * a notification row; the existing webhook attempts delivery asynchronously.
 *
 * Keyed by member in the drawer, so moving to another person starts clean.
 */
export default function BillingWorkspacePaymentReminder({
  memberId,
  organizationId,
}: {
  memberId: string;
  organizationId: string | null;
}) {
  const t = useTranslations("admin.reminder");
  const locale = useLocale();
  const displayLocale = locale.toLowerCase().startsWith("pt") ? "pt-BR" : "en-US";
  const queryClient = useQueryClient();
  const [reviewing, setReviewing] = useState(false);
  const [sent, setSent] = useState<PaymentReminderSent | null>(null);
  const queryKey = ["membership-payment-reminder", organizationId, memberId];

  const previewQuery = useQuery<PaymentReminderPreview | null, RpcError>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_membership_payment_reminder_preview",
        { p_organization_id: organizationId!, p_user_id: memberId },
      );
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: organizationId !== null,
  });

  const sendMutation = useMutation<PaymentReminderSent, RpcError>({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc(
        "send_membership_payment_reminder",
        { p_organization_id: organizationId!, p_user_id: memberId },
      );
      if (error) throw error;
      const row = data?.[0];
      if (!row) throw { code: "unknown" } satisfies RpcError;
      return row;
    },
    onSuccess: (row) => {
      setSent(row);
      setReviewing(false);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      // Refresh after a refusal or a lost response. The command may already
      // have committed even when the client did not receive its result.
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const failureCopy: Record<PaymentReminderFailure, string> = {
    cooldown: t("errors.cooldown"),
    no_devices: t("errors.noDevices"),
    not_member: t("errors.notMember"),
    nothing_due: t("errors.nothingDue"),
    unauthorized: t("errors.unauthorized"),
    unknown: t("errors.unknown"),
  };

  if (previewQuery.isPending) {
    return (
      <ReminderSection title={t("title")}>
        <div role="status" aria-label={t("loading")} className="mt-3 space-y-2">
          <Skeleton className="h-3.5 w-56" />
          <Skeleton className="h-9 w-40 rounded-lg" />
        </div>
      </ReminderSection>
    );
  }

  if (previewQuery.isError) {
    return (
      <ReminderSection title={t("title")}>
        <p className="mt-2 text-sm text-slate-500">{t("unavailable")}</p>
      </ReminderSection>
    );
  }

  const preview = previewQuery.data;
  const block = reminderBlock(preview);

  // Nobody to remind: no section rather than a disabled button nobody needs.
  if (!preview || (!sent && (block === "nothing_due" || block === "not_member"))) {
    return null;
  }

  const recipient = preview.recipient_name || preview.recipient_handle;
  const language = preview.recipient_language ?? "pt";
  const title = localizedReminderText(preview.title, language);
  const body = localizedReminderText(preview.body, language);

  return (
    <ReminderSection title={t("title")}>
      {preview.open_count > 0 ? (
        <p className="mt-1 text-sm text-slate-600">
          {preview.overdue_count > 0
            ? t("overdueSummary", {
                count: preview.overdue_count,
                date: formatDate(preview.oldest_due_on, displayLocale),
              })
            : t("openSummary", { count: preview.open_count })}
        </p>
      ) : null}

      {sent ? (
        <div
          role="status"
          className="mt-3 flex gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {t("sent", {
              count: sent.device_count,
              time: formatDateTime(sent.sent_at, displayLocale),
            })}{" "}
            <span className="text-emerald-800/80">{t("deliveryNote")}</span>
          </span>
        </div>
      ) : block === "cooldown" ? (
        <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-600">
          {t("cooldown", {
            last: formatDateTime(preview.last_sent_at, displayLocale),
            next: formatDateTime(preview.next_available_at, displayLocale),
          })}
        </p>
      ) : block === "no_devices" ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
          {t("noDevices", { name: recipient })}
        </p>
      ) : block ? (
        <p className="mt-3 text-sm text-slate-500">{t("unavailable")}</p>
      ) : reviewing ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <dt className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              {t("to")}
            </dt>
            <dd className="min-w-0 text-slate-900">
              <span className="font-medium">{recipient}</span>
              {preview.recipient_name && preview.recipient_handle ? (
                <span className="text-slate-500"> · {preview.recipient_handle}</span>
              ) : null}
              <span className="block text-xs text-slate-500">
                {t("devices", { count: preview.device_count })} ·{" "}
                {t(`language.${language === "en" ? "en" : "pt"}`)}
              </span>
            </dd>
            <dt className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              {t("message")}
            </dt>
            <dd className="min-w-0 rounded-lg bg-slate-50 px-3 py-2.5">
              <p className="font-semibold text-slate-900">{title}</p>
              <p className="mt-0.5 text-slate-700">{body}</p>
            </dd>
          </dl>

          <p className="mt-3 text-xs text-slate-500">
            {t("deliveryNote")} {t("cooldownNote")}
          </p>

          {sendMutation.isError ? (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {failureCopy[reminderFailure(sendMutation.error)]}
            </p>
          ) : null}

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              disabled={sendMutation.isPending}
              onClick={() => {
                setReviewing(false);
                sendMutation.reset();
              }}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              className="rounded-lg"
              disabled={sendMutation.isPending}
              aria-busy={sendMutation.isPending}
              onClick={() => sendMutation.mutate()}
            >
              {sendMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <BellRing className="size-4" aria-hidden="true" />
              )}
              {sendMutation.isPending ? t("sending") : t("send")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="mt-3 rounded-lg"
          onClick={() => setReviewing(true)}
        >
          <BellRing className="size-4" aria-hidden="true" />
          {t("review")}
        </Button>
      )}
    </ReminderSection>
  );
}

function ReminderSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <BellRing className="size-4 text-slate-500" aria-hidden="true" />
        {title}
      </h3>
      {children}
    </section>
  );
}
