import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: "blue" | "green" | "amber" | "red" | "purple" | "cyan" | "gray";
  size?: "sm" | "md";
  dot?: boolean;
}

const colorStyles: Record<NonNullable<BadgeProps["color"]>, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-200/80",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  amber: "bg-amber-50 text-amber-700 border-amber-200/80",
  red: "bg-red-50 text-red-700 border-red-200/80",
  purple: "bg-purple-50 text-purple-700 border-purple-200/80",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200/80",
  gray: "bg-slate-100 text-slate-700 border-slate-200/80",
};

const dotColors: Record<NonNullable<BadgeProps["color"]>, string> = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  purple: "bg-purple-500",
  cyan: "bg-cyan-500",
  gray: "bg-slate-400",
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  className = "",
  color = "gray",
  size = "md",
  dot = false,
  ...props
}) => {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${colorStyles[color]} ${sizeClasses} ${className}`}
      {...props}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColors[color]}`} />}
      {children}
    </span>
  );
};
