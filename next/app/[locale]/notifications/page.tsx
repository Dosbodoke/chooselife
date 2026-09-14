import { getRecentNotifications } from "@/app/actions/notifications";

import NotificationsForm from "./_components/notification-form";

// Uses cookies() while loading notifications — must not be statically rendered.
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const recentNotifications = await getRecentNotifications();

  return <NotificationsForm initialNotifications={recentNotifications} />;
}
