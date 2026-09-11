import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useUnreadCount } from "@/hooks/use-notifications";

/** Bell with live unread badge, links to the notification centre. */
export function NotificationBell({ className = "" }: { className?: string }) {
  const unread = useUnreadCount();
  return (
    <Link
      to="/notifications"
      aria-label="Notifications"
      className={`relative grid h-9 w-9 place-items-center rounded-full bg-white/15 text-current ${className}`}
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] animate-pulse place-items-center rounded-full bg-warning px-1 text-[10px] font-bold text-black">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
