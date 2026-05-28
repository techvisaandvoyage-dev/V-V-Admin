// ============================================================
//  Zustand UI Store
//  Manages UI-only state: sidebar, modals, app form step.
//  No persistence needed — state resets on page refresh.
// ============================================================
import { create } from "zustand";

export const useUIStore = create((set) => ({
  // ── Sidebar state ──────────────────────────────────────
  sidebarOpen: true,    // Whether the dashboard sidebar is expanded
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (val) => set({ sidebarOpen: val }),

  // ── Application form multi-step ────────────────────────
  currentStep: 0,       // 0 = Personal Info, 1 = Documents, 2 = Payment
  totalSteps: 3,
  setStep: (step) => set({ currentStep: step }),
  nextStep: () => set((s) => ({
    currentStep: Math.min(s.currentStep + 1, s.totalSteps - 1),
  })),  
  prevStep: () => set((s) => ({
    currentStep: Math.max(s.currentStep - 1, 0),
  })),
  resetSteps: () => set({ currentStep: 0 }),

  // ── Country Manager modal (Admin) ──────────────────────
  countryModalOpen: false,
  countryModalMode: "add",          // "add" | "edit"
  selectedCountry: null,            // Country being edited
  openCountryModal: (mode = "add", country = null) =>
    set({ countryModalOpen: true, countryModalMode: mode, selectedCountry: country }),
  setSelectedCountry: (country) =>
    set({ selectedCountry: country }),
  closeCountryModal: () =>
    set({ countryModalOpen: false, selectedCountry: null }),

  // ── Notification toast ─────────────────────────────────
  toast: { show: false, message: "", type: "success" },
  showToast: (message, type = "success") =>
    set({ toast: { show: true, message, type } }),
  hideToast: () => set((s) => ({ toast: { ...s.toast, show: false } })),

  // ── Mobile navigation ──────────────────────────────────
  mobileMenuOpen: false,
  toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
  closeMobileMenu: () => set({ mobileMenuOpen: false }),
}));
