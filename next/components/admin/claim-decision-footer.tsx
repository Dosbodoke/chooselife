"use client";

import { Check, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type ClaimReviewAction = "approve" | "reject" | null;

export function ClaimResolvedNotice({
  message,
  status,
}: {
  message: string;
  status: "approved" | "rejected" | string;
}) {
  return (
    <div className="shrink-0 border-t bg-muted/20 px-5 py-4 md:px-7">
      <div className="flex items-start gap-3 text-sm text-muted-foreground">
        {status === "approved" ? (
          <CheckCircle2
            className="mt-0.5 size-5 shrink-0 text-emerald-600"
            aria-hidden="true"
          />
        ) : (
          <XCircle
            className="mt-0.5 size-5 shrink-0 text-destructive"
            aria-hidden="true"
          />
        )}
        <p>{message}</p>
      </div>
    </div>
  );
}

/**
 * Two-step decision footer: the rejection reason only exists once the reviewer
 * has chosen to reject, so the default footer stays a plain approve/reject
 * choice.
 */
export function ClaimDecisionFooter({
  action,
  copy,
  onApprove,
  onReject,
  onRejectionReasonChange,
  reasonInputId,
  rejectionReason,
}: {
  action: ClaimReviewAction;
  copy: {
    approve: string;
    cancel: string;
    confirmRejection: string;
    reject: string;
    rejectionPlaceholder: string;
    rejectionReason: string;
  };
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  onRejectionReasonChange: (value: string) => void;
  reasonInputId: string;
  rejectionReason: string;
}) {
  const [isRejecting, setIsRejecting] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  // Move focus to the reason as soon as it appears, so the reveal does not
  // strand keyboard users on a button that has just been replaced.
  useEffect(() => {
    if (isRejecting) reasonRef.current?.focus();
  }, [isRejecting]);

  if (!isRejecting) {
    return (
      <FooterShell>
        <FooterButtonRow>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsRejecting(true)}
            disabled={action !== null}
            className="h-11 rounded-xl px-5 text-destructive hover:bg-destructive/5 hover:text-destructive active:scale-[0.96]"
          >
            <XCircle className="mr-2 size-4" aria-hidden="true" />
            {copy.reject}
          </Button>
          <Button
            type="button"
            onClick={() => void onApprove()}
            disabled={action !== null}
            className="h-11 rounded-xl px-5 active:scale-[0.96]"
          >
            {action === "approve" ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="mr-2 size-4" aria-hidden="true" />
            )}
            {copy.approve}
          </Button>
        </FooterButtonRow>
      </FooterShell>
    );
  }

  return (
    <FooterShell>
      <label htmlFor={reasonInputId} className="text-sm font-medium">
        {copy.rejectionReason}
        <span className="ml-1 text-destructive" aria-hidden="true">
          *
        </span>
      </label>
      <Textarea
        ref={reasonRef}
        id={reasonInputId}
        value={rejectionReason}
        onChange={(event) => onRejectionReasonChange(event.target.value)}
        maxLength={500}
        placeholder={copy.rejectionPlaceholder}
        className="mt-2 min-h-20 rounded-xl"
        disabled={action !== null}
      />
      <FooterButtonRow className="mt-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setIsRejecting(false);
            onRejectionReasonChange("");
          }}
          disabled={action !== null}
          className="h-11 rounded-xl px-5"
        >
          {copy.cancel}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => void onReject()}
          disabled={action !== null}
          className="h-11 rounded-xl px-5 active:scale-[0.96]"
        >
          {action === "reject" ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          ) : (
            <XCircle className="mr-2 size-4" aria-hidden="true" />
          )}
          {copy.confirmRejection}
        </Button>
      </FooterButtonRow>
    </FooterShell>
  );
}

function FooterShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shrink-0 border-t bg-card px-5 py-3 md:px-7">{children}</div>
  );
}

function FooterButtonRow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col-reverse gap-2 sm:flex-row sm:justify-end ${className}`}
    >
      {children}
    </div>
  );
}
