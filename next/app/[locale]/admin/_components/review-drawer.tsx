"use client";

import { AlertTriangle, Check, Link2, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { copyViewLink, profilePath } from "@/lib/admin-review-link";

/**
 * The pieces every /admin drawer is built from, whichever record it opened on:
 * a fixed header naming the person, one scrolling body, and an optional footer
 * that stays put for decisions. The responsive shell around them lives in
 * `billing-workspace-layout.tsx`.
 */

export type ReviewPerson = {
  name: string | null;
  handle: string | null;
};

/**
 * Bounded by the drawer, so only the body scrolls -- never the header or footer.
 * `clip`, not `hidden`: a hidden box can still be scrolled by focus, which is
 * how revealing the rejection reason used to push the header off screen.
 */
export function ReviewDrawerFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-clip bg-white">
      {children}
    </div>
  );
}

export function ReviewDrawerHeader({
  closeDisabled = false,
  onClose,
  person,
}: {
  closeDisabled?: boolean;
  onClose: () => void;
  person: ReviewPerson;
}) {
  const t = useTranslations("admin");

  return (
    <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 md:px-7">
      <div className="min-w-0">
        <h2 className="truncate text-xl font-semibold text-slate-950">
          {person.name || t("common.unnamedMember")}
        </h2>
        <p className="truncate text-sm text-slate-500">
          {person.handle ? (
            <Link
              href={profilePath(person.handle)}
              className="rounded-sm font-medium text-blue-700 underline-offset-2 transition-colors hover:text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {person.handle}
            </Link>
          ) : (
            t("common.noHandle")
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <CopyViewLinkButton />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-lg"
          onClick={onClose}
          disabled={closeDisabled}
          aria-label={t("common.closeReview")}
        >
          <X className="size-5" aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}

/**
 * Copies the address bar as it stands, which the ledger keeps in sync with the
 * open filters and the focused member -- so what lands in the recipient's
 * browser is the screen the sender is looking at, not a bare /admin.
 */
function CopyViewLinkButton() {
  const t = useTranslations("admin");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const result = await copyViewLink(navigator.clipboard, window.location.href);
    if (result === "failed") {
      setCopied(false);
      toast.error(t("common.copyLinkFailed"));
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 rounded-lg"
        onClick={copy}
        aria-label={t("common.copyLink")}
        title={t("common.copyLink")}
      >
        {copied ? (
          <Check className="size-5 text-emerald-600" aria-hidden="true" />
        ) : (
          <Link2 className="size-5" aria-hidden="true" />
        )}
      </Button>
      {/* The icon swap is the sighted confirmation; this is its spoken twin. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? t("common.linkCopied") : ""}
      </span>
    </>
  );
}

export function ReviewDrawerBody({ children }: { children: ReactNode }) {
  return (
    <div className="scrollbar min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 py-5 md:px-7">
      {children}
    </div>
  );
}

/**
 * One titled block of the body. `card` boxes it the way the reminder and
 * waiver sections are boxed; lists that bring their own border go without.
 */
export function ReviewSection({
  aside,
  card = false,
  children,
  icon,
  title,
}: {
  aside?: ReactNode;
  card?: boolean;
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section
      className={
        card ? "rounded-2xl border border-slate-200 bg-slate-50/70 p-4" : undefined
      }
    >
      <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-slate-900">
        <span className="text-slate-500 [&_svg]:size-4">{icon}</span>
        {title}
        {aside ? (
          <span className="text-xs font-medium text-slate-500">{aside}</span>
        ) : null}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Label/value pairs in the two-column grid every drawer section uses. */
export function ReviewFieldGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>
  );
}

export function ReviewLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-72 items-center justify-center">
      <Loader2
        className="size-7 animate-spin text-muted-foreground"
        aria-label={label}
        role="status"
      />
    </div>
  );
}

export function ReviewAlert({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <Alert variant="destructive" aria-live="assertive">
      <AlertTriangle className="size-4" aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}

export type ClaimHistoryEntry = {
  detail: string;
  key: string;
  label: string;
};

/** The append-only trail both claim drawers end on: claim states, then audit. */
export function ClaimHistoryList({
  auditEvents,
  auditTitle,
  claimStates,
  claimStatesTitle,
}: {
  auditEvents: ClaimHistoryEntry[];
  auditTitle: string;
  claimStates: ClaimHistoryEntry[];
  claimStatesTitle: string;
}) {
  return (
    <div className="space-y-4">
      <ClaimHistoryGroup entries={claimStates} title={claimStatesTitle} />
      <ClaimHistoryGroup entries={auditEvents} title={auditTitle} />
    </div>
  );
}

function ClaimHistoryGroup({
  entries,
  title,
}: {
  entries: ClaimHistoryEntry[];
  title: string;
}) {
  if (entries.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </p>
      <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {entries.map((entry) => (
          <li
            key={entry.key}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-3 text-sm"
          >
            <span className="font-medium text-slate-900">{entry.label}</span>
            <span className="min-w-0 break-words text-slate-500">
              {entry.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
