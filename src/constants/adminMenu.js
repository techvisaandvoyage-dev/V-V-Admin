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
  { id: "activity", label: "Activity Center", icon: BarChart2 },
  { id: "countries", label: "Country Manager", icon: MapPin },
  { id: "landing-page", label: "Header", icon: Globe },
  { id: "cards", label: "Body", icon: CreditCard },
  { id: "footer", label: "Footer", icon: Globe },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "seo", label: "SEO Manager", icon: Search, hidden: true },
];
