/** @type {import('tailwindcss').Config} */
// ============================================================
//  Tailwind CSS Configuration
//  Defines the custom design system tokens for the Visa App:
//  colors, fonts, backdrop blur, and animation utilities.
// ============================================================
export default {
  // Scan all JSX/JS files inside src/ for class names
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ── Custom Color Palette ──────────────────────────────
      colors: {
        // Base backgrounds
        background: "#0a0a0a",     // Deepest background
        surface:    "#171717",     // Card / sidebar surfaces
        "surface-2":"#1e1e1e",    // Elevated surface (modals, inputs)
        "surface-3":"#252525",    // Hover states

        // Primary accent — Vibrant Cyan
        cyan: {
          DEFAULT: "#00d4ff",
          dim:     "#00a8cc",
          glow:    "rgba(0, 212, 255, 0.15)",
          border:  "rgba(0, 212, 255, 0.3)",
        },

        // Secondary accent — Gold (pricing, badges, highlights)
        gold: {
          DEFAULT: "#f5a623",
          dim:     "#c7861c",
          glow:    "rgba(245, 166, 35, 0.15)",
        },

        // Status colors
        status: {
          pending:  "#f59e0b",   // Amber
          approved: "#10b981",   // Emerald
          review:   "#3b82f6",   // Blue
          rejected: "#ef4444",   // Red
        },

        // Text hierarchy
        text: {
          primary:   "#f5f5f5",
          secondary: "#a1a1aa",
          muted:     "#71717a",
        },

        // Border
        border: {
          DEFAULT: "#2a2a2a",
          light:   "#3a3a3a",
        },
      },

      // ── Typography ────────────────────────────────────────
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": "0.625rem",
      },

      // ── Backdrop Blur ─────────────────────────────────────
      backdropBlur: {
        xs: "2px",
        sm: "4px",
        md: "12px",
        lg: "20px",
        xl: "40px",
      },

      // ── Box Shadows ───────────────────────────────────────
      boxShadow: {
        "cyan-glow":  "0 0 20px rgba(0, 212, 255, 0.25)",
        "cyan-glow-lg":"0 0 40px rgba(0, 212, 255, 0.35)",
        "gold-glow":  "0 0 20px rgba(245, 166, 35, 0.25)",
        "card":       "0 4px 24px rgba(0, 0, 0, 0.4)",
        "modal":      "0 8px 48px rgba(0, 0, 0, 0.6)",
      },

      // ── Animations ────────────────────────────────────────
      animation: {
        "fade-in":     "fadeIn 0.4s ease-out",
        "slide-up":    "slideUp 0.4s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "pulse-cyan":  "pulseCyan 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%":   { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseCyan: {
          "0%, 100%": { boxShadow: "0 0 10px rgba(0, 212, 255, 0.2)" },
          "50%":      { boxShadow: "0 0 30px rgba(0, 212, 255, 0.5)" },
        },
      },

      // ── Border Radius ─────────────────────────────────────
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
