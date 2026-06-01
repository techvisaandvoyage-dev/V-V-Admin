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
        background: "#ffffff",     // Pure white background
        surface:    "#ffffff",     // White card surfaces
        "surface-2":"#f4f9ff",     // Very light blue for subtle backgrounds
        "surface-3":"#e6f0fa",     // Light blue for hover states

        // Primary accent — Royal Blue (Dark & Light theme)
        cyan: {
          light:   "#dbeafe", // Soft light blue for backgrounds
          DEFAULT: "#0252D5", // Royal blue
          dim:     "#013b9e", // Darker blue for active/hover
          glow:    "rgba(2, 82, 213, 0.15)",
          border:  "rgba(2, 82, 213, 0.3)",
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

        // Text hierarchy - High Contrast
        text: {
          primary:   "#000000",   // Pure black for maximum readability
          secondary: "#334155",   // Dark slate for secondary text
          muted:     "#64748b",   // Medium slate for disabled/muted (better contrast)
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
        "cyan-glow":   "0 0 20px rgba(2, 82, 213, 0.2)",
        "cyan-glow-lg":"0 0 40px rgba(2, 82, 213, 0.25)",
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
          "0%, 100%": { boxShadow: "0 0 10px rgba(2, 82, 213, 0.2)" },
          "50%":      { boxShadow: "0 0 30px rgba(2, 82, 213, 0.4)" },
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
