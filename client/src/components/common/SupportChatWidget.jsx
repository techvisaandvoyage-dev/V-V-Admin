import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  X,
  HelpCircle,
  ChevronRight,
  ArrowLeft,
  MoreVertical,
  Send,
  Smile,
  ExternalLink,
  MessageSquare,
  Loader2,
  Headphones,
  CircleEllipsis,
  CheckCheck,
  Zap,
  LogOut,
} from "lucide-react";
import { api, useAuthStore } from "../../store/authStore";
import { useDataStore } from "../../store/dataStore";
import { useLocation } from "react-router-dom";

const DEFAULT_CHAT_CONFIG = {
  enabled: true,
  mode: "external_link",
  link: "",
  title: "Continue with Chat",
  description: "Get instant support from our visa team",
  headerTitle: "Chat with us",
  headerSubtitle: "We typically reply in a few minutes",
  whatsappTemplate: "",
};

const WhatsAppIcon = ({ className = "h-5 w-5" }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const isWhatsAppSupportLink = (value) => {
  const link = String(value || "").trim().toLowerCase();
  if (!link) return false;
  if (
    link.includes("wa.me/") ||
    link.includes("whatsapp.com/") ||
    link.includes("api.whatsapp.com/")
  ) {
    return true;
  }
  const cleaned = link.replace(/[^0-9]/g, "");
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return true;
  }
  return false;
};

const getWhatsAppUrl = (value) => {
  const link = String(value || "").trim();
  if (!link) return "https://wa.me/918882838383";
  if (link.includes("wa.me/") || link.includes("whatsapp.com/") || link.includes("api.whatsapp.com/")) {
    if (!link.startsWith("http://") && !link.startsWith("https://")) {
      return `https://${link}`;
    }
    return link;
  }
  const cleaned = link.replace(/[^0-9]/g, "");
  if (cleaned.length >= 10) {
    return `https://wa.me/${cleaned}`;
  }
  return `https://wa.me/918882838383`;
};

const buildGreetingMessage = (currentUser) => ({
  id: "m_greet",
  sender: "support",
  text: `Hello ${currentUser?.name || "there"}! Welcome to Visa & Voyage Support. How can we help you today?`,
  time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
});

const withAutomationGreeting = (conversationMessages = [], currentUser) => {
  if (!currentUser) return conversationMessages;
  if (!Array.isArray(conversationMessages) || conversationMessages.length === 0) {
    return [buildGreetingMessage(currentUser)];
  }

  const hasSupportReply = conversationMessages.some((msg) => msg.sender !== "user");
  if (hasSupportReply) return conversationMessages;

  return [buildGreetingMessage(currentUser), ...conversationMessages];
};

const CHAT_EMOJIS = ["😀", "😊", "😍", "👍", "🙏", "🎉", "❤️", "😄", "🤝", "✨"];

