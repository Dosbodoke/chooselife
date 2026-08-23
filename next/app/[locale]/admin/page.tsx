import { getTranslations } from "next-intl/server";

import { createSupabaseClient } from "@/utils/supabase/server";

import BillingWorkspace from "./_components/billing-workspace";

export const dynamic = "force-dynamic";

export default async function BillingWorkspacePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-3xl items-center px-4 py-12 md:px-6">
        <div className="w-full rounded-3xl border bg-card p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t("common.associationAdministration")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {t("page.signInTitle")}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {t("page.signInDescription")}
          </p>
        </div>
      </section>
    );
  }

  const { data: organizations, error } = await supabase.rpc(
    "get_billing_workspace_organizations",
  );

  if (error) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-3xl items-center px-4 py-12 md:px-6">
        <div className="w-full rounded-3xl border border-destructive/40 bg-card p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-destructive">
            {t("page.workspaceUnavailableLabel")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {t("page.loadAssociationsTitle")}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {t("page.loadAssociationsDescription")}
          </p>
        </div>
      </section>
    );
  }

  return <BillingWorkspace organizations={organizations ?? []} />;
}
