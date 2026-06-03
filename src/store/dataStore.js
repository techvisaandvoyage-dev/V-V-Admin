import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BOOKINGS as initialBookings } from "../data/bookings";
import { api, API_BASE_URL } from "./authStore";

const ADMIN_TOKEN_KEY = "admin_token";

export const useDataStore = create(
  persist(
    (set, get) => ({
      bookings: initialBookings || [],
      countries: [],
      pages: [],
      pagesPagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
      applicationDraft: null,

      // ── Setters ───────────────────────────────────────────
      setBookings: (bookings) => set({ bookings: Array.isArray(bookings) ? bookings : [] }),

      // ── API Actions ───────────────────────────────────────
      fetchUserApplications: async () => {
        try {
          const { data } = await api.get("/users/applications");
          if (data.success) {
            set({ bookings: Array.isArray(data.applications) ? data.applications : [] });
          }
        } catch (error) {
          console.error("Error fetching user applications:", error);
        }
      },

      fetchAllApplications: async () => {
        try {
          const { data } = await api.get("/admin/applications");
          if (data.success) {
            set({ bookings: Array.isArray(data.applications) ? data.applications : [] });
          }
        } catch (error) {
          console.error("Error fetching all applications:", error);
        }
      },

      // ── Application Draft ─────────────────────────────────
      setApplicationDraft: (draft) => set({ applicationDraft: draft }),
      clearApplicationDraft: () => set({ applicationDraft: null }),

      // ── Bookings ──────────────────────────────────────────
      addBooking: (booking) =>
        set((state) => ({
          bookings: [booking, ...state.bookings],
        })),

      updateBookingStatus: async (id, newStatus) => {
        try {
          // 1. Update local state immediately (Optimistic UI)
          set((state) => ({
            bookings: state.bookings.map((b) =>
              (b._id === id || b.id === id) ? { ...b, status: newStatus, updatedAt: new Date().toISOString() } : b
            ),
          }));

          // 2. Persist to backend if not a mock ID
          if (id && !id.startsWith("bk-")) {
            await api.put(`/admin/applications/${id}/status`, 
              { status: newStatus }
            );
          }
        } catch (error) {
          console.error("Error updating booking status:", error);
          // Optional: Revert local state on error
        }
      },

      // Update booking fields (e.g., from ApplicationDetails page)
      updateBookingDetails: (id, details) =>
        set((state) => ({
          bookings: state.bookings.map((b) =>
            (b._id === id || b.id === id) ? { ...b, ...details, updatedAt: new Date().toISOString() } : b
          ),
        })),

      // ── Countries ─────────────────────────────────────────
      fetchCountries: async () => {
        try {
          const { data } = await api.get("/admin/countries-list", {
            params: { includeInactive: true },
          });
          if (data.success) {
            set({ countries: data.countries });
            return { success: true };
          }
          return { success: false, message: data.message || "Failed to load countries" };
        } catch (err) {
          console.error("Error fetching countries:", err);
          return {
            success: false,
            message: err.response?.data?.message || err.message || "Failed to load countries",
          };
        }
      },

      fetchPages: async (params = {}) => {
        try {
          const { data } = await api.get("/admin/pages", { params });
          if (data.success) {
            set({
              pages: Array.isArray(data.items) ? data.items : [],
              pagesPagination: data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 },
            });
          }
          return data;
        } catch (err) {
          console.error("Error fetching pages:", err);
          return { success: false, message: err.response?.data?.message || "Failed to fetch pages" };
        }
      },

      createPage: async (pageData) => {
        try {
          const { data } = await api.post("/admin/pages", pageData);
          if (data.success) {
            set((state) => ({ pages: [data.page, ...state.pages] }));
          }
          return data;
        } catch (err) {
          console.error("Error creating page:", err);
          return { success: false, message: err.response?.data?.message || "Failed to create page" };
        }
      },

      updatePage: async (id, pageData) => {
        try {
          const { data } = await api.put(`/admin/pages/${id}`, pageData);
          if (data.success) {
            set((state) => ({
              pages: state.pages.map((page) => (page._id === id ? data.page : page)),
            }));
          }
          return data;
        } catch (err) {
          console.error("Error updating page:", err);
          return { success: false, message: err.response?.data?.message || "Failed to update page" };
        }
      },

      togglePageStatus: async (id) => {
        try {
          const { data } = await api.patch(`/admin/pages/${id}/toggle-status`);
          if (data.success) {
            set((state) => ({
              pages: state.pages.map((page) => (page._id === id ? data.page : page)),
            }));
          }
          return data;
        } catch (err) {
          console.error("Error toggling page status:", err);
          return { success: false, message: err.response?.data?.message || "Failed to update page status" };
        }
      },

      deletePage: async (id) => {
        try {
          const { data } = await api.delete(`/admin/pages/${id}`);
          if (data.success) {
            set((state) => ({
              pages: state.pages.filter((page) => page._id !== id),
            }));
          }
          return data;
        } catch (err) {
          console.error("Error deleting page:", err);
          return { success: false, message: err.response?.data?.message || "Failed to delete page" };
        }
      },

      addCountry: async (countryData) => {
        try {
          const { data } = await api.post("/admin/countries", countryData);
          if (data.success) {
            set((state) => ({ countries: [...state.countries, data.country] }));
          }
          return data;
        } catch (err) {
          console.error("Error adding country:", err);
          return { success: false, message: err.response?.data?.message || "Failed to add country" };
        }
      },

      updateCountry: async (id, updatedData) => {
        try {
          const { data } = await api.put(`/admin/countries/${id}`, updatedData);
          if (data.success) {
            const idStr = String(id);
            set((state) => ({
              countries: state.countries.map((c) =>
                String(c._id) === idStr || c.id === idStr || c.slug === idStr ? data.country : c
              ),
            }));
          }
          return data;
        } catch (err) {
          console.error("Error updating country:", err);
          return { success: false, message: err.response?.data?.message || "Failed to update country" };
        }
      },

      deleteCountry: async (id) => {
        try {
          await api.delete(`/admin/countries/${id}`);
          set((state) => ({
            countries: state.countries.filter((c) => c._id !== id && c.id !== id),
          }));
          return { success: true };
        } catch (err) {
          console.error("Error deleting country:", err);
          return { success: false };
        }
      },

      // Helper to fetch live country by ID
      getCountryById: (id) => get().countries.find((c) => c._id === id || c.id === id),
      
      // Helper to fetch live bookings for a user
      getUserBookings: (userId) => get().bookings.filter((b) => b.userId === userId),
    }),
    {
      name: "visa-voyage-admin-data-store-v2", // v2: countries are DB-backed, no stale static data
    }
  )
);