export default function SupportChatWidget() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState("options");
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [adminIsTyping, setAdminIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [chatConfig, setChatConfig] = useState(DEFAULT_CHAT_CONFIG);
  const [chatLoading, setChatLoading] = useState(true);

  // Live Chat sync states
  const [guestUser, setGuestUser] = useState(() => {
    const cached = localStorage.getItem("guest_chat_user");
    return cached ? JSON.parse(cached) : null;
  });
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [activeConvo, setActiveConvo] = useState(null);

  const registeredUser = useAuthStore((state) => state.user);

  // Clear session cross-bleed when current user identity changes (login, logout, or account switches)
  useEffect(() => {
    localStorage.removeItem("guest_chat_user");
    setGuestUser(null);
    setGuestName("");
    setGuestEmail("");
    setGuestPhone("");
    setActiveConvo(null);
    setMessages([]);
    setView("options");
  }, [registeredUser?.email]);

  // Sync client chat feed from backend every 1 second so typing indicators feel live
  useEffect(() => {
    if (!isOpen || view !== "chat") return;

    const syncChat = async () => {
      const currentUser = useAuthStore.getState().user || guestUser;
      if (!currentUser?.email) return;

      try {
        const { data } = await api.get(`/support/conversations/client/chat?email=${encodeURIComponent(currentUser.email)}`);
        if (data?.success) {
          if (data.conversation) {
            setActiveConvo(data.conversation);
            setMessages(withAutomationGreeting(data.conversation.messages, currentUser));
            setAdminIsTyping(Boolean(data.conversation.adminTyping));
          } else {
            setActiveConvo(null);
            setMessages(withAutomationGreeting([], currentUser));
            setAdminIsTyping(false);
          }
        }
      } catch (err) {
        console.error("Failed to sync customer chat:", err);
      }
    };

    syncChat();
    const interval = setInterval(syncChat, 1000);
    return () => clearInterval(interval);
  }, [isOpen, view, guestUser]);

  const getDynamicValues = async (currentLocation) => {
    const values = {
      userName: "Not selected",
      country: "Not selected",
      visaType: "Not selected",
      travelDate: "Not selected",
      applicationId: "Not selected",
    };

    try {
      // 1. Logged in user fallback
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.name) {
        values.userName = currentUser.name;
      }

      // 2. Resolve country from path if present
      const path = currentLocation?.pathname || "";
      const countryMatch = path.match(/\/destination\/([a-zA-Z0-9-_]+)/) || path.match(/\/apply\/([a-zA-Z0-9-_]+)/);
      const countryId = countryMatch ? countryMatch[1] : null;
      if (countryId) {
        const countries = useDataStore.getState().countries || [];
        const activeCountry = countries.find(c => c.id === countryId || c.slug === countryId);
        values.country = activeCountry ? activeCountry.name : (countryId.charAt(0).toUpperCase() + countryId.slice(1).replace(/-/g, " "));
      }

      // 3. Resolve application ID from path
      const appMatch = path.match(/\/dashboard\/application\/([a-fA-F0-9]{24})/);
      const urlAppId = appMatch ? appMatch[1] : null;

      if (urlAppId) {
        const { data } = await api.get(`/users/applications/${urlAppId}`);
        if (data?.success && data?.application) {
          const app = data.application;
          values.applicationId = app.applicationId || app._id || "Not selected";
          values.country = app.countryName || values.country;
          values.visaType = app.visaType || values.visaType;
          if (app.travelDate) {
            values.travelDate = new Date(app.travelDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric"
            });
          }
          if (app.travelerNames && app.travelerNames[0]) {
            values.userName = app.travelerNames[0];
          }
        }
      } else if (countryId) {
        // 4. Try reading from draft local storage
        const draftKey = `travelDraft_${countryId}`;
        const rawDraft = localStorage.getItem(draftKey);
        if (rawDraft) {
          const draft = JSON.parse(rawDraft);
          if (draft.travelers && draft.travelers[0]?.name) {
            values.userName = draft.travelers[0].name;
          }
          if (draft.visaOption) {
            values.visaType = draft.visaOption;
          }
          if (draft.travelDateFrom) {
            values.travelDate = new Date(draft.travelDateFrom).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric"
            });
          }
        }
      }
    } catch (err) {
      console.error("Error resolving dynamic variables in chat widget:", err);
    }

    return values;
  };

  const generateWhatsAppMessage = (template, values) => {
    let msg = template || "";
    msg = msg.replace(/\{\{userName\}\}/g, values.userName || "Not selected");
    msg = msg.replace(/\{\{country\}\}/g, values.country || "Not selected");
    msg = msg.replace(/\{\{visaType\}\}/g, values.visaType || "Not selected");
    msg = msg.replace(/\{\{travelDate\}\}/g, values.travelDate || "Not selected");
    msg = msg.replace(/\{\{applicationId\}\}/g, values.applicationId || "Not selected");
    return msg;
  };

  const messagesEndRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const loadChatConfig = async () => {
      try {
        const { data } = await api.get("/config/customer-chat");
        if (cancelled) return;
        if (data?.success && data?.config) {
          setChatConfig({
            ...DEFAULT_CHAT_CONFIG,
            ...data.config,
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load customer chat config:", error);
          setChatConfig(DEFAULT_CHAT_CONFIG);
        }
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    };

    loadChatConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    const handleOpenSupportChat = () => {
      setIsOpen(true);
      handleStartChat();
    };

    window.addEventListener("open-support-chat", handleOpenSupportChat);
    return () => window.removeEventListener("open-support-chat", handleOpenSupportChat);
  }, [guestUser]);

  const canOpenExternalChat =
    chatConfig.enabled &&
    String(chatConfig.link || "").trim().length > 0;
  const hasConfiguredLink = String(chatConfig.link || "").trim().length > 0;
  const showComingSoonState = chatConfig.mode === "live_chat" && !hasConfiguredLink;
  const isWhatsAppLink = isWhatsAppSupportLink(chatConfig.link);
  const ctaTitle = isWhatsAppLink
    ? "Continue with WhatsApp"
    : (chatConfig.title || DEFAULT_CHAT_CONFIG.title);
  const ctaDescription = isWhatsAppLink
    ? "Get instant support from our visa team"
    : (chatConfig.description || DEFAULT_CHAT_CONFIG.description);
  const supportLabel = isWhatsAppLink ? "WhatsApp support" : "Customer support";

  const openExternalChat = async () => {
    const isWa = chatConfig.link ? isWhatsAppSupportLink(chatConfig.link) : true;
    if (isWa) {
      const baseWaUrl = chatConfig.link && isWhatsAppSupportLink(chatConfig.link)
        ? getWhatsAppUrl(chatConfig.link)
        : "https://wa.me/918882838383";
      const values = await getDynamicValues(location);
      const message = generateWhatsAppMessage(chatConfig.whatsappTemplate, values);
      const cleanBase = baseWaUrl.split('?')[0];
      const targetLink = message 
        ? `${cleanBase}?text=${encodeURIComponent(message)}`
        : cleanBase;
      window.open(targetLink, "_blank", "noopener,noreferrer");
    } else {
      if (canOpenExternalChat) {
        window.open(chatConfig.link, "_blank", "noopener,noreferrer");
      }
    }
  };

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setView("options");
    }
  };

  const handleStartChat = async () => {
    const currentUser = useAuthStore.getState().user || guestUser;
    
    if (!currentUser) {
      setView("guest_onboarding");
      return;
    }

    // Wipe stale states immediately to eliminate transition glitches and race conditions!
    setActiveConvo(null);
    setMessages([]);
    setAdminIsTyping(false);

    setView("chat");
    setIsTyping(true);

    try {
      const { data } = await api.get(`/support/conversations/client/chat?email=${encodeURIComponent(currentUser.email)}`);
      if (data?.success && data?.conversation) {
        setActiveConvo(data.conversation);
        setMessages(withAutomationGreeting(data.conversation.messages, currentUser));
        setAdminIsTyping(Boolean(data.conversation.adminTyping));
      } else {
        setMessages(withAutomationGreeting([], currentUser));
        setAdminIsTyping(false);
      }
    } catch (err) {
      console.error("Error loading client chat:", err);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const currentUser = useAuthStore.getState().user || guestUser;
    if (!currentUser?.email) return;

    const textToSend = inputText;
    setInputText("");
    setShowEmojiPicker(false);

    // Optimistically update
    const userMsg = {
      id: "opt_" + Date.now(),
      sender: "user",
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const conversationId = activeConvo?.id || "new";
      const { data } = await api.post(`/support/conversations/${conversationId}/messages`, {
        sender: "user",
        text: textToSend,
        name: currentUser.name,
        email: currentUser.email,
        phone: currentUser.phone || "Guest User"
      });
      if (data?.success && data?.conversation) {
        setActiveConvo(data.conversation);
        setMessages(withAutomationGreeting(data.conversation.messages, currentUser));
        setAdminIsTyping(Boolean(data.conversation.adminTyping));
      }
    } catch (err) {
      console.error("Failed to send customer message:", err);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setInputText((prev) => `${prev}${emoji}`);
    setShowEmojiPicker(false);
  };

  if (chatLoading) {
    return (
      <div className="fixed bottom-6 right-6 z-[9999]">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan text-background shadow-[0_20px_50px_rgba(2,82,213,0.28)]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </div>
    );
  }

  const handleGuestSubmit = (e) => {
    e.preventDefault();
    if (!guestName.trim() || !guestEmail.trim()) return;

    const newGuest = { 
      name: guestName, 
      email: guestEmail, 
      phone: guestPhone.trim() || "Not provided" 
    };
    localStorage.setItem("guest_chat_user", JSON.stringify(newGuest));
    setGuestUser(newGuest);
    setView("chat");
    
    // Trigger start chat immediately for the newly registered guest
    setTimeout(() => {
      handleStartChat();
    }, 50);
  };

  if (!chatConfig.enabled) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans select-none antialiased">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes chatFadeIn {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes chatFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        .animate-fade-in {
          animation: chatFadeIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-chat-float {
          animation: chatFloat 2.8s ease-in-out infinite;
        }
      ` }} />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 45 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 45 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="fixed bottom-28 right-6 w-[calc(100vw-32px)] max-w-[360px] sm:max-w-[410px] overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_30px_80px_rgba(2,82,213,0.18)] backdrop-blur-xl"
          >
            {view === "options" && (
              <div>
                <div className="relative overflow-hidden bg-[linear-gradient(135deg,#005BEA_0%,#0B63E6_45%,#0C79FF_100%)] px-6 py-6 text-white flex items-center justify-between">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_35%)] pointer-events-none" />
                  <div className="flex items-center gap-3 relative z-10">
                    <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#0252D5] shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
                      <Headphones className="h-6 w-6" />
                      <span className="absolute -right-1 bottom-0 h-3.5 w-3.5 rounded-full border-2 border-[#0A66F0] bg-emerald-400" />
                    </span>
                    <div>
                      <h3 className="text-base font-bold tracking-wide">
                        {chatConfig.headerTitle || DEFAULT_CHAT_CONFIG.headerTitle}
                      </h3>
                      <p className="mt-1 text-sm text-white/90 flex items-center gap-2 font-medium">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                        </span>
                        {chatConfig.headerSubtitle || DEFAULT_CHAT_CONFIG.headerSubtitle}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={toggleOpen}
                    className="relative z-10 rounded-full p-1.5 text-white/85 hover:bg-white/15 transition-all cursor-pointer"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4 max-h-[440px] overflow-y-auto bg-[linear-gradient(180deg,#FFFFFF_0%,#F6FAFF_100%)] p-5">
                  <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
                    <p className="text-[15px] font-semibold text-text-primary">Hi there! 👋</p>
                    <p className="mt-2 text-[15px] text-slate-700 leading-relaxed">
                      Need help with your visa application? We&apos;re here to assist you.
                    </p>
                  </div>

                  {/* Continue with Chat (Live Interactive Chat) card */}
                  <div className="rounded-[1.6rem] border border-cyan/20 bg-[linear-gradient(180deg,#F5FAFF_0%,#EBF5FF_100%)] p-4 text-left shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                    <div className="flex items-center gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan text-white shadow-[0_10px_24px_rgba(6,182,212,0.24)]">
                        <MessageSquare className="h-6 w-6" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[15px] font-bold leading-tight text-slate-900 flex items-center gap-1.5">
                          Continue with Chat
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan"></span>
                          </span>
                        </h4>
                        <p className="mt-1 text-sm text-slate-600 leading-snug">
                          Chat live with our customer support team
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-cyan" />
                    </div>
                    <button
                      type="button"
                      onClick={handleStartChat}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan px-4 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(6,182,212,0.24)] hover:bg-cyan/90 transition-all hover:scale-[1.01]"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Continue with Chat
                    </button>
                  </div>

                  {/* Continue with WhatsApp (Shown below chat) */}
                  {chatConfig.enabled && (
                    <div className="rounded-[1.6rem] border border-[#86E7AE] bg-[linear-gradient(180deg,#F8FFF9_0%,#F0FFF4_100%)] p-4 text-left shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                      <div className="flex items-center gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_24px_rgba(37,211,102,0.24)]">
                          <WhatsAppIcon className="h-7 w-7" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[15px] font-bold leading-tight text-slate-900 flex items-center gap-1.5">
                            Continue with WhatsApp
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#25D366] opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#25D366]"></span>
                            </span>
                          </h4>
                          <p className="mt-1 text-sm text-slate-600 leading-snug">
                            Get instant support from our visa team
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-[#1D9E54]" />
                      </div>
                      <button
                        type="button"
                        onClick={openExternalChat}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(37,211,102,0.24)] hover:bg-[#20ba59] transition-all hover:scale-[1.01]"
                      >
                        <WhatsAppIcon className="h-4 w-4" />
                        Continue with WhatsApp
                      </button>
                    </div>
                  )}


                </div>

                <div className="border-t border-slate-100 bg-white py-4 text-center text-xs text-slate-500 font-medium">
                  Powered by <span className="text-[#0252D5] font-semibold">Visa & Voyage</span> Support
                </div>
              </div>
            )}

            {view === "guest_onboarding" && (
              <div>
                <div className="relative overflow-hidden bg-[linear-gradient(135deg,#005BEA_0%,#0B63E6_45%,#0C79FF_100%)] px-6 py-6 text-white flex items-center justify-between">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_35%)] pointer-events-none" />
                  <div className="flex items-center gap-3 relative z-10">
                    <button
                      type="button"
                      onClick={() => setView("options")}
                      className="rounded-lg p-1.5 hover:bg-white/10 transition-colors cursor-pointer"
                      title="Back to options"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                      <h3 className="text-base font-bold tracking-wide">Live Support Chat</h3>
                      <p className="text-xs text-white/80">Introduce yourself to start chatting</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleGuestSubmit} className="p-6 space-y-4 bg-[linear-gradient(180deg,#FFFFFF_0%,#F6FAFF_100%)]">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Your Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={guestName}
                      onChange={e => setGuestName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/15"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. john@example.com"
                      value={guestEmail}
                      onChange={e => setGuestEmail(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/15"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +91 98765 43210"
                      value={guestPhone}
                      onChange={e => setGuestPhone(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/15"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan px-4 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(6,182,212,0.24)] hover:bg-cyan/90 transition-all hover:scale-[1.01]"
                  >
                    Start Live Chat
                  </button>
                </form>
              </div>
            )}

            {view === "chat" && (
              <div>
                <div className="relative overflow-hidden bg-[linear-gradient(135deg,#005BEA_0%,#0B63E6_45%,#0C79FF_100%)] px-5 py-4 text-white flex items-center justify-between">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_35%)] pointer-events-none" />
                  <div className="flex items-center gap-3 min-w-0 relative z-10">
                    <button
                      type="button"
                      onClick={() => setView("options")}
                      className="rounded-lg p-1.5 hover:bg-white/10 transition-colors cursor-pointer"
                      title="Back to options"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="relative">
                      <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center border border-white/20 text-[#0252D5] shadow-[0_10px_22px_rgba(0,0,0,0.16)]">
                        <Headphones className="h-6 w-6" />
                      </div>
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[#0252D5]" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-lg font-bold tracking-wide truncate">
                        {chatConfig.headerTitle || DEFAULT_CHAT_CONFIG.headerTitle}
                      </h4>
                      <p className="text-sm text-white/90 font-medium flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                        Online
                      </p>
                    </div>
                  </div>
                  {guestUser && (
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.removeItem("guest_chat_user");
                        setGuestUser(null);
                        setActiveConvo(null);
                        setMessages([]);
                        setAdminIsTyping(false);
                        setView("options");
                      }}
                      className="relative z-10 rounded-lg p-1.5 hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                      title="End guest session and start fresh"
                    >
                      <LogOut className="h-4.5 w-4.5" />
                    </button>
                  )}
                </div>

                <div className="h-[430px] overflow-y-auto bg-[linear-gradient(180deg,#FFFEFC_0%,#F9FBFF_100%)] p-4 space-y-3.5">
                  <div className="flex justify-center">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                      Today
                    </span>
                  </div>

                  {messages.map((msg) => {
                    if (msg.type === "customer_chat_card") {
                      return (
                        <div key={msg.id} className="flex justify-start w-full animate-fade-in">
                          <div className={`w-[88%] rounded-[1.35rem] border p-4 shadow-[0_16px_32px_rgba(15,23,42,0.08)] flex flex-col gap-2.5 ${
                            isWhatsAppLink
                              ? "border-[#86E7AE] bg-[linear-gradient(180deg,#F7FFF9_0%,#F1FFF5_100%)]"
                              : "border-cyan/20 bg-cyan/5"
                          }`}>
                            <div className="flex items-center gap-3">
                              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${
                                isWhatsAppLink ? "bg-[#25D366]" : "bg-cyan"
                              }`}>
                                {isWhatsAppLink ? <WhatsAppIcon className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <h5 className="text-lg font-semibold text-slate-900">
                                  {ctaTitle}
                                </h5>
                                <p className="text-sm text-slate-600 truncate">
                                  {showComingSoonState
                                    ? "Live chat will be available soon."
                                    : ctaDescription}
                                </p>
                              </div>
                              {isWhatsAppLink && (
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E9FFF1] text-[#1D9E54]">
                                  <ExternalLink className="h-5 w-5" />
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col gap-3 border-t border-cyan/15 pt-3 text-[10px]">
                              <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                isWhatsAppLink
                                  ? "bg-[#25D366]/12 text-[#128C49]"
                                  : "bg-cyan/10 text-cyan"
                              }`}>
                                {supportLabel}
                              </span>
                              {/* If no external link is configured, fallback to Coming Soon */}
                              {!canOpenExternalChat && (
                                <button
                                  type="button"
                                  disabled
                                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-[11px] font-bold text-slate-400 cursor-not-allowed"
                                >
                                  Coming soon
                                </button>
                              )}

                              {/* Clickable WhatsApp button */}
                              {isWhatsAppLink && canOpenExternalChat && (
                                <button
                                  type="button"
                                  onClick={openExternalChat}
                                  className="inline-flex w-full items-center justify-between gap-3 rounded-[1.15rem] border border-[#86E7AE] bg-white px-4 py-3 text-left text-[11px] font-bold shadow-[0_10px_24px_rgba(37,211,102,0.12)] transition-transform hover:scale-[1.01]"
                                >
                                  <span className="flex items-center gap-3">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white">
                                      <WhatsAppIcon className="h-4 w-4" />
                                    </span>
                                    <span className="flex flex-col">
                                      <span className="text-[13px] font-bold text-slate-900">Continue with WhatsApp</span>
                                      <span className="text-xs font-medium text-slate-600">Get instant support from our visa team.</span>
                                    </span>
                                  </span>
                                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E9FFF1] text-[#1D9E54]">
                                    <ExternalLink className="h-4 w-4" />
                                  </span>
                                </button>
                              )}

                              {/* Clickable general support link button */}
                              {!isWhatsAppLink && canOpenExternalChat && (
                                <button
                                  type="button"
                                  onClick={openExternalChat}
                                  className="inline-flex w-full items-center justify-between gap-3 rounded-[1.15rem] border border-cyan/20 bg-white px-4 py-3 text-left text-[11px] font-bold shadow-[0_10px_24px_rgba(37,99,235,0.08)] transition-transform hover:scale-[1.01]"
                                >
                                  <span className="flex items-center gap-3">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan text-white">
                                      <MessageSquare className="h-4 w-4" />
                                    </span>
                                    <span className="flex flex-col">
                                      <span className="text-[13px] font-bold text-slate-900">{ctaTitle}</span>
                                      <span className="text-xs font-medium text-slate-600">{ctaDescription}</span>
                                    </span>
                                  </span>
                                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan/10 text-cyan">
                                    <ExternalLink className="h-4 w-4" />
                                  </span>
                                </button>
                              )}
                              {isWhatsAppLink && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                  <Zap className="h-3.5 w-3.5 text-emerald-500" />
                                  Typically replies in 2 minutes
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const isUser = msg.sender === "user";

                    return (
                      <div
                        key={msg.id}
                        className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm ${
                            isUser
                              ? "bg-[#E8F0FF] text-slate-900 rounded-[1.5rem] rounded-tr-md border border-[#D7E5FF]"
                              : "bg-white border border-slate-100 text-text-primary rounded-[1.5rem] rounded-tl-md shadow-[0_10px_28px_rgba(15,23,42,0.06)]"
                          }`}
                        >
                          <p>{msg.text}</p>
                          <div
                            className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${
                              isUser ? "text-slate-500" : "text-text-muted"
                            }`}
                          >
                            <span>{msg.time}</span>
                            {isUser && <CheckCheck className="h-3.5 w-3.5 text-[#1463F3]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {(isTyping || adminIsTyping) && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-tl-md border border-slate-100 bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#1463F3] animate-bounce [animation-delay:-0.3s]" />
                          <span className="h-2.5 w-2.5 rounded-full bg-[#1463F3]/60 animate-bounce [animation-delay:-0.15s]" />
                          <span className="h-2.5 w-2.5 rounded-full bg-[#1463F3]/40 animate-bounce" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                <form
                  onSubmit={handleSendMessage}
                  className="border-t border-slate-100 bg-white p-4 flex flex-col gap-2"
                >
                  <div className="rounded-[1.35rem] border border-slate-200 bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Write your message..."
                      className="w-full border-none bg-transparent px-0 py-0 text-[15px] text-text-primary outline-none placeholder:text-slate-400"
                    />
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="relative flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker((prev) => !prev)}
                          aria-label="Open emoji picker"
                          className="rounded-full p-2.5 text-slate-400 hover:bg-slate-50 hover:text-cyan transition-colors"
                        >
                          <Smile className="h-4 w-4" />
                        </button>
                        {showEmojiPicker && (
                          <div className="absolute bottom-14 left-0 z-20 flex w-max max-w-[320px] gap-2 overflow-x-auto whitespace-nowrap rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
                            {CHAT_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleEmojiSelect(emoji)}
                                className="flex h-9 w-9 items-center justify-center rounded-full text-lg transition-colors hover:bg-slate-100"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="submit"
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F0FF] text-[#1463F3] shadow-[0_10px_24px_rgba(20,99,243,0.18)] transition-transform hover:scale-[1.03]"
                      >
                        <Send className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={toggleOpen}
        whileTap={{ scale: 0.96 }}
        className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#005BEA_0%,#0C79FF_100%)] text-white shadow-[0_18px_45px_rgba(2,82,213,0.32)] transition-all hover:translate-y-[-1px] animate-chat-float"
        aria-label="Open customer chat"
      >
        <span className="absolute right-1 top-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-400" />
        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-7 w-7" />}
      </motion.button>
    </div>
  );
}
