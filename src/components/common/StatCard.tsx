import React from "react";

export interface StatCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  iconBg?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  iconBg = "bg-teal-50 border border-teal-100 text-teal-600",
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex items-center justify-between gap-3 sm:gap-4 font-body ${className}`}
      dir="rtl"
    >
      <div className="space-y-1 min-w-0">
        <span className="text-xs font-semibold text-slate-500 block font-body truncate">
          {title}
        </span>
        <span className="text-xl sm:text-2xl font-bold font-heading text-slate-900 font-mono block">
          {value}
        </span>
        {subtitle && (
          <div className="text-[11px] text-slate-500 font-medium block font-body truncate">
            {subtitle}
          </div>
        )}
      </div>

      {icon && (
        <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
      )}
    </div>
  );
}

