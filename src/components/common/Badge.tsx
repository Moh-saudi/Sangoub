import React from "react";

export type BadgeVariant =
  | "active"
  | "success"
  | "suspended"
  | "danger"
  | "pending"
  | "warning"
  | "info"
  | "neutral";

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  active: "bg-emerald-50 text-emerald-800 border-emerald-200",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  suspended: "bg-rose-50 text-rose-800 border-rose-200",
  danger: "bg-rose-50 text-rose-800 border-rose-200 font-bold",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  info: "bg-sky-50 text-sky-800 border-sky-200",
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
};

export function Badge({
  variant = "neutral",
  size = "md",
  children,
  icon,
  className = "",
}: BadgeProps) {
  const sizeClass = size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium border font-body whitespace-nowrap shadow-2xs ${variantClasses[variant]} ${sizeClass} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
