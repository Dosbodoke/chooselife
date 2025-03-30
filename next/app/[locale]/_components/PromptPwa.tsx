"use client";

import {
  CheckboxIcon,
  DownloadIcon,
  HomeIcon,
  Share2Icon,
} from "@radix-ui/react-icons";
import { useTranslations } from "next-intl";
import React, { SVGAttributes, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PromptPwa() {
  const t = useTranslations("promptPwa");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    function isLastPromptTimeWithin1Hour() {
      const now = new Date();
      const storedLastPromptTime = localStorage.getItem("lastPromptTime");
      const lastPromptTime = storedLastPromptTime
        ? new Date(storedLastPromptTime)
        : null;

      const isLastPromptTimeWithin1Hour =
        lastPromptTime &&
        now.getTime() - lastPromptTime.getTime() < 1 * 60 * 60 * 1000;

      if (!isLastPromptTimeWithin1Hour) {
        localStorage.setItem("lastPromptTime", now.toISOString());
      }
      return isLastPromptTimeWithin1Hour;
    }

    function handleDownloadPwa(deferredPrompt: Event) {
      if (!deferredPrompt) return;
      // @ts-ignore
      deferredPrompt.prompt();
    }

    const isIos =
      // @ts-ignore
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const sessionIsPwa = window.matchMedia(
      "(display-mode: standalone)"
    ).matches;

    if (isIos && !sessionIsPwa && !isLastPromptTimeWithin1Hour()) {
      setShowModal(true);
    }

    const beforeInstallPrompt = (e: Event) => {
      e.preventDefault();

      // Check if session is PWA or last prompt time was less than or equal to 1 hours ago
      if (sessionIsPwa || isLastPromptTimeWithin1Hour()) return;
      toast(`🎉 ${t("title")}`, {
        description: t("description"),
        action: {
          label: (
            <>
              <DownloadIcon className="mr-2 animate-bounce" />{" "}
              {t("actionButton")}
            </>
          ),
          onClick: () => {
            handleDownloadPwa(e);
          },
        },
        classNames: { actionButton: "!p-2 !h-auto" },
        duration: 8000,
      });
    };

    window.addEventListener("beforeinstallprompt", beforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstallPrompt);
    };
  }, [t]);

  return (
    <Dialog open={showModal} onOpenChange={setShowModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            🎉 <span className="mx-2 ">{t("title")}</span> 🎉
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col divide-y [&>*]:py-4">
          <div className="flex items-start gap-4 animate-in fade-in-0 slide-in-from-left-4 duration-300 ">
            <div className="h-6 w-6">
              <Share2Icon className="!h-6 !w-6" />
            </div>
            <p className="text-sm">{t("steps.first")}</p>
          </div>
          <div className="flex items-start gap-4 animate-in fade-in-0 slide-in-from-left-4 duration-300">
            <div className="h-6 w-6">
              <PlusSquareIcon className="!h-6 !w-6" />
            </div>
            <p className="text-sm">{t("steps.second")}</p>
          </div>
          <div className="flex items-start gap-4 animate-in fade-in-0 slide-in-from-left-4 duration-300">
            <div className="h-6 w-6">
              <CheckboxIcon className="!h-6 !w-6" />
            </div>
            <p className="text-sm">{t("steps.third")}</p>
          </div>
          <div className="flex items-start gap-4 animate-in fade-in-0 slide-in-from-left-4 duration-300">
            <div className="h-6 w-6">
              <HomeIcon className="!h-6 !w-6" />
            </div>
            <p className="text-sm">{t("steps.fourth")}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlusSquareIcon(props: SVGAttributes<SVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
}
