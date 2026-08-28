import React from "react";
import { type LucideIcon } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success" | "accent";
  size?: "sm" | "md" | "lg";
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  loading?: boolean;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-blue-800 active:scale-[0.98] focus:ring-blue-500 border border-blue-500/30",
  secondary: "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98] focus:ring-slate-400",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200 focus:ring-slate-300",
  danger: "bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-md shadow-red-500/20 hover:from-red-700 hover:to-rose-800 active:scale-[0.98] focus:ring-red-500 border border-red-500/30",
  success: "bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-800 active:scale-[0.98] focus:ring-emerald-500 border border-emerald-500/30",
  accent: "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-orange-700 active:scale-[0.98] focus:ring-amber-400 border border-amber-500/30",
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
      className={`inline-flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none select-none cursor-pointer ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
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
