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
  blue: "bg-blue-500/10 text-blue-200 border-blue-400/30",
  green: "bg-emerald-500/10 text-emerald-200 border-emerald-400/30",
  amber: "bg-amber-500/10 text-amber-200 border-amber-400/30",
  red: "bg-red-500/10 text-red-200 border-red-400/30",
  gray: "bg-slate-700/80 text-slate-200 border-slate-600/80",
  purple: "bg-purple-500/10 text-purple-200 border-purple-400/30",
  cyan: "bg-cyan-500/10 text-cyan-200 border-cyan-400/30",
};

const dotStyles: Record<string, string> = {
  blue: "bg-blue-400",
  green: "bg-emerald-400",
  amber: "bg-amber-400",
  red: "bg-red-400",
  gray: "bg-slate-400",
  purple: "bg-purple-400",
  cyan: "bg-cyan-400",
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
