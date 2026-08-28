import React from "react";
import { type LucideIcon } from "lucide-react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  variant?: "default" | "gradient" | "success" | "warning";
  padding?: "none" | "sm" | "md" | "lg";
}

const variantStyles: Record<NonNullable<CardProps["variant"]>, string> = {
  default: "bg-white border border-slate-200/80 shadow-sm hover:shadow-md",
  gradient: "bg-gradient-to-br from-white via-slate-50 to-blue-50/40 border border-blue-200/80 shadow-sm hover:shadow-md hover:border-blue-300",
  success: "bg-gradient-to-br from-white to-emerald-50/50 border border-emerald-200/80 shadow-sm hover:shadow-md hover:border-emerald-300",
  warning: "bg-gradient-to-br from-white to-amber-50/50 border border-amber-200/80 shadow-sm hover:shadow-md hover:border-amber-300",
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
      className={`rounded-xl transition-all duration-300 animate-fade-in ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {(title || Icon) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          {title && <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">{title}</h3>}
          {Icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100/80 text-slate-700 shadow-xs">
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;
