// ============================================================
//  Zustand Auth Store
//  Manages user authentication state globally.
//  Mock login: user@visa.com
// ============================================================
import { create } from "zustand";
import { persist } from "zustand/middleware";
import axios from "axios";

// ── Axios Instance ───────────────────────────────────────────
/** Backend origin only (no /api). Strips trailing /api so VITE_API_URL=http://host:5000/api does not become .../api/api. */
const normalizeServerUrl = (url) => {
  let s = String(url ?? "http://localhost:5000").trim();
  if (!s) s = "http://localhost:5000";
  s = s.replace(/\/+$/, "");
  while (/\/api$/i.test(s)) {
    s = s.replace(/\/api$/i, "").replace(/\/+$/, "");
  }
  return s;
};

export const SERVER_URL = normalizeServerUrl(import.meta.env.VITE_API_URL);
export const API_BASE_URL = SERVER_URL ? `${SERVER_URL}/api` : "/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const isEmailIdentifier = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim().toLowerCase());

/** Normalize phone entered at OTP login for display when API omits user.phone */
const displayPhoneFromLoginInput = (raw) => {
  const trimmed = String(raw || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    return last10.length === 10 ? `+91 ${last10.slice(0, 5)} ${last10.slice(5)}` : `+${digits}`;
  }
  return trimmed || null;
};

/** Map GET /users/profile document to persisted auth user shape */
const mapProfileUserToAuthState = (u) => ({
  role: "user",
  id: u._id?.toString?.() ? u._id.toString() : String(u._id || u.id || ""),
  name: u.name,
  email: u.email,
  phone: u.phone,
  isVerified: u.isVerified,
  profileImage: u.profileImage,
  age: u.age,
  gender: u.gender,
  passportNumber: u.passportNumber,
  hasPassword: u.hasPassword,
  createdAt: u.createdAt,
});

/** When /users/profile fails, use login/verify API user payload */
const mapApiUserToAuthState = (raw) => {
  if (!raw) return null;
  return {
    role: "user",
    id: raw.id?.toString?.() ? raw.id.toString() : String(raw.id || raw._id || ""),
    name: raw.name,
    email: raw.email,
    phone: raw.phone,
    isVerified: raw.isVerified,
    profileImage: raw.profileImage,
    age: raw.age,
    gender: raw.gender,
    passportNumber: raw.passportNumber,
    hasPassword: raw.hasPassword,
    createdAt: raw.createdAt,
  };
};

