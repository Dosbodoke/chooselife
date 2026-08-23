import { createSupabaseClient } from "@/utils/supabase/server";

import InitialPaymentClaimsQueue from "./_components/initial-payment-claims-queue";

export default async function InitialPaymentClaimsPage() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-3xl items-center px-4 py-12 md:px-6">
        <div className="w-full rounded-3xl border bg-card p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Association administration
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Sign in to open the review queue
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Only an authorized association admin can inspect or decide an
            initial payment claim.
          </p>
        </div>
      </section>
    );
  }

  const { data, error } = await supabase.rpc("get_initial_payment_claim_queue");

  if (error) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-3xl items-center px-4 py-12 md:px-6">
        <div className="w-full rounded-3xl border border-destructive/40 bg-card p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-destructive">
            Review queue unavailable
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            We could not load this queue
          </h1>
          <p className="mt-3 text-muted-foreground">
            Refresh the page and try again. Your account and the association
            authorization are checked by the database for every request.
          </p>
        </div>
      </section>
    );
  }

  return <InitialPaymentClaimsQueue initialClaims={data ?? []} />;
}
