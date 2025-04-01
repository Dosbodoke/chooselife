import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Our commitment to protecting your privacy",
};

export default async function PrivacyPolicyPage() {
  const t = await getTranslations("privacyPolicy");

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p>{t("intro")}</p>

          <h2 className="mt-6 text-xl font-semibold">
            {t("collectionUse.title")}
          </h2>
          <p>{t("collectionUse.p1")}</p>
          <p>{t("collectionUse.p2")}</p>
          <p>{t("collectionUse.p3")}</p>

          <h2 className="mt-6 text-xl font-semibold">{t("cookies.title")}</h2>
          <p>{t("cookies.p1")}</p>
          <p>{t("cookies.p2")}</p>
          <p>{t("cookies.p3")}</p>

          <h2 className="mt-6 text-xl font-semibold">
            {t("externalLinks.title")}
          </h2>
          <p>{t("externalLinks.content")}</p>

          <h2 className="mt-6 text-xl font-semibold">
            {t("rightOfRefusal.title")}
          </h2>
          <p>{t("rightOfRefusal.p1")}</p>
          <p>{t("rightOfRefusal.p2")}</p>

          <h2 className="mt-6 text-xl font-semibold">
            {t("userCommitment.title")}
          </h2>
          <p>{t("userCommitment.intro")}</p>
          <ul className="list-disc pl-6">
            <li>{t("userCommitment.a")}</li>
            <li>{t("userCommitment.b")}</li>
            <li>{t("userCommitment.c")}</li>
          </ul>

          <h2 className="mt-6 text-xl font-semibold">{t("moreInfo.title")}</h2>
          <p>{t("moreInfo.content")}</p>

          <p className="mt-6 font-semibold">{t("effectiveDate")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
