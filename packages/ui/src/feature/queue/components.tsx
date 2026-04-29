"use client";

import type { FormEvent, ReactNode } from "react";

import type { FestivalQueueEntry } from "./types";

export function FestivalQueueSummaryBadge({
  currentLabel,
  currentName,
  waitingCount,
  waitingLabel,
}: {
  currentLabel: string;
  currentName?: string | null;
  waitingCount: number;
  waitingLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="rounded-full bg-orange-500/10 px-3 py-1 font-medium text-orange-700 dark:text-orange-300">
        {waitingCount} {waitingLabel}
      </span>
      {currentName ? (
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-medium text-emerald-700 dark:text-emerald-300">
          {currentLabel}: {currentName}
        </span>
      ) : null}
    </div>
  );
}

export function FestivalQueuePreviewList({
  entries,
  emptyLabel,
  metaLabelByEntryId,
  title,
}: {
  entries: FestivalQueueEntry[];
  emptyLabel: string;
  metaLabelByEntryId?: Record<string, string | undefined>;
  title: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ol className="space-y-2 text-sm">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                entry.status === "called"
                  ? "border-emerald-200 bg-emerald-50/80"
                  : "border-border/60"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate">
                  {entry.queuePosition}. {entry.display_name}
                </p>
                {metaLabelByEntryId?.[entry.id] ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {metaLabelByEntryId[entry.id]}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function FestivalQueueJoinForm({
  buttonLabel,
  helperLabel,
  inputPlaceholder,
  isSubmitting,
  onChange,
  onSubmit,
  value,
}: {
  buttonLabel: string;
  helperLabel?: string;
  inputPlaceholder: string;
  isSubmitting?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  value: string;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
          onChange={(event) => onChange(event.target.value)}
          placeholder={inputPlaceholder}
          value={value}
        />
        {helperLabel ? (
          <p className="text-xs text-muted-foreground">{helperLabel}</p>
        ) : null}
      </div>
      <button
        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {buttonLabel}
      </button>
    </form>
  );
}

export function FestivalQueueActions({
  callNextLabel,
  canLeave,
  canManage,
  isCallingNext,
  isLeaving,
  leaveLabel,
  onCallNext,
  onLeave,
}: {
  callNextLabel: string;
  canLeave: boolean;
  canManage: boolean;
  isCallingNext?: boolean;
  isLeaving?: boolean;
  leaveLabel: string;
  onCallNext: () => void;
  onLeave: () => void;
}) {
  if (!canLeave && !canManage) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {canLeave ? (
        <button
          className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium"
          disabled={isLeaving}
          onClick={onLeave}
          type="button"
        >
          {leaveLabel}
        </button>
      ) : null}
      {canManage ? (
        <button
          className="inline-flex items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
          disabled={isCallingNext}
          onClick={onCallNext}
          type="button"
        >
          {callNextLabel}
        </button>
      ) : null}
    </div>
  );
}

export function FestivalQueuePanelShell({
  badge,
  children,
  description,
  title,
}: {
  badge?: string;
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          {badge ? (
            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              {badge}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
