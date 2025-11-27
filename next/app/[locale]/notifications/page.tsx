import { getRecentNotifications } from "@/app/actions/notifications";

import NotificationsForm from "./_components/notification-form";

export default async function NotificationsPage() {
  const recentNotifications = await getRecentNotifications();

  return <NotificationsForm initialNotifications={recentNotifications} />;
}