// ── Auth Store Definition ──────────────────────────────────
export const useAuthStore = create(
  // persist middleware: saves auth state to localStorage
  persist(
    (set, get) => ({
      // ── State ──────────────────────────────────────────
      user: null,             // Current user object or null
      isAuthenticated: false, // Whether user is logged in
      /** Last successful log-in: "password" | "otp" | null (shown on dashboard) */
      sessionAuthMethod: null,
      isLoading: false,       // Loading state for login action
      error: null,            // Error message from login failure

      // ── Actions ────────────────────────────────────────

      /**
       * refreshUserFromServer() — Sync user from DB after token is set
       */
      refreshUserFromServer: async (opts = {}) => {
        try {
          const { data } = await api.get("/users/profile");
          if (!data.success || !data.user) return null;
          const userObj = mapProfileUserToAuthState(data.user);
          set(() => ({
            user: userObj,
            isAuthenticated: true,
            ...(opts.sessionAuthMethod != null ? { sessionAuthMethod: opts.sessionAuthMethod } : {}),
          }));
          return userObj;
        } catch {
          return null;
        }
      },
      
      /**
       * login() — Authenticate a user
       */
      login: async (identifier, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post("/users/login", { identifier, email: identifier, password });
          
          if (data.success) {
            localStorage.setItem("token", data.token);
            const refreshed = await get().refreshUserFromServer({ sessionAuthMethod: "password" });
            if (!refreshed) {
              const fallback = mapApiUserToAuthState(data.user || data.admin);
              if (fallback) {
                set({ user: fallback, isAuthenticated: true, sessionAuthMethod: "password" });
              }
            }
            set({ isLoading: false });
            return { success: true, role: "user" };
          }
          set({ isLoading: false });
          return { success: false, role: null };
        } catch (error) {
          const message = error.response?.data?.message || "Login failed";
          set({ error: message, isLoading: false });
          return { success: false, role: null };
        }
      },

      /**
       * verifyOtp() — Verify OTP for NEW user signup
       */
      verifyOtp: async (identifier, otp) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post("/users/verify-otp", { identifier, otp });
          if (data.success) {
            localStorage.setItem("token", data.token);
            const refreshed = await get().refreshUserFromServer({ sessionAuthMethod: "otp" });
            if (!refreshed) {
              const fallback = mapApiUserToAuthState(data.user);
              if (fallback) {
                set({ user: fallback, isAuthenticated: true, sessionAuthMethod: "otp" });
              }
            }
            set({ isLoading: false });
            return { success: true, role: "user" };
          }
          set({ isLoading: false });
          return { success: false };
        } catch (error) {
          const message = error.response?.data?.message || "OTP verification failed";
          set({ error: message, isLoading: false });
          return { success: false };
        }
      },

      /**
       * sendLoginOtp() — Send OTP to existing user for passwordless login
       * @param {string} identifier — email or phone
       * @param {{ otpLength?: 4 | 6 }} [opts] — default 6; use 4 for short apply/login flows
       */
      sendLoginOtp: async (identifier, opts = {}) => {
        set({ isLoading: true, error: null });
        try {
          const otpLength = opts.otpLength === 4 ? 4 : 6;
          const { data } = await api.post("/users/send-login-otp", { identifier, otpLength });
          if (data.success) {
            set({ isLoading: false });
            return { success: true, devOtp: data.devOtp };
          }
          const failMsg = data.message || "Failed to send OTP";
          set({ error: failMsg, isLoading: false });
          return { success: false, message: failMsg };
        } catch (error) {
          const message = error.response?.data?.message || "Failed to send OTP";
          set({ error: message, isLoading: false });
          return { success: false, message };
        }
      },

      /**
       * verifyLoginOtp() — Verify OTP for existing user login (does NOT touch isVerified)
       */
      verifyLoginOtp: async (identifier, otp) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post("/users/verify-login-otp", { identifier, otp });
          if (data.success) {
            localStorage.setItem("token", data.token);
            let userFromProfile = await get().refreshUserFromServer({ sessionAuthMethod: "otp" });
            if (!userFromProfile) {
              const fallback = mapApiUserToAuthState(data.user);
              if (fallback) {
                set({ user: fallback, isAuthenticated: true, sessionAuthMethod: "otp" });
                userFromProfile = fallback;
              }
            }
            const id = String(identifier || "").trim();
            if (
              userFromProfile &&
              !userFromProfile.phone &&
              !isEmailIdentifier(id) &&
              id.replace(/\D/g, "").length >= 10
            ) {
              const shown = displayPhoneFromLoginInput(id);
              if (shown) {
                set({ user: { ...get().user, phone: shown } });
              }
            }
            set({ isLoading: false });
            return { success: true, role: "user" };
          }
          set({ isLoading: false });
          return { success: false };
        } catch (error) {
          const message = error.response?.data?.message || "OTP verification failed";
          set({ error: message, isLoading: false });
          return { success: false };
        }
      },

      /**
       * forgotPasswordRequestOtp() — Send reset OTP to email
       */
      /**
       * Exchange Firebase ID token for app JWT (Google, Email/Password, etc.).
       *
       * Perf: the /firebase-auth response already returns the user document we need to
       * navigate (id/name/email/phone/profileImage/isVerified), so we set auth state and
       * resolve immediately. The full profile (age/gender/passport, etc.) is enriched in
       * the background. This shaves one full server roundtrip off the perceived sign-in
       * time — important on mobile + Render free-tier where the second hop was the visible
       * 2–5s spinner after the Google popup closed.
       *
       * @param {"google"|"facebook"|"firebase"} sessionAuthMethod
       */
      loginWithFirebaseIdToken: async (idToken, sessionAuthMethod = "firebase") => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post("/users/firebase-auth", { idToken });
          if (data.success) {
            localStorage.setItem("token", data.token);
            const initial = mapApiUserToAuthState(data.user);
            if (initial) {
              set({
                user: initial,
                isAuthenticated: true,
                sessionAuthMethod,
                isLoading: false,
              });
              get()
                .refreshUserFromServer({ sessionAuthMethod })
                .catch(() => {});
              return { success: true, role: "user" };
            }
            const refreshed = await get().refreshUserFromServer({ sessionAuthMethod });
            set({ isLoading: false });
            return { success: !!refreshed, role: refreshed ? "user" : null };
          }
          set({ isLoading: false });
          return { success: false, role: null };
        } catch (error) {
          const status = error.response?.status;
          const serverMsg = error.response?.data?.message;
          const message =
            status === 404
              ? serverMsg ||
                "API returned 404. Set VITE_API_URL in client/.env to your backend origin (e.g. http://localhost:5000) so /api/users/firebase-auth is reachable."
              : serverMsg || error.message || "Firebase log-in failed";
          set({ error: message, isLoading: false });
          return { success: false, role: null, message };
        }
      },

      loginWithFirebaseGoogle: async (idToken) => {
        return get().loginWithFirebaseIdToken(idToken, "google");
      },

      loginWithFirebaseFacebook: async (idToken) => {
        return get().loginWithFirebaseIdToken(idToken, "facebook");
      },

      loginWithFirebaseEmailPassword: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { signInWithFirebaseEmail } = await import("../utils/firebaseAuth");
          const token = await signInWithFirebaseEmail(email, password);
          return await get().loginWithFirebaseIdToken(token, "firebase");
        } catch (error) {
          const message = error?.message || "Firebase log-in failed";
          set({ error: message, isLoading: false });
          return { success: false, message };
        }
      },

      registerWithFirebaseEmail: async (name, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { signUpWithFirebaseEmail } = await import("../utils/firebaseAuth");
          const token = await signUpWithFirebaseEmail(email, password, name);
          return await get().loginWithFirebaseIdToken(token, "firebase");
        } catch (error) {
          const message = error?.message || "Firebase sign-up failed";
          set({ error: message, isLoading: false });
          return { success: false, message };
        }
      },

      forgotPasswordRequestOtp: async (identifier) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post("/users/forgot-password/request-otp", { identifier });
          set({ isLoading: false });
          return {
            success: !!data.success,
            message: data.message,
            devOtp: data.devOtp != null ? String(data.devOtp) : undefined,
          };
        } catch (error) {
          const message = error.response?.data?.message || "Failed to send reset OTP";
          set({ isLoading: false, error: message });
          return { success: false, message };
        }
      },

      /**
       * forgotPasswordReset() — Verify OTP and reset password
       */
      forgotPasswordReset: async (identifier, otp, newPassword) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post("/users/forgot-password/reset", {
            identifier,
            otp,
            newPassword,
          });
          set({ isLoading: false });
          return { success: !!data.success, message: data.message };
        } catch (error) {
          const message = error.response?.data?.message || "Failed to reset password";
          set({ isLoading: false, error: message });
          return { success: false, message };
        }
      },

      /**
       * register() - Create a new account
       */
      register: async (name, identifier, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post("/users/signup", { name, identifier, password });
          if (data.success) {
            set({ isLoading: false });
            return {
              success: true,
              devOtp: data.devOtp != null ? String(data.devOtp) : undefined,
            };
          }
          const message = data.message || "Registration failed";
          set({ error: message, isLoading: false });
          return { success: false };
        } catch (error) {
          const message = error.response?.data?.message || "Registration failed";
          set({ error: message, isLoading: false });
          return { success: false };
        }
      },

      /**
       * logout() — Clear auth state
       */
      logout: () => {
        localStorage.removeItem("token");
        set({ user: null, isAuthenticated: false, error: null, sessionAuthMethod: null });
      },

      /**
       * clearError() — Dismiss the error message
       */
      clearError: () => set({ error: null }),

      /**
       * updateProfile() — Update user profile fields
       */
      updateProfile: async (updates) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.put("/users/profile/update", updates);
          if (data.success && data.user) {
            const mapped = mapProfileUserToAuthState(data.user);
            set({ user: { ...get().user, ...mapped }, isLoading: false });
            return { success: true };
          }
        } catch (error) {
          const message = error.response?.data?.message || "Update failed";
          set({ isLoading: false, error: message });
          return { success: false, message };
        }
        set({ isLoading: false });
        return { success: false, message: "Update failed" };
      },

      /**
       * resetPasswordRequest() — Trigger reset OTP
       */
      resetPasswordRequest: async () => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post("/users/profile/reset-request");
          set({ isLoading: false });
          return { success: true, message: data.message };
        } catch (error) {
          const message = error.response?.data?.message || "Reset request failed";
          set({ isLoading: false, error: message });
          return { success: false, message };
        }
      },

      /**
       * changeUserPassword() — User changes their password
       */
      changeUserPassword: async (currentPassword, newPassword) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.put("/users/change-password", { currentPassword, newPassword });
          set({
            isLoading: false,
            user: get().user ? { ...get().user, hasPassword: true } : get().user,
          });
          return { success: true, message: data.message };
        } catch (error) {
          const message = error.response?.data?.message || "Password change failed";
          set({ isLoading: false, error: message });
          return { success: false, message };
        }
      },

      /**
       * uploadProfileImage()
       */
      uploadProfileImage: async (file) => {
        set({ isLoading: true, error: null });
        try {
          const formData = new FormData();
          formData.append("profileImage", file);
          const { data } = await api.post("/users/profile/upload-image", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          if (data.success) {
            set({ user: { ...get().user, profileImage: data.profileImage }, isLoading: false });
            return { success: true, url: data.profileImage };
          }
        } catch {
          set({ isLoading: false, error: "Upload failed" });
          return { success: false };
        }
      },
    }),
    {
      name: "visa-voyage-auth",          // localStorage key
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        sessionAuthMethod: state.sessionAuthMethod,
      }),
      // Auto-heal corrupted state: if token says "logged in" but user object
      // is missing, reset to logged-out so ProtectedRoute sends to /login
      onRehydrateStorage: () => (state) => {
        if (state && state.isAuthenticated && !state.user) {
          state.isAuthenticated = false;
          localStorage.removeItem("token");
        }
      },
    }
  )
);
