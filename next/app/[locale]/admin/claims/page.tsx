import { redirect } from "next/navigation";

export default function InitialPaymentClaimsPage() {
  redirect("/admin?view=queue");
}
