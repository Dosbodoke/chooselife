"use client"; // This is a client component

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("highline.notFound");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center gap-8">
      <div className="items-center gap-2">
        <div className="text-3xl">{t("title")}</div>
        <div className="text-muted-foreground text-lg">{t("description")}</div>
      </div>

      <Image
        src="/images/highline-retomada.png"
        alt="Highline Retomada (Leash Fall)"
        width={3259}
        height={2545}
        className=" max-w-3xl w-full h-auto"
        priority
      />

      <Link href="/" passHref>
        <Button size="lg" className="w-full sm:w-auto">
          <div>{t("buttonLabel")}</div>
        </Button>
      </Link>
    </div>
  );
}
