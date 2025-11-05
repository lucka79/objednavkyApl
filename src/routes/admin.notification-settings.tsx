import { createFileRoute } from "@tanstack/react-router";
import { NotificationSettings } from "@/components/NotificationSettings";

export const Route = createFileRoute("/admin/notification-settings")({
  component: NotificationSettingsPage,
});

function NotificationSettingsPage() {
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <NotificationSettings />
    </div>
  );
}
