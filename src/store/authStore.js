// ============================================================
//  Zustand Auth Store
//  Manages user authentication state globally.
//  Mock login: user@visa.com / admin@visa.com
//  Replace login() action with real API call when backend ready.
// ============================================================
import { create } from "zustand";
import { persist } from "zustand/middleware";
import axios from "axios";

const ADMIN_TOKEN_KEY = "admin_token";

// ── Axios Instance ───────────────────────────────────────────
export const SERVER_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const API_BASE_URL = `${SERVER_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth Store Definition ──────────────────────────────────
export const useAuthStore = create(
  // persist middleware: saves auth state to localStorage
  persist(
    (set, get) => ({
      // ── State ──────────────────────────────────────────
      user: null,             // Current user object or null
      isAuthenticated: false, // Whether user is logged in
      isLoading: false,       // Loading state for login action
      error: null,            // Error message from login failure

      // ── Actions ────────────────────────────────────────
      
      /**
       * login() — Authenticate a user
       */
      login: async (identifier, password) => {
        set({ isLoading: true, error: null });
        try {
          let endpoint = "/users/login";
          if (identifier.toLowerCase().includes("admin")) {
            endpoint = "/admin/login";
          }

          const { data } = await api.post(endpoint, { identifier, email: identifier, password });
          
          if (data.success) {
            const rawUser = data.user || data.admin;
            const userObj = { role: "user", ...rawUser };
            localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
            set({ user: userObj, isAuthenticated: true, isLoading: false });
            return { success: true, role: userObj.role };
          }
        } catch (error) {
          const message = error.response?.data?.message || "Login failed";
          set({ error: message, isLoading: false });
          return { success: false, role: null };
        }
      },

      /**
       * loginAdmin() — Dedicated Admin login, sends clean { email, password }
       */
      loginAdmin: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post("/admin/login", { email, password });
          if (data.success) {
            const userObj = { ...data.admin, role: "admin" };
            localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
            set({ user: userObj, isAuthenticated: true, isLoading: false });
            return { success: true };
          }
        } catch (error) {
          const message = error.response?.data?.message || "Invalid credentials";
          set({ error: message, isLoading: false });
          return { success: false };
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
            const userObj = { role: "user", ...data.user };
            localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
            set({ user: userObj, isAuthenticated: true, isLoading: false });
            return { success: true, role: userObj.role };
          }
        } catch (error) {
          const message = error.response?.data?.message || "OTP verification failed";
          set({ error: message, isLoading: false });
          return { success: false };
        }
      },

      /**
       * sendLoginOtp() — Send OTP to existing user for passwordless login
       */
      sendLoginOtp: async (identifier) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post("/users/send-login-otp", { identifier });
          if (data.success) {
            set({ isLoading: false });
            return { success: true };
          }
        } catch (error) {
          const message = error.response?.data?.message || "Failed to send OTP";
          set({ error: message, isLoading: false });
          return { success: false };
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
            const userObj = { role: "user", ...data.user };
            localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
            set({ user: userObj, isAuthenticated: true, isLoading: false });
            return { success: true, role: userObj.role };
          }
        } catch (error) {
          const message = error.response?.data?.message || "OTP verification failed";
          set({ error: message, isLoading: false });
          return { success: false };
        }
      },

      /**
       * forgotPasswordRequestOtp() — Send reset OTP to email
       */
      forgotPasswordRequestOtp: async (email) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post("/users/forgot-password/request-otp", { email });
          set({ isLoading: false });
          return { success: !!data.success, message: data.message };
        } catch (error) {
          const message = error.response?.data?.message || "Failed to send reset OTP";
          set({ isLoading: false, error: message });
          return { success: false, message };
        }
      },

      /**
       * forgotPasswordReset() — Verify OTP and reset password
       */
      forgotPasswordReset: async (email, otp, newPassword) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post("/users/forgot-password/reset", { email, otp, newPassword });
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
      register: async (name, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post("/users/signup", { name, identifier: email, password });
          if (data.success) {
            set({ isLoading: false });
            return { success: true };
          }
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
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        set({ user: null, isAuthenticated: false, error: null });
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
          if (data.success) {
            set({ user: { ...get().user, ...data.user }, isLoading: false });
            return { success: true };
          }
        } catch (error) {
          const message = error.response?.data?.message || "Update failed";
          set({ isLoading: false, error: message });
          return { success: false, message };
        }
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
       * changeAdminPassword() — Admin changes their password
       */
      changeAdminPassword: async (currentPassword, newPassword) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.put("/admin/change-password", { currentPassword, newPassword });
          set({ isLoading: false });
          return { success: true, message: data.message };
        } catch (error) {
          const message = error.response?.data?.message || "Password change failed";
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
          set({ isLoading: false });
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
        } catch (error) {
          set({ isLoading: false, error: "Upload failed" });
          return { success: false };
        }
      },
    }),
    {
      name: "visa-voyage-admin-auth",          // localStorage key
      partialize: (state) => ({   // Only persist user + auth status
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      // Auto-heal corrupted state: if token says "logged in" but user object
      // is missing, reset to logged-out so ProtectedRoute sends to /login
      onRehydrateStorage: () => (state) => {
        if (state && state.isAuthenticated && !state.user) {
          state.isAuthenticated = false;
          localStorage.removeItem(ADMIN_TOKEN_KEY);
        }
      },
    }
  )
);



