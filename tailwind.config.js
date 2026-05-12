/** @type {import('tailwindcss').Config} */
// ============================================================
//  Tailwind CSS Configuration — matches client theme
// ============================================================
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ── Custom Color Palette ──────────────────────────────
      colors: {
        // Base backgrounds - Light theme
        background: "#f0f4f8",
        surface:    "#ffffff",
        "surface-2":"#f8f9fa",
        "surface-3":"#e9ecf1",

        // Primary accent — Cyan (light theme)
        cyan: {
          DEFAULT: "#0284c7",
          dim:     "#0369a1",
          glow:    "rgba(2, 132, 199, 0.12)",
          border:  "rgba(2, 132, 199, 0.25)",
        },

        // Secondary accent — Gold
        gold: {
          DEFAULT: "#d97706",
          dim:     "#b45309",
          glow:    "rgba(217, 119, 6, 0.12)",
        },

        // Status colors
        status: {
          pending:  "#f59e0b",
          approved: "#10b981",
          review:   "#3b82f6",
          rejected: "#ef4444",
        },

        // Text hierarchy - Light theme
        text: {
          primary:   "#000000",
          secondary: "#4b5563",
          muted:     "#9ca3af",
        },

        // Border
        border: {
          DEFAULT: "#e5e7eb",
          light:   "#f3f4f6",
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
        "cyan-glow":   "0 0 20px rgba(2, 132, 199, 0.2)",
        "cyan-glow-lg":"0 0 40px rgba(2, 132, 199, 0.25)",
        "gold-glow":   "0 0 20px rgba(217, 119, 6, 0.2)",
        "card":        "0 2px 8px rgba(0, 0, 0, 0.08)",
        "modal":       "0 4px 16px rgba(0, 0, 0, 0.12)",
      },

      // ── Animations ────────────────────────────────────────
      animation: {
        "fade-in":        "fadeIn 0.4s ease-out",
        "slide-up":       "slideUp 0.4s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "pulse-cyan":     "pulseCyan 2s ease-in-out infinite",
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
          "0%, 100%": { boxShadow: "0 0 10px rgba(2, 132, 199, 0.2)" },
          "50%":      { boxShadow: "0 0 30px rgba(2, 132, 199, 0.4)" },
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
