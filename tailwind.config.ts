import type { Config } from "tailwindcss";

/**
 * PrivateSocial — Design tokens expostos ao Tailwind.
 * Valores reais vivem em globals.css (CSS variables) para permitir
 * futuras variações de paleta (amber/rose) e modo claro via data-* attrs.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          0: "var(--bg-0)",
          1: "var(--bg-1)",
          2: "var(--bg-2)",
          3: "var(--bg-3)",
          card: "var(--bg-card)",
          "card-elevated": "var(--bg-card-elevated)",
        },
        gold: {
          50: "var(--gold-50)",
          100: "var(--gold-100)",
          300: "var(--gold-300)",
          400: "var(--gold-400)",
          500: "var(--gold-500)",
          600: "var(--gold-600)",
          700: "var(--gold-700)",
        },
        rose: {
          400: "var(--rose-400)",
          500: "var(--rose-500)",
        },
        ink: {
          0: "var(--text-0)",
          1: "var(--text-1)",
          2: "var(--text-2)",
          3: "var(--text-3)",
        },
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-strong)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-ui)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        "glow-gold":
          "0 0 40px rgba(212, 175, 110, 0.35), 0 0 80px rgba(212, 175, 110, 0.15)",
      },
      backgroundImage: {
        "shine-gold":
          "linear-gradient(135deg, #f5e6c8 0%, #e4c89a 40%, #c9a775 70%, #e4c89a 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
