import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BOOKINGS as initialBookings } from "../data/bookings";
import { COUNTRIES as initialCountries } from "../data/countries";
import { api } from "./authStore";

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

      // ── Application Draft ─────────────────────────────────
      setApplicationDraft: (draft) => set({ applicationDraft: draft }),
      clearApplicationDraft: () => set({ applicationDraft: null }),

      // ── Bookings ──────────────────────────────────────────
      addBooking: (booking) =>
        set((state) => ({
          bookings: [booking, ...state.bookings],
        })),

      // Update booking fields (e.g., from ApplicationDetails page)
      updateBookingDetails: (id, details) =>
        set((state) => ({
          bookings: state.bookings.map((b) =>
            (b._id === id || b.id === id) ? { ...b, ...details, updatedAt: new Date().toISOString() } : b
          ),
        })),

      // ── Countries ─────────────────────────────────────────
      // Helper to fetch live country by ID
      getCountryById: (id) => get().countries.find((c) => c.id === id),
      
      // Helper to fetch live bookings for a user
      getUserBookings: (userId) => get().bookings.filter((b) => b.userId === userId),
    }),
    {
      name: "visa-voyage-data-store", // unique name for localStorage key
    }
  )
);
