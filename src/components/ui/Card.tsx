import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "gradient" | "success" | "warning" | "interactive";
  padding?: "none" | "sm" | "md" | "lg";
}

const variantStyles: Record<NonNullable<CardProps["variant"]>, string> = {
  default: "bg-white border border-slate-200/80 shadow-sm",
  gradient: "bg-gradient-to-br from-white via-slate-50 to-blue-50/30 border border-blue-100/80 shadow-sm",
  success: "bg-gradient-to-br from-emerald-50/50 to-white border border-emerald-200/80 shadow-sm",
  warning: "bg-gradient-to-br from-amber-50/50 to-white border border-amber-200/80 shadow-sm",
  interactive: "bg-white border border-slate-200/80 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300 cursor-pointer",
};

const paddingStyles: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  variant = "default",
  padding = "md",
  ...props
}) => {
  return (
    <div
      className={`rounded-xl transition-all duration-200 ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
