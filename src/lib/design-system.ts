/**
 * Sistema de Diseño Centralizado — Autónomo 360
 * Tokens de color, gradientes, sombras, tipografía y radios.
 */

export const colors = {
  primary: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb", // Azul Eléctrico Principal
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
    950: "#172554",
  },
  success: {
    50: "#f0fdf4",
    100: "#dcfce7",
    500: "#22c55e",
    600: "#16a34a",
    700: "#15803d",
  },
  accent: {
    50: "#fffbeb",
    100: "#fef3c7",
    400: "#fbbf24",
    500: "#f59e0b", // Ámbar Energía
    600: "#d97706",
  },
  danger: {
    50: "#fef2f2",
    100: "#fee2e2",
    500: "#ef4444", // Rojo Alerta
    600: "#dc2626",
    700: "#b91c1c",
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
    950: "#020617",
  },
} as const;

export const gradients = {
  hero: "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-800",
  card: "bg-gradient-to-br from-white to-slate-50",
  primaryGlow: "bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent",
  successGlow: "bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-transparent",
  accentGlow: "bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent",
  darkSidebar: "bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950",
} as const;

export const shadows = {
  card: "shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]",
  cardHover: "shadow-[0_10px_30px_-6px_rgba(37,99,235,0.12)]",
  glowBlue: "shadow-[0_0_20px_rgba(37,99,235,0.25)]",
  glowEmerald: "shadow-[0_0_20px_rgba(16,185,129,0.25)]",
  glowAmber: "shadow-[0_0_20px_rgba(245,158,11,0.25)]",
} as const;

export const radius = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-xl",
  xl: "rounded-2xl",
  full: "rounded-full",
} as const;
