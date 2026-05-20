import { useEffect, useRef, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, useAuthStore } from "../../store/authStore";
import {
  buildNotificationKey,
  formatNotificationTime,
  mapApplicationNotifications,
  mapBlogNotifications,
  mapSupportNotifications,
  mapTransactionNotifications,
  persistNotificationKeys,
  readNotificationKeys,
  resolveSyntheticRead,
} from "../../utils/notifications";

const NotificationBell = ({ className = "" }) => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const dropdownRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [markingNotificationsRead, setMarkingNotificationsRead] = useState(false);
  const [notificationReadKeys, setNotificationReadKeys] = useState(() => readNotificationKeys());

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const handlePointerDown = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isAuthenticated]);

  useEffect(() => {
    let alive = true;

    const loadNotifications = async () => {
      if (!user?.id) return;
      setNotificationsLoading(true);
      try {
        const [blogRes, appRes, txRes, supportRes] = await Promise.all([
          api.get("/blog/me/notifications?limit=6"),
          api.get("/users/applications"),
          api.get("/users/payments/my-transactions"),
          user?.email
            ? api.get(`/support/conversations/client/chat?email=${encodeURIComponent(user.email)}`)
            : Promise.resolve({ data: { success: true, conversation: null } }),
        ]);

        if (!alive) return;

        const merged = [
          ...mapBlogNotifications(blogRes.data?.data || []),
          ...mapApplicationNotifications(appRes.data?.applications || []),
          ...mapTransactionNotifications(txRes.data?.transactions || []),
          ...mapSupportNotifications(supportRes.data?.conversation || null),
        ]
          .map((item) => ({
            ...item,
            read: resolveSyntheticRead(item, notificationReadKeys),
          }))
          .sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          })
          .slice(0, 12);

        setNotifications(merged);
      } catch (error) {
        if (alive) {
          console.error("Failed to load notifications:", error);
        }
      } finally {
        if (alive) setNotificationsLoading(false);
      }
    };

    loadNotifications();
    return () => {
      alive = false;
    };
  }, [user?.id, user?.email, notificationReadKeys]);

  if (!isAuthenticated) return null;

  const unreadNotifications = notifications.filter((item) => !item.read);

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.read && notification.source === "blog") {
        await api.patch("/blog/me/notifications/read", { ids: [notification.id] });
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    } finally {
      const nextKeys = new Set(notificationReadKeys);
      nextKeys.add(buildNotificationKey(notification));
      persistNotificationKeys(nextKeys);
      setNotificationReadKeys(nextKeys);
      setNotifications((prev) =>
        prev.map((item) =>
          buildNotificationKey(item) === buildNotificationKey(notification)
            ? { ...item, read: true }
            : item
        )
      );
      setNotificationsOpen(false);
      if (notification?.blogSlug) {
        navigate(`/blog/${notification.blogSlug}`);
      } else if (notification?.openSupportChat) {
        navigate("/dashboard/profile");
        window.dispatchEvent(new CustomEvent("open-support-chat"));
      } else if (notification?.route) {
        navigate(notification.route);
      }
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!unreadNotifications.length) return;
    setMarkingNotificationsRead(true);
    try {
      const blogUnread = unreadNotifications.filter((item) => item.source === "blog");
      if (blogUnread.length) {
        await api.patch("/blog/me/notifications/read", { all: true });
      }

      const nextKeys = new Set(notificationReadKeys);
      unreadNotifications.forEach((item) => nextKeys.add(buildNotificationKey(item)));
      persistNotificationKeys(nextKeys);
      setNotificationReadKeys(nextKeys);
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch (error) {
      console.error("Failed to update notifications:", error);
    } finally {
      setMarkingNotificationsRead(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setNotificationsOpen((prev) => !prev)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-cyan/15 border border-cyan/30 text-cyan hover:bg-cyan/20 hover:shadow-cyan-glow transition-all duration-200"
        aria-label="Open notifications"
      >
        <Bell size={18} />
        {unreadNotifications.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadNotifications.length}
          </span>
        )}
      </button>

      {notificationsOpen && (
        <div className="absolute right-0 top-[calc(100%+12px)] z-50 w-[360px] overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/95 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Notifications</h3>
              <p className="text-xs text-slate-500">
                {unreadNotifications.length
                  ? `${unreadNotifications.length} unread update${unreadNotifications.length === 1 ? "" : "s"}`
                  : "You are all caught up"}
              </p>
            </div>
            <button
              type="button"
              disabled={!unreadNotifications.length || markingNotificationsRead}
              onClick={handleMarkAllNotificationsRead}
              className="text-xs font-semibold text-[#235BFF] disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {notificationsLoading ? (
              <div className="flex items-center justify-center px-5 py-10 text-slate-500">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Bell size={18} />
                </div>
                <p className="text-sm font-semibold text-slate-800">No notifications yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Replies, application updates, payments, and support messages will show here.
                </p>
              </div>
            ) : (
              notifications.map((notification) => {
                const NotificationIcon = notification.icon || Bell;
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex w-full items-start gap-3 border-b border-slate-100 px-5 py-4 text-left transition-colors hover:bg-slate-50 ${
                      !notification.read ? "bg-[#235BFF]/[0.04]" : ""
                    }`}
                  >
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#EEF4FF_0%,#F5F9FF_100%)] text-[#235BFF]">
                      <NotificationIcon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">
                          {notification.title || "Notification"}
                        </span>
                        {!notification.read && <span className="h-2 w-2 rounded-full bg-[#235BFF]" />}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                        {notification.subtitle || "You have a new update."}
                      </span>
                      {notification.body && (
                        <span className="mt-2 block line-clamp-2 text-xs text-slate-500">
                          {notification.body}
                        </span>
                      )}
                      <span className="mt-2 block text-[11px] font-medium text-slate-400">
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
