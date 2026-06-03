import {
  BarChart2,
  Globe,
  BookOpen,
  CreditCard,
  FileText,
  MapPin,
  Sliders,
  Settings,
  MessageSquare,
  Search,
} from "lucide-react";

export const ADMIN_DASHBOARD_TABS = [
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "pages", label: "Static Pages", icon: Globe },
  { id: "blogs", label: "Blog", icon: BookOpen },
  { id: "transactions", label: "Transactions", icon: CreditCard },
  { id: "applications", label: "Applications", icon: FileText },
  { id: "countries", label: "Country Manager", icon: MapPin },
  { id: "support-chat", label: "Support Chat", icon: MessageSquare },
  { id: "controls", label: "Controls", icon: Sliders },
  { id: "seo", label: "SEO Manager", icon: Search },
  { id: "settings", label: "Settings", icon: Settings },
];
