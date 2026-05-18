import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, X } from "lucide-react";

const EXIT_INTENT_STORAGE_KEY = "exitIntentShown";
const EXIT_INTENT_PENDING_KEY = "exitIntentPendingContext";
const REVISIT_THRESHOLD_MS = 5 * 60 * 1000;
const REVISIT_BANNER_DELAY_MS = 1200;

const buildPendingContext = (pathname) => {
  const applyMatch = pathname.match(/^\/apply\/([^/]+)/);
  if (applyMatch) {
    return {
      type: "apply",
      targetPath: pathname,
      updatedAt: Date.now(),
    };
  }

  const detailsMatch = pathname.match(/^\/dashboard\/application\/([^/]+)$/);
  if (detailsMatch) {
    return {
      type: "application-details",
      targetPath: `/dashboard/application/${detailsMatch[1]}#document-upload-section`,
      updatedAt: Date.now(),
    };
  }

  const destinationMatch = pathname.match(/^\/destination\/([^/]+)$/);
  if (destinationMatch) {
    return {
      type: "destination-apply",
      targetPath: pathname,
      updatedAt: Date.now(),
    };
  }

  const summaryMatch = pathname.match(/^\/destination\/([^/]+)\/summary$/);
  if (summaryMatch) {
    return {
      type: "payment-summary",
      targetPath: pathname,
      updatedAt: Date.now(),
    };
  }

  return null;
};

const readPendingContext = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(EXIT_INTENT_PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writePendingContext = (context) => {
  if (typeof window === "undefined" || !context) return;
  try {
    localStorage.setItem(EXIT_INTENT_PENDING_KEY, JSON.stringify(context));
  } catch {
    /* ignore storage errors */
  }
};

const getLeaveWarningMessage = () =>
  "Are you leaving the website? You have a pending visa application. If you leave now, your progress may not be completed.";

const ExitIntentBanner = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const pendingVisibilityTriggerRef = useRef(false);
  const revisitTimeoutRef = useRef(null);
  const allowGuardedBackRef = useRef(false);

  const alreadyShown = useMemo(() => {
    if (typeof window === "undefined") return true;
    return sessionStorage.getItem(EXIT_INTENT_STORAGE_KEY) === "true";
  }, []);

  useEffect(() => {
    const context = buildPendingContext(location.pathname);
    if (!context) {
      try {
        localStorage.removeItem(EXIT_INTENT_PENDING_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    writePendingContext(context);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentFlowContext = buildPendingContext(location.pathname);
    if (!currentFlowContext) return;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = getLeaveWarningMessage();
      return getLeaveWarningMessage();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentFlowContext = buildPendingContext(location.pathname);
    if (!currentFlowContext) return;

    window.history.pushState({ exitIntentGuard: true }, "", window.location.href);

    const handlePopState = () => {
      if (allowGuardedBackRef.current) {
        allowGuardedBackRef.current = false;
        return;
      }

      const shouldLeave = window.confirm(getLeaveWarningMessage());
      if (!shouldLeave) {
        window.history.pushState({ exitIntentGuard: true }, "", window.location.href);
        return;
      }

      allowGuardedBackRef.current = true;
      window.history.back();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined" || alreadyShown) return;

    const showBanner = () => {
      if (sessionStorage.getItem(EXIT_INTENT_STORAGE_KEY) === "true") return;
      sessionStorage.setItem(EXIT_INTENT_STORAGE_KEY, "true");
      setVisible(true);
    };

    const handleMouseLeave = (event) => {
      if (event.clientY <= 0) showBanner();
    };

    const handleVisibilityChange = () => {
      if (document.hidden === true) {
        pendingVisibilityTriggerRef.current = true;
        return;
      }

      if (pendingVisibilityTriggerRef.current) {
        pendingVisibilityTriggerRef.current = false;
        showBanner();
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [alreadyShown]);

  useEffect(() => {
    if (typeof window === "undefined" || alreadyShown) return;

    const pendingContext = readPendingContext();
    if (!pendingContext?.targetPath) return;

    const currentPathWithoutHash = `${location.pathname}${location.search || ""}`;
    const pendingPathWithoutHash = String(pendingContext.targetPath).split("#")[0];
    if (currentPathWithoutHash === pendingPathWithoutHash) return;

    const shouldPromptOnRevisit =
      Date.now() - Number(pendingContext.updatedAt || 0) >= REVISIT_THRESHOLD_MS;
    if (!shouldPromptOnRevisit) return;

    revisitTimeoutRef.current = window.setTimeout(() => {
      if (sessionStorage.getItem(EXIT_INTENT_STORAGE_KEY) === "true") return;
      sessionStorage.setItem(EXIT_INTENT_STORAGE_KEY, "true");
      setVisible(true);
    }, REVISIT_BANNER_DELAY_MS);

    return () => {
      if (revisitTimeoutRef.current) {
        window.clearTimeout(revisitTimeoutRef.current);
      }
    };
  }, [alreadyShown, location.pathname, location.search]);

  const closeBanner = () => {
    setVisible(false);
  };

  const handleContinue = () => {
    setVisible(false);

    const pendingContext = readPendingContext();
    if (pendingContext && pendingContext.targetPath) {
      if (pendingContext.targetPath === location.pathname) {
        // We are already on the correct page. Simply dismissing the banner preserves the unsaved form state.
        return;
      }
      navigate(pendingContext.targetPath, {
        state: { resumedFromExitIntent: true },
        replace: true,
      });
      return;
    }

    // Default fallback if no context exists
    navigate(-1);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[120] flex justify-center px-4 pt-4 sm:px-6">
      <div
        className={`w-full max-w-xl transform transition-all duration-300 ease-out ${
          visible
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-6 opacity-0"
        }`}
        aria-hidden={!visible}
      >
        <div className="overflow-hidden rounded-2xl border border-cyan/20 bg-white/90 shadow-[0_22px_60px_-30px_rgba(8,145,178,0.35)] backdrop-blur-xl">
          <div className="flex items-start gap-3 p-4 sm:p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan/10 text-cyan">
              <ShieldCheck size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-slate-950">Leaving already?</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Complete your visa application now and save your progress.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleContinue}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan/90"
                >
                  Continue Application
                  <ArrowRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={closeBanner}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  Maybe Later
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={closeBanner}
              aria-label="Close exit intent banner"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExitIntentBanner;
