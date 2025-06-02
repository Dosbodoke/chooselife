import NotificationsForm from "./_components/notification-form";
import { getRecentNotifications } from "@/app/actions/notifications";

export default async function NotificationsPage() {
  const recentNotifications = await getRecentNotifications();

  return <NotificationsForm initialNotifications={recentNotifications} />;
}
