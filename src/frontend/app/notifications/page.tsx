"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RoleNavigation } from "../components/role-navigation";
import { apiGet, apiPatch } from "../lib/api";

type Notification = {
  data?: {
    propertyId?: number | string;
  } | null;
  id: number;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = { data: Notification[]; meta: { unreadCount: number } };

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    const token = localStorage.getItem("selapAccessToken");
    if (!token) {
      setError("Please sign in to see your notifications.");
      setIsLoading(false);
      return;
    }
    apiGet<NotificationsResponse>("/notifications", { token })
      .then((response) => setNotifications(response.data))
      .catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : "Unable to load notifications."))
      .finally(() => setIsLoading(false));
  }, []);

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const displayedNotifications = useMemo(
    () => activeFilter === "unread" ? notifications.filter((notification) => !notification.readAt) : notifications,
    [activeFilter, notifications]
  );

  async function markAsRead(id: number) {
    const token = localStorage.getItem("selapAccessToken");
    if (!token) return;
    try {
      await apiPatch(`/notifications/${id}/read`, { token });
      setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, readAt: new Date().toISOString() } : notification));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update notification.");
    }
  }

  async function openNotification(notification: Notification) {
    const propertyId = getNotificationPropertyId(notification);

    if (!propertyId) {
      if (!notification.readAt) {
        await markAsRead(notification.id);
      }
      return;
    }

    if (!notification.readAt) {
      await markAsRead(notification.id);
    }

    router.push(`/properties/${propertyId}`);
  }

  async function markAllAsRead() {
    const token = localStorage.getItem("selapAccessToken");
    if (!token || unreadCount === 0) return;
    setIsMarkingAll(true);
    try {
      await apiPatch("/notifications/read-all", { token });
      const now = new Date().toISOString();
      setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt ?? now })));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to mark notifications as read.");
    } finally {
      setIsMarkingAll(false);
    }
  }

  return (
    <main className="catalogMockPage notificationPage">
      <div className="catalogMockShell notificationShell">
        <RoleNavigation />
        <header className="notificationHeader">
          <div>
            <p className="pageEyebrow">ACTIVITY</p>
            <h1>Notifications</h1>
            <p>Stay up to date with the properties and requests that matter to you.</p>
          </div>
          <button className="markAllButton" disabled={unreadCount === 0 || isMarkingAll} onClick={markAllAsRead} type="button">
            {isMarkingAll ? "Updating…" : "Mark all as read"}
          </button>
        </header>

        <div className="notificationToolbar">
          <div className="notificationTabs" role="tablist" aria-label="Notification filters">
            <button aria-selected={activeFilter === "all"} className={activeFilter === "all" ? "notificationTab active" : "notificationTab"} onClick={() => setActiveFilter("all")} role="tab" type="button">All</button>
            <button aria-selected={activeFilter === "unread"} className={activeFilter === "unread" ? "notificationTab active" : "notificationTab"} onClick={() => setActiveFilter("unread")} role="tab" type="button">Unread <span>{unreadCount}</span></button>
          </div>
          <span className="notificationCount">{notifications.length} total</span>
        </div>

        {error ? <p className="savedError">{error}</p> : null}
        <section className="notificationList" aria-live="polite">
          {isLoading ? Array.from({ length: 4 }).map((_, index) => <div className="notificationItem notificationSkeleton" key={index} />) : null}
          {!isLoading && !error && displayedNotifications.length === 0 ? <EmptyNotifications filter={activeFilter} /> : null}
          {!isLoading ? displayedNotifications.map((notification) => {
            const propertyId = getNotificationPropertyId(notification);

            return (
            <article
              className={[
                notification.readAt ? "notificationItem" : "notificationItem unread",
                propertyId ? "clickableNotification" : ""
              ].filter(Boolean).join(" ")}
              key={notification.id}
              onClick={() => openNotification(notification)}
              role={propertyId ? "button" : undefined}
              tabIndex={propertyId ? 0 : undefined}
              onKeyDown={(event) => {
                if (propertyId && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  void openNotification(notification);
                }
              }}
            >
              <span className={`notificationIcon icon-${notification.type}`}>{iconFor(notification.type)}</span>
              <div className="notificationContent">
                <div className="notificationTitleRow">
                  <h2>{notification.title}</h2>
                  {!notification.readAt ? <span className="unreadDot" aria-label="Unread" /> : null}
                </div>
                <p>{notification.message}</p>
                <time dateTime={notification.createdAt}>{relativeTime(notification.createdAt)}</time>
              </div>
              {!notification.readAt ? <button className="readButton" onClick={(event) => { event.stopPropagation(); void markAsRead(notification.id); }} type="button">Mark read</button> : null}
            </article>
          );
          }) : null}
        </section>
      </div>
    </main>
  );
}

function EmptyNotifications({ filter }: { filter: "all" | "unread" }) {
  return <div className="notificationEmpty"><span>✓</span><h2>{filter === "unread" ? "You're all caught up" : "No notifications yet"}</h2><p>{filter === "unread" ? "There are no unread updates right now." : "Updates about your saved properties will appear here."}</p></div>;
}

function iconFor(type: string) {
  if (type === "PROPERTY_STATUS_CHANGED") return "⌂";
  if (type === "PROPERTY_FAVORITE_CHANGED") return "♥";
  if (type === "LEAD_ACCEPTED" || type.includes("LEAD")) return "🗩";
  if (type.includes("ACCOUNT")) return "✓";
  return "•";
}

function getNotificationPropertyId(notification: Notification) {
  const propertyId = notification.data?.propertyId;
  const parsed = Number(propertyId);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}
