import React from "react";
import { ChevronLeft } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  href?: string;
}

export interface PageHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  breadcrumbs = [{ label: "الرئيسية" }],
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-5 sm:mb-6 space-y-2 font-body" dir="rtl">
      {/* 1. مسار التصفح (Breadcrumbs) */}
      {breadcrumbs.length > 0 && (
        <nav aria-label="مسار التصفح" className="flex items-center gap-1.5 text-xs text-slate-500 font-body">
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <React.Fragment key={index}>
                {item.onClick && !isLast ? (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="hover:text-teal-700 transition-colors cursor-pointer font-body"
                  >
                    {item.label}
                  </button>
                ) : item.href && !isLast ? (
                  <a href={item.href} className="hover:text-teal-700 transition-colors font-body">
                    {item.label}
                  </a>
                ) : (
                  <span className={isLast ? "text-slate-800 font-medium font-body" : "font-body"}>
                    {item.label}
                  </span>
                )}
                {!isLast && <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* 2. العنوان وأزرار العمليات السريعة */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-heading text-slate-900 leading-tight truncate">
            {title}
          </h1>
          {description && (
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-body leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* أزرار العمليات والشارات */}
        {actions && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
