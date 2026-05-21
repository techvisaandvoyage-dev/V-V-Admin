import { Bell, BadgeCheck, CalendarDays, MessageSquareText, Shield } from "lucide-react";
import { formatOrdinalDate } from "./dateUtils";

export const NOTIFICATION_READS_KEY = "visa_voyage_profile_notification_reads";

export const formatNotificationTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatOrdinalDate(date);
};

export const readNotificationKeys = () => {
  try {
    const raw = localStorage.getItem(NOTIFICATION_READS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
};

export const persistNotificationKeys = (keys) => {
  try {
    localStorage.setItem(NOTIFICATION_READS_KEY, JSON.stringify(Array.from(keys)));
  } catch {
    // Ignore storage write errors.
  }
};

export const buildNotificationKey = (item) =>
  [item.source, item.id, item.createdAt || "", item.title || ""].join("::");

export const resolveSyntheticRead = (item, readKeys) =>
  item.read === true || readKeys.has(buildNotificationKey(item));

const clipText = (value, max = 120) => {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
};

export const mapBlogNotifications = (rows = []) =>
  rows.map((row) => ({
    id: row._id,
    source: "blog",
    type: row.type,
    title: row.type === "comment_reply" ? "New reply on your comment" : "Blog notification",
    subtitle: row.blog?.title || "Someone replied to your discussion.",
    body: clipText(row.comment?.content || ""),
    createdAt: row.createdAt,
    read: Boolean(row.read),
    blogSlug: row.blog?.slug || "",
    icon: MessageSquareText,
  }));

export const mapApplicationNotifications = (applications = []) =>
  applications
    .flatMap((app) => {
      const rows = [];
      const label = app.countryName || app.visaType || "Visa application";

      if (app.status === "approved") {
        rows.push({
          id: `${app._id}:approved`,
          source: "application",
          type: "application_approved",
          title: "Application approved",
          subtitle: label,
          body: "Your visa application has been approved.",
          createdAt: app.updatedAt || app.createdAt,
          read: false,
          route: `/dashboard/application/${app._id}`,
          icon: BadgeCheck,
        });
      } else if (app.status === "rejected") {
        rows.push({
          id: `${app._id}:rejected`,
          source: "application",
          type: "application_rejected",
          title: "Application update",
          subtitle: label,
          body: "Your application was marked as rejected. Open it to review the latest status.",
          createdAt: app.updatedAt || app.createdAt,
          read: false,
          route: `/dashboard/application/${app._id}`,
          icon: Shield,
        });
      } else if (app.status === "cancelled") {
        rows.push({
          id: `${app._id}:cancelled`,
          source: "application",
          type: "application_cancelled",
          title: "Application cancelled",
          subtitle: label,
          body: "This application was cancelled. You can review the full details here.",
          createdAt: app.updatedAt || app.createdAt,
          read: false,
          route: `/dashboard/application/${app._id}`,
          icon: Shield,
        });
      }

      if (app.paymentStatus === "completed") {
        rows.push({
          id: `${app._id}:payment_completed`,
          source: "payment",
          type: "application_payment_completed",
          title: "Payment received",
          subtitle: label,
          body: "Your application payment has been completed successfully.",
          createdAt: app.updatedAt || app.createdAt,
          read: false,
          route: `/dashboard/application/${app._id}`,
          icon: CalendarDays,
        });
      } else if (app.paymentStatus === "failed") {
        rows.push({
          id: `${app._id}:payment_failed`,
          source: "payment",
          type: "application_payment_failed",
          title: "Payment failed",
          subtitle: label,
          body: "A recent payment attempt failed. Open the application to retry or review details.",
          createdAt: app.updatedAt || app.createdAt,
          read: false,
          route: `/dashboard/application/${app._id}`,
          icon: Bell,
        });
      } else if (app.paymentStatus === "cancelled") {
        rows.push({
          id: `${app._id}:payment_cancelled`,
          source: "payment",
          type: "application_payment_cancelled",
          title: "Payment cancelled",
          subtitle: label,
          body: "The checkout was cancelled before payment completed.",
          createdAt: app.updatedAt || app.createdAt,
          read: false,
          route: `/dashboard/application/${app._id}`,
          icon: Bell,
        });
      }

      return rows;
    })
    .slice(0, 8);

export const mapTransactionNotifications = (transactions = []) =>
  transactions.slice(0, 4).map((txn) => ({
    id: txn._id,
    source: "transaction",
    type: "transaction",
    title: "Transaction recorded",
    subtitle: txn.application?.countryName || txn.application?.visaType || "Payment update",
    body: txn.notes || `Amount: ${txn.amount ?? ""} ${txn.currency || "INR"}`.trim(),
    createdAt: txn.createdAt,
    read: false,
    route: txn.application?._id ? `/dashboard/application/${txn.application._id}` : "/dashboard",
    icon: CalendarDays,
  }));

export const mapSupportNotifications = (conversation) => {
  if (!conversation?.messages?.length) return [];
  const latestAdminMessage = [...conversation.messages]
    .reverse()
    .find((msg) => msg.sender === "admin");

  if (!latestAdminMessage) return [];

  return [
    {
      id: `${conversation.id}:${latestAdminMessage.id}`,
      source: "support",
      type: "support_reply",
      title: "Support replied",
      subtitle: conversation.name || "Customer support",
      body: clipText(latestAdminMessage.text || "You have a new support reply."),
      createdAt: conversation.updatedAt || null,
      read: false,
      route: "/dashboard/profile",
      openSupportChat: true,
      icon: MessageSquareText,
    },
  ];
};
