import React from "react";
import { type LucideIcon } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success" | "accent";
  size?: "sm" | "md" | "lg";
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  loading?: boolean;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-gradient-to-r from-[#f5d48a] via-[#d9b35f] to-[#c79d46] text-slate-950 shadow-[0_16px_30px_rgba(217,179,95,0.28)] hover:brightness-110 active:scale-[0.98] focus:ring-[#f5d48a] border border-[#d9b35f]/60",
  secondary: "border border-slate-700 bg-slate-900/90 text-slate-100 shadow-sm hover:bg-slate-800 hover:border-slate-600 active:scale-[0.98] focus:ring-slate-500",
  ghost: "bg-transparent text-slate-300 hover:bg-slate-800 hover:text-slate-100 active:bg-slate-700 focus:ring-slate-500",
  danger: "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-[0_16px_30px_rgba(239,68,68,0.25)] hover:brightness-110 active:scale-[0.98] focus:ring-red-500 border border-red-400/50",
  success: "bg-gradient-to-r from-emerald-400 to-emerald-500 text-slate-950 shadow-[0_16px_30px_rgba(16,185,129,0.25)] hover:brightness-110 active:scale-[0.98] focus:ring-emerald-400 border border-emerald-300/60",
  accent: "bg-gradient-to-r from-[#6aa7ff] to-[#3d7ae6] text-white shadow-[0_16px_30px_rgba(61,122,230,0.25)] hover:brightness-110 active:scale-[0.98] focus:ring-blue-400 border border-blue-400/60",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5 min-h-[36px]",
  md: "px-4 py-2.5 text-sm font-semibold rounded-xl gap-2 min-h-[44px]",
  lg: "px-5 py-3 text-base font-semibold rounded-xl gap-2.5 min-h-[48px]",
};

export const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  disabled,
  ...props
}) => {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none select-none cursor-pointer ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Cargando...
        </>
      ) : (
        <>
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          {children}
        </>
      )}
    </button>
  );
};

export default Button;
