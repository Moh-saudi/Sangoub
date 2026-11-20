import React, { useEffect, useState, useMemo, useRef, type FormEvent } from "react";
import {
  Plus,
  TicketPercent,
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Calendar,
  Store as StoreIcon,
  Layers,
  Percent,
  Power,
  Pencil,
  Trash2,
  Loader2,
  Sparkles,
  BarChart3
} from "lucide-react";
import type { Coupon, Order, Store } from "../types";
import { operationsApi } from "../lib/operationsApi";
import { formatEGP } from "../utils/orderCalculations";
import { matchStoreId } from "../utils/storeAssets";

export interface CouponManagerProps {
  coupons?: Coupon[];
  orders?: Order[];
  stores?: Store[];
}

export function CouponManager({
  coupons: initialCoupons = [],
  orders = [],
  stores = []
}: CouponManagerProps) {
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons);
  const [isLoading, setIsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "platform" | "store">("all");

  // Edit / Create Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // Form Fields State
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDiscountType, setFormDiscountType] = useState<"fixed" | "percent">("percent");
  const [formValue, setFormValue] = useState<number>(10);
  const [formMaxDiscount, setFormMaxDiscount] = useState<number | "">("");
  const [formMinOrder, setFormMinOrder] = useState<number>(0);
  const [formScope, setFormScope] = useState<"all" | "store">("all");
  const [formStoreId, setFormStoreId] = useState<string>("");
  const [formMaxUses, setFormMaxUses] = useState<number | "">("");
  const [formStartDate, setFormStartDate] = useState<string>("");
  const [formEndDate, setFormEndDate] = useState<string>("");
  const [formActive, setFormActive] = useState(true);

  // Load coupons from unified backend
  const loadCoupons = async () => {
    setIsLoading(true);
    try {
      const res = await operationsApi("app-content", { action: "get-coupons" });
      if (res && Array.isArray(res.coupons)) {
        setCoupons(res.coupons);
      } else if (initialCoupons.length > 0) {
        setCoupons(initialCoupons);
      }
    } catch (err: any) {
      console.warn("Coupon load notice:", err);
      if (initialCoupons.length > 0) setCoupons(initialCoupons);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  // Compute live per-coupon reporting from orders
  const couponStatsMap = useMemo(() => {
    const stats: Record<
      string,
      {
        timesUsed: number;
        totalDiscount: number;
        totalSales: number;
        lastUsedAt: string | null;
      }
    > = {};

    orders.forEach((o) => {
      const code = (o.couponCode || (o as any).coupon_code || "").trim().toUpperCase();
      if (!code) return;

      if (!stats[code]) {
        stats[code] = {
          timesUsed: 0,
          totalDiscount: 0,
          totalSales: 0,
          lastUsedAt: null,
        };
      }

      stats[code].timesUsed += 1;
      stats[code].totalDiscount += Number(o.discount) || 0;
      stats[code].totalSales += Number(o.total) || 0;

      const orderTime = o.createdAt || (o as any).created_at || (o as any).timestamp;
      if (orderTime) {
        if (!stats[code].lastUsedAt || new Date(orderTime) > new Date(stats[code].lastUsedAt!)) {
          stats[code].lastUsedAt = orderTime;
        }
      }
    });

    return stats;
  }, [orders]);

  // Overall platform coupon metrics
  const platformMetrics = useMemo(() => {
    const totalCoupons = coupons.length;
    const activeCoupons = coupons.filter((c) => c.active !== false).length;

    let totalUses = 0;
    let totalDiscountAmount = 0;
    let totalRevenueFromCoupons = 0;

    Object.values(couponStatsMap).forEach((st) => {
      totalUses += st.timesUsed;
      totalDiscountAmount += st.totalDiscount;
      totalRevenueFromCoupons += st.totalSales;
    });

    return {
      totalCoupons,
      activeCoupons,
      totalUses,
      totalDiscountAmount,
      totalRevenueFromCoupons,
    };
  }, [coupons, couponStatsMap]);

  // Filtered coupons list
  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      if (statusFilter === "active" && c.active === false) return false;
      if (statusFilter === "inactive" && c.active !== false) return false;

      if (scopeFilter === "platform" && c.scope === "store") return false;
      if (scopeFilter === "store" && c.scope !== "store") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = c.code.toLowerCase().includes(q);
        const matchDesc = (c.description || "").toLowerCase().includes(q);
        const matchStore = (c.storeName || "").toLowerCase().includes(q);
        return matchCode || matchDesc || matchStore;
      }

      return true;
    });
  }, [coupons, statusFilter, scopeFilter, searchQuery]);

  // Open modal for new coupon
  const handleOpenCreate = () => {
    setEditingCoupon(null);
    setFormCode("");
    setFormDescription("");
    setFormDiscountType("percent");
    setFormValue(15);
    setFormMaxDiscount(50);
    setFormMinOrder(100);
    setFormScope("all");
    setFormStoreId("");
    setFormMaxUses("");
    setFormStartDate(new Date().toISOString().split("T")[0]);
    setFormEndDate("");
    setFormActive(true);
    setError("");
    setIsDialogOpen(true);
  };

  // Open modal for editing
  const handleOpenEdit = (c: Coupon) => {
    setEditingCoupon(c);
    setFormCode(c.code);
    setFormDescription(c.description || "");
    setFormDiscountType(c.discountType || "fixed");
    setFormValue(Number(c.value) || 0);
    setFormMaxDiscount(c.maxDiscount !== undefined ? Number(c.maxDiscount) : "");
    setFormMinOrder(Number(c.minOrder) || 0);
    setFormScope(c.scope || "all");
    setFormStoreId(c.storeId || "");
    setFormMaxUses(c.maxUses !== undefined ? Number(c.maxUses) : "");
    setFormStartDate(c.startsAt ? c.startsAt.split("T")[0] : "");
    setFormEndDate(c.expiresAt ? c.expiresAt.split("T")[0] : "");
    setFormActive(c.active !== false);
    setError("");
    setIsDialogOpen(true);
  };

  // Toggle active status directly from table
  const handleToggleActive = async (c: Coupon) => {
    setBusy(true);
    try {
      const res = await operationsApi("app-content", {
        action: "toggle-coupon",
        code: c.code,
      });
      if (res && Array.isArray(res.coupons)) {
        setCoupons(res.coupons);
      } else {
        setCoupons((prev) =>
          prev.map((item) =>
            item.code === c.code ? { ...item, active: !item.active } : item
          )
        );
      }
      setNotice(`تم ${c.active !== false ? "تعطيل" : "تفعيل"} كود ${c.code} بنجاح.`);
      setTimeout(() => setNotice(""), 4000);
    } catch (err: any) {
      setError(err.message || "تعذر تغيير حالة الكود.");
    } finally {
      setBusy(false);
    }
  };

  // Delete coupon
  const handleDelete = async (c: Coupon) => {
    if (!window.confirm(`هل أنت متأكد من حذف كود الخصم "${c.code}"؟ لن تتأثر الطلبات السابقة.`)) return;
    setBusy(true);
    try {
      const res = await operationsApi("app-content", {
        action: "delete-coupon",
        code: c.code,
      });
      if (res && Array.isArray(res.coupons)) {
        setCoupons(res.coupons);
      } else {
        setCoupons((prev) => prev.filter((item) => item.code !== c.code));
      }
      setNotice(`تم حذف كود الخصم ${c.code}.`);
      setTimeout(() => setNotice(""), 4000);
    } catch (err: any) {
      setError(err.message || "تعذر حذف كود الخصم.");
    } finally {
      setBusy(false);
    }
  };

  // Copy code to clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Save (Create or Update)
  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const cleanCode = formCode.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,30}$/.test(cleanCode)) {
      setError("كود الخصم يجب أن يتكون من 2 إلى 30 حرفاً إنجليزياً أو رقماً بدون مسافات (مثال: SANGOUB20).");
      return;
    }

    if (!editingCoupon && coupons.some((c) => c.code === cleanCode)) {
      setError("كود الخصم هذا موجود بالفعل؛ يمكنك تعديله مباشرة.");
      return;
    }

    if (!formValue || formValue <= 0) {
      setError("يرجى إدخال قيمة خصم صحيحة أكبر من صفر.");
      return;
    }

    if (formDiscountType === "percent" && (formValue > 100 || formValue < 1)) {
      setError("نسبة الخصم المئوية يجب أن تكون بين 1% و 100%.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const storeObj = formStoreId ? stores.find((s) => matchStoreId(s.id, formStoreId) || s.id === formStoreId) : undefined;

      const couponPayload: Coupon = {
        code: cleanCode,
        title: cleanCode,
        description: formDescription.trim() || `خصم ${formDiscountType === "percent" ? `${formValue}%` : `${formValue} ج.م`}`,
        discountType: formDiscountType,
        value: Number(formValue),
        minOrder: Number(formMinOrder) || 0,
        maxDiscount: formMaxDiscount !== "" && Number(formMaxDiscount) > 0 ? Number(formMaxDiscount) : undefined,
        scope: formScope,
        storeId: formScope === "store" ? formStoreId : undefined,
        storeName: formScope === "store" ? (storeObj?.name || undefined) : undefined,
        active: formActive,
        maxUses: formMaxUses !== "" && Number(formMaxUses) > 0 ? Number(formMaxUses) : undefined,
        startsAt: formStartDate ? new Date(formStartDate).toISOString() : undefined,
        expiresAt: formEndDate ? new Date(formEndDate).toISOString() : undefined,
      };

      const res = await operationsApi("app-content", {
        action: "save-coupon",
        coupon: couponPayload,
      });

      if (res && Array.isArray(res.coupons)) {
        setCoupons(res.coupons);
      } else {
        setCoupons((prev) => {
          const idx = prev.findIndex((item) => item.code === cleanCode);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = couponPayload;
            return next;
          }
          return [couponPayload, ...prev];
        });
      }

      setIsDialogOpen(false);
      setNotice(`تم حفظ كود الخصم "${cleanCode}" بنجاح.`);
      setTimeout(() => setNotice(""), 5000);
    } catch (err: any) {
      setError(err.message || "تعذر حفظ كود الخصم في قاعدة البيانات.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-['Cairo',sans-serif]" dir="rtl">
      {/* Page Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-black">
              <TicketPercent size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">أكواد الخصم والتقارير</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                إنشاء وتعديل أكواد الخصم للمنصة أو المتاجر مع تقارير وإحصائيات الاستخدام الحية
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-xs transition-all cursor-pointer bg-[#FF5900] hover:bg-[#E04E00] active:scale-95"
        >
          <Plus size={16} />
          <span>إضافة كود خصم جديد</span>
        </button>
      </div>

      {/* Notifications / Alerts */}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center justify-between animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice("")} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">✕</button>
        </div>
      )}

      {error && !isDialogOpen && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl flex items-center justify-between animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError("")} className="text-rose-600 hover:text-rose-900 cursor-pointer">✕</button>
        </div>
      )}

      {/* Live Reporting & Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Active Coupons */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500">الأكواد الفعّالة</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              {platformMetrics.activeCoupons}{" "}
              <span className="text-xs font-bold text-slate-400 font-normal">/ {platformMetrics.totalCoupons}</span>
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <TicketPercent size={20} />
          </div>
        </div>

        {/* Card 2: Times Used */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500">إجمالي مرات الاستخدام</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              {platformMetrics.totalUses} <span className="text-xs font-bold text-slate-400 font-normal">طلب</span>
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShoppingBag size={20} />
          </div>
        </div>

        {/* Card 3: Total Discount Given */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500">إجمالي الخصومات الممنوحة</p>
            <h3 className="text-xl sm:text-2xl font-black text-rose-600 mt-1">
              {formatEGP(platformMetrics.totalDiscountAmount)}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <DollarSign size={20} />
          </div>
        </div>

        {/* Card 4: Sales Generated via Coupons */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500">مبيعات الطلبات بالكوبون</p>
            <h3 className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
              {formatEGP(platformMetrics.totalRevenueFromCoupons)}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالكود، الوصف، أو المتجر…"
              className="w-full pr-10 pl-9 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-xs sm:text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">جميع الحالات</option>
              <option value="active">الأكواد النشطة فقط</option>
              <option value="inactive">المتوقفة فقط</option>
            </select>

            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">كافة النطاقات</option>
              <option value="platform">أكواد المنصة العامة</option>
              <option value="store">أكواد المتاجر الخاصة</option>
            </select>
          </div>
        </div>
      </div>

      {/* Coupons Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 size={32} className="animate-spin text-orange-500" />
            <span className="text-xs font-bold">جارٍ تحميل أكواد الخصم…</span>
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <TicketPercent size={28} />
            </div>
            <h3 className="font-bold text-slate-800 text-base">لا توجد أكواد مطابقة</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              اضغط على زر "إضافة كود خصم جديد" بالأعلى لإنشاء أول كود خصم للعملاء.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-black text-slate-500 uppercase">
                  <th className="py-3 px-4">الكود / النطاق</th>
                  <th className="py-3 px-4">قيمة الخصم</th>
                  <th className="py-3 px-4">الحد الأدنى</th>
                  <th className="py-3 px-4">تقرير الاستخدام</th>
                  <th className="py-3 px-4">إجمالي التوفير</th>
                  <th className="py-3 px-4">حجم المبيعات</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredCoupons.map((c) => {
                  const stats = couponStatsMap[c.code] || {
                    timesUsed: 0,
                    totalDiscount: 0,
                    totalSales: 0,
                    lastUsedAt: null,
                  };
                  const isStoreScoped = c.scope === "store" && c.storeId;
                  const storeObj = isStoreScoped
                    ? stores.find((s) => matchStoreId(s.id, c.storeId) || s.id === c.storeId)
                    : undefined;

                  return (
                    <tr key={c.code} className="hover:bg-slate-50/50 transition-colors">
                      {/* Code & Scope */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyCode(c.code)}
                            className="font-mono font-black text-slate-900 bg-slate-100 hover:bg-orange-50 hover:text-orange-600 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                            title="اضغط لنسخ الكود"
                            dir="ltr"
                          >
                            <span>{c.code}</span>
                            {copiedCode === c.code ? <Check size={12} className="text-emerald-600" /> : <Copy size={11} />}
                          </button>
                          {isStoreScoped ? (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <StoreIcon size={10} />
                              <span>{storeObj?.name || c.storeName || "متجر محدد"}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              عام للمنصة
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-normal mt-1 line-clamp-1 max-w-xs" title={c.description}>
                          {c.description || "بدون وصف إضافي"}
                        </p>
                      </td>

                      {/* Discount Value */}
                      <td className="py-3.5 px-4 font-bold">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-black text-slate-900">
                            {c.discountType === "percent" ? `${c.value}%` : formatEGP(c.value)}
                          </span>
                          {c.discountType === "percent" && c.maxDiscount && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              (أقصاه {c.maxDiscount} ج.م)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Min Order */}
                      <td className="py-3.5 px-4 font-semibold text-slate-600">
                        {c.minOrder > 0 ? formatEGP(c.minOrder) : "بدون حد أدنى"}
                      </td>

                      {/* Usage Count Report */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 font-black text-slate-800 text-xs">
                            {stats.timesUsed}
                          </span>
                          <span className="text-[11px] text-slate-400">طلب</span>
                        </div>
                        {stats.lastUsedAt && (
                          <span className="text-[9.5px] text-slate-400 block mt-0.5">
                            آخر طلب: {new Date(stats.lastUsedAt).toLocaleDateString("ar-EG")}
                          </span>
                        )}
                      </td>

                      {/* Total Discounts Given */}
                      <td className="py-3.5 px-4 font-black text-rose-600">
                        {stats.totalDiscount > 0 ? formatEGP(stats.totalDiscount) : "0 ج.م"}
                      </td>

                      {/* Revenue Generated */}
                      <td className="py-3.5 px-4 font-black text-emerald-700">
                        {stats.totalSales > 0 ? formatEGP(stats.totalSales) : "0 ج.م"}
                      </td>

                      {/* Active Status & Fast Toggle */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleToggleActive(c)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                            c.active !== false
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                          }`}
                          title="اضغط للتفعيل أو الإيقاف الفوري"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${c.active !== false ? "bg-emerald-500" : "bg-slate-400"}`} />
                          <span>{c.active !== false ? "نشط" : "متوقف"}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleOpenEdit(c)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-orange-600 hover:bg-orange-50 transition cursor-pointer"
                            title="تعديل الكود"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleDelete(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="حذف الكود"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog Modal */}
      {isDialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 font-cairo"
          dir="rtl"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <header className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  <TicketPercent size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">
                    {editingCoupon ? `تعديل كود الخصم "${editingCoupon.code}"` : "إضافة كود خصم جديد"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    حدد قيمة الخصم وشروطه ومتجره بدقة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </header>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Code */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  كود الخصم (Promo Code) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  maxLength={30}
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="مثال: SANGOUB20 أو WELCOME50"
                  readOnly={Boolean(editingCoupon)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono font-bold text-sm outline-none transition uppercase ${
                    editingCoupon ? "bg-slate-100 text-slate-600" : "bg-slate-50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  }`}
                />
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  حروف إنجليزية كبيرة وأرقام فقط، بدون مسافات.
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  وصف الخصم (يظهر للعميل) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="مثال: خصم 20% على أول طلب لك من سنجوب"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 font-medium outline-none transition"
                />
              </div>

              {/* Discount Type and Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    نوع الخصم <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formDiscountType}
                    onChange={(e) => setFormDiscountType(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold outline-none cursor-pointer"
                  >
                    <option value="percent">نسبة مئوية (%)</option>
                    <option value="fixed">قيمة ثابتة بالجنيه (EGP)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    قيمة الخصم {formDiscountType === "percent" ? "(%)" : "(ج.م)"} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={formDiscountType === "percent" ? 100 : 10000}
                    step={1}
                    value={formValue}
                    onChange={(e) => setFormValue(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-black outline-none"
                  />
                </div>
              </div>

              {/* Max Discount (Cap for percent) & Min Order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    الحد الأقصى للخصم (ج.م)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={formMaxDiscount}
                    onChange={(e) => setFormMaxDiscount(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="اختياري (مثال: 50)"
                    disabled={formDiscountType === "fixed"}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none disabled:opacity-50"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">للخصم المئوي فقط</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    الحد الأدنى للطلب (ج.م)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={formMinOrder}
                    onChange={(e) => setFormMinOrder(Number(e.target.value))}
                    placeholder="0 = بدون حد أدنى"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none"
                  />
                </div>
              </div>

              {/* Scope (Platform vs Store) */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
                <span className="block font-bold text-slate-800">
                  نطاق تطبيق الكوبون (Scope)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="radio"
                      name="scope"
                      checked={formScope === "all"}
                      onChange={() => setFormScope("all")}
                      className="accent-orange-600"
                    />
                    <span>عام لكافة المتاجر</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="radio"
                      name="scope"
                      checked={formScope === "store"}
                      onChange={() => setFormScope("store")}
                      className="accent-orange-600"
                    />
                    <span>مخصص لمتجر معين</span>
                  </label>
                </div>

                {formScope === "store" && (
                  <div className="pt-2 animate-fade-in">
                    <label className="block font-bold text-slate-700 mb-1">
                      اختر المتجر المخصص <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formStoreId}
                      onChange={(e) => setFormStoreId(e.target.value)}
                      required={formScope === "store"}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="">-- اختر المتجر --</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.type || "متجر"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Start Date, End Date, Max Uses */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ البدء</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ الانتهاء</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">أقصى استخدام</label>
                  <input
                    type="number"
                    min={1}
                    value={formMaxUses}
                    onChange={(e) => setFormMaxUses(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="غير محدود"
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium text-xs outline-none"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div>
                  <span className="font-bold text-slate-800 block text-xs">تفعيل الكود فور الحفظ</span>
                  <p className="text-[10px] text-slate-400">إذا تم إيقافه لن يتمكن العملاء من استخدامه في السلة</p>
                </div>
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="w-5 h-5 accent-orange-600 rounded cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 py-2.5 bg-[#FF5900] hover:bg-[#E04E00] text-white rounded-xl font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  <span>{editingCoupon ? "تحديث وحفظ الكود" : "إنشاء كود الخصم"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
