/**
 * Tokens de Diseño Oficiales — Autónomo 360
 * Paleta de colores, gradientes y sombras estandarizadas.
 */

export const colors = {
  primary: {
    DEFAULT: "#2563eb", // blue-600
    hover: "#1d4ed8",   // blue-700
    light: "#dbeafe",   // blue-100
    dark: "#1e3a8a",    // blue-900
  },
  success: {
    DEFAULT: "#10b981", // emerald-500
    hover: "#059669",   // emerald-600
    light: "#d1fae5",   // emerald-100
  },
  warning: {
    DEFAULT: "#f59e0b", // amber-500
    hover: "#d97706",   // amber-600
    light: "#fef3c7",   // amber-100
  },
  danger: {
    DEFAULT: "#ef4444", // red-500
    hover: "#dc2626",   // red-600
    light: "#fee2e2",   // red-100
  },
  neutral: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
  },
} as const;

export const gradients = {
  primary: "from-blue-600 to-blue-700",
  card: "from-white to-slate-50",
  success: "from-emerald-500 to-emerald-600",
  warning: "from-amber-500 to-orange-500",
  danger: "from-red-500 to-rose-600",
} as const;

export const shadows = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  colored: "0 10px 25px -5px rgba(37, 99, 235, 0.15), 0 8px 10px -6px rgba(37, 99, 235, 0.1)",
} as const;

export const designTokens = {
  colors,
  gradients,
  shadows,
};

export default designTokens;
