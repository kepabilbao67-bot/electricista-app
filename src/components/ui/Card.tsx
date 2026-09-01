import React from "react";
import { type LucideIcon } from "lucide-react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  variant?: "default" | "gradient" | "success" | "warning";
  padding?: "none" | "sm" | "md" | "lg";
}

const variantStyles: Record<NonNullable<CardProps["variant"]>, string> = {
  default: "bg-slate-900/80 border border-slate-700/80 shadow-[0_18px_40px_rgba(2,6,23,0.3)]",
  gradient: "bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-[#d9b35f]/20 shadow-[0_18px_40px_rgba(2,6,23,0.35)]",
  success: "bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-900 border border-emerald-400/20 shadow-[0_18px_40px_rgba(2,6,23,0.3)]",
  warning: "bg-gradient-to-br from-amber-950/10 via-slate-900 to-slate-900 border border-amber-400/20 shadow-[0_18px_40px_rgba(2,6,23,0.3)]",
};

const paddingStyles: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-5 md:p-6",
  lg: "p-6 md:p-8",
};

export const Card: React.FC<CardProps> = ({
  title,
  icon: Icon,
  children,
  className = "",
  variant = "default",
  padding = "md",
  ...props
}) => {
  return (
    <div
      className={`rounded-2xl transition-all duration-300 animate-fade-in ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {(title || Icon) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{title}</h3>}
          {Icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 text-[#f5d48a] shadow-sm">
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;
