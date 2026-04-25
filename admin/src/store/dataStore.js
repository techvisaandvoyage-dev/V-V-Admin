import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BOOKINGS as initialBookings } from "../data/bookings";
import { COUNTRIES as initialCountries } from "../data/countries";
import { api, API_BASE_URL } from "./authStore";

const ADMIN_TOKEN_KEY = "admin_token";

export const useDataStore = create(
  persist(
    (set, get) => ({
      bookings: initialBookings || [],
      countries: initialCountries || [],
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
      addCountry: (country) =>
        set((state) => ({
          countries: [...state.countries, country],
        })),

      updateCountry: (id, updatedCountry) =>
        set((state) => ({
          countries: state.countries.map((c) =>
            c.id === id ? { ...c, ...updatedCountry } : c
          ),
        })),

      deleteCountry: (id) =>
        set((state) => ({
          countries: state.countries.filter((c) => c.id !== id),
        })),

      // Helper to fetch live country by ID
      getCountryById: (id) => get().countries.find((c) => c.id === id),
      
      // Helper to fetch live bookings for a user
      getUserBookings: (userId) => get().bookings.filter((b) => b.userId === userId),
    }),
    {
      name: "visa-voyage-admin-data-store", // unique name for localStorage key
    }
  )
);
