import React from "react";
import { type LucideIcon } from "lucide-react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "blue" | "green" | "amber" | "red" | "gray" | "purple" | "cyan";
  color?: "blue" | "green" | "amber" | "red" | "gray" | "purple" | "cyan";
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  size?: "sm" | "md";
  dot?: boolean;
}

const variantStyles: Record<string, string> = {
  blue: "bg-blue-100 text-blue-800 border-blue-200/80",
  green: "bg-emerald-100 text-emerald-800 border-emerald-200/80",
  amber: "bg-amber-100 text-amber-800 border-amber-200/80",
  red: "bg-red-100 text-red-800 border-red-200/80",
  gray: "bg-slate-100 text-slate-700 border-slate-200/80",
  purple: "bg-purple-100 text-purple-800 border-purple-200/80",
  cyan: "bg-cyan-100 text-cyan-800 border-cyan-200/80",
};

const dotStyles: Record<string, string> = {
  blue: "bg-blue-600",
  green: "bg-emerald-600",
  amber: "bg-amber-600",
  red: "bg-red-600",
  gray: "bg-slate-500",
  purple: "bg-purple-600",
  cyan: "bg-cyan-600",
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  className = "",
  variant,
  color,
  icon: Icon,
  size = "md",
  dot = false,
  ...props
}) => {
  const activeKey = variant || color || "gray";
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${variantStyles[activeKey] || variantStyles.gray} ${sizeClasses} ${className}`}
      {...props}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[activeKey] || dotStyles.gray}`} />}
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
};

export default Badge;
