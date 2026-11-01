import { adminApi } from '../lib/adminApi';
import React, { useState, useMemo, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  Receipt,
  Store as StoreIcon,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Printer,
  ChevronDown,
  Building,
  CreditCard,
  Banknote,
  Search,
  Package,
  BookOpen,
  PieChart,
  Layers,
  Sparkles,
  ShoppingBag,
  Coins,
  ShieldCheck,
  FileSpreadsheet,
} from "lucide-react";
import type { Order, Store, Product } from "../types";
import { formatEGP } from "../utils/orderCalculations";
import { cairoDay } from "../utils/orderIntegration";

interface StoreSettlement {
  storeId: string;
  storeName: string;
  category: string;
  deliveredOrdersCount: number;
  grossSales: number;
  platformCommission: number;
  netPayout: number;
  commissionRate: number;
  payoutStatus: "pending" | "settled";
  taxRate?: number;
  taxRegistrationNumber?: string;
}

export function FinancialReports({
  orders,
  stores,
  products = [],
}: {
  orders: Order[];
  stores: Store[];
  products?: Product[];
}) {
  const [activePillar, setActivePillar] = useState<"settlements" | "hq-ledger" | "catalog-valuation">("settlements");
  const [datePeriod, setDatePeriod] = useState<"today" | "week" | "month" | "all">("today");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [ledger, setLedger] = useState<any[]>([]);
  const [financeError, setFinanceError] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null);

  async function loadLedger() {
    try {
      const result = await adminApi('data', { action: 'settlement-list' });
      setLedger(result?.records || []);
    } catch {
      setLedger([]);
    }
  }

  useEffect(() => {
    void loadLedger();
  }, []);

  const settledStores = useMemo(() => Object.fromEntries(
    stores.filter(store => {
      const ids = orders
        .filter(o => o.orderStatus === 'delivered' && o.items.some(i => i.product.storeId === store.id))
        .map(o => o.id);
      const paid = new Set(ledger.filter(r => r.storeId === store.id).flatMap(r => r.orderIds));
      return ids.length > 0 && ids.every(id => paid.has(id));
    }).map(store => {
      const record = ledger.find(r => r.storeId === store.id);
      return [
        store.id,
        {
          ref: record?.reference || '',
          date: record?.createdAt ? new Date(record.createdAt).toLocaleDateString('ar-EG') : ''
        }
      ];
    })
  ), [stores, orders, ledger]);

  // 1. Filter delivered orders based on period
  const deliveredOrders = useMemo(() => {
    const todayStr = cairoDay(new Date());
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    return orders.filter((o) => {
      if (o.orderStatus !== "delivered") return false;

      // Date filtering
      if (datePeriod === "today") {
        const orderDay = cairoDay(o.deliveredAt || o.createdAt || "");
        if (orderDay !== todayStr) return false;
      } else if (datePeriod === "week") {
        const orderTime = new Date(o.deliveredAt || o.createdAt || 0).getTime();
        if (orderTime < oneWeekAgo) return false;
      } else if (datePeriod === "month") {
        const orderTime = new Date(o.deliveredAt || o.createdAt || 0).getTime();
        if (orderTime < oneMonthAgo) return false;
      }

      // Payment filter
      if (paymentFilter !== "all" && o.paymentMethod !== paymentFilter) return false;

      // Store filter
      if (selectedStoreId !== "all") {
        const hasStoreItem = o.items.some((i) => i.product.storeId === selectedStoreId);
        if (!hasStoreItem) return false;
      }

      // Search term
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesOrder = String(o.orderNumber || "").includes(q);
        const matchesCustomer = (o.profileName || "").toLowerCase().includes(q);
        const matchesMinistry = (o.ministry || "").toLowerCase().includes(q);
        if (!matchesOrder && !matchesCustomer && !matchesMinistry) return false;
      }

      return true;
    });
  }, [orders, datePeriod, selectedStoreId, paymentFilter, searchQuery]);

  // 2. High-level financial totals
  const totalDeliveredOrders = deliveredOrders.length;
  const grossFoodSales = deliveredOrders.reduce((sum, o) => sum + (o.subtotal - (o.discount || 0)), 0);
  const totalDeliveryFees = deliveredOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
  const totalTips = deliveredOrders.reduce((sum, o) => sum + (o.tip || 0), 0);
  const totalGrossRevenue = deliveredOrders.reduce((sum, o) => sum + o.total, 0);

  // Platform commission total
  const platformCommissionTotal = deliveredOrders.reduce((sum, o) =>
    sum + o.items.reduce((total, i) => {
      const store = stores.find(s => s.id === i.product.storeId);
      const rate = store?.commissionRate || 0;
      return total + (i.product.price + i.extraPrice) * i.quantity * (rate / 100);
    }, 0),
    0
  );

  const netDueToRestaurants = grossFoodSales - platformCommissionTotal;

  // Total Sangoub Platform Net Operating Revenue (Commissions + Delivery Fees)
  const sangoubNetRevenue = platformCommissionTotal + totalDeliveryFees;

  // 3. Payment Channels breakdown
  const paymentBreakdown = useMemo(() => {
    let cash = 0;
    let card = 0;
    let wallet = 0;
    let instapay = 0;
    let vodafone = 0;

    deliveredOrders.forEach((o) => {
      const pm = String(o.paymentMethod);
      if (pm === 'cash') cash += o.total;
      else if (pm === 'geidea' || pm === 'card') card += o.total;
      else if (pm === 'instapay') instapay += o.total;
      else if (pm === 'wallet') wallet += o.total;
      else if (pm === 'vodafone_cash') vodafone += o.total;
      else cash += o.total;
    });

    return { cash, card, wallet, instapay, vodafone, digitalTotal: card + wallet + instapay + vodafone };
  }, [deliveredOrders]);

  // 4. Store-level settlement calculation
  const storeSettlements = useMemo<StoreSettlement[]>(() => {
    return stores.map<StoreSettlement>((store) => {
      let storeOrdersCount = 0;
      let storeGross = 0;

      deliveredOrders.forEach((o) => {
        const storeItems = o.items.filter((i) => i.product.storeId === store.id);
        if (storeItems.length > 0) {
          storeOrdersCount++;
          const itemsTotal = storeItems.reduce(
            (sum, item) => sum + (item.product.price + item.extraPrice) * item.quantity,
            0
          );
          storeGross += itemsTotal;
        }
      });

      const commission = storeGross * ((store.commissionRate || 0) / 100);
      const net = storeGross - commission;
      const isSettled = Boolean(settledStores[store.id]);

      return {
        storeId: store.id,
        storeName: store.name,
        category: store.category || "مطعم",
        deliveredOrdersCount: storeOrdersCount,
        grossSales: storeGross,
        platformCommission: commission,
        netPayout: net,
        commissionRate: store.commissionRate ?? 0,
        payoutStatus: isSettled ? "settled" : "pending",
        taxRate: store.taxRate,
        taxRegistrationNumber: store.taxRegistrationNumber,
      };
    }).filter((s) => s.deliveredOrdersCount > 0 || selectedStoreId === "all");
  }, [stores, deliveredOrders, settledStores, selectedStoreId]);

  // 5. Total Catalog Valuation Calculation
  const catalogValuation = useMemo(() => {
    const activeProducts = products.filter(p => !p.archived);
    const inStockProducts = activeProducts.filter(p => p.inStock);

    const totalValuation = inStockProducts.reduce((sum, p) => sum + (p.price || 0), 0);
    const totalAllValuation = activeProducts.reduce((sum, p) => sum + (p.price || 0), 0);

    // Identify Sangoub Central Mart / Express vs partner merchants
    const centralStore = stores.find(s => s.name.includes("سنقوب") || s.name.toLowerCase().includes("sangoub"));
    const centralStoreId = centralStore?.id;

    let centralValuation = 0;
    let centralCount = 0;
    let partnersValuation = 0;
    let partnersCount = 0;

    // Categories breakdown
    const categoryMap = new Map<string, { count: number; value: number }>();

    activeProducts.forEach(p => {
      const isCentral = centralStoreId ? p.storeId === centralStoreId : (p.storeName?.includes("سنقوب") || false);
      const price = p.price || 0;

      if (isCentral) {
        centralValuation += price;
        centralCount++;
      } else {
        partnersValuation += price;
        partnersCount++;
      }

      const cat = p.category || "أصناف عامة";
      const existing = categoryMap.get(cat) || { count: 0, value: 0 };
      categoryMap.set(cat, { count: existing.count + 1, value: existing.value + price });
    });

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      value: data.value,
      percentage: totalAllValuation > 0 ? (data.value / totalAllValuation) * 100 : 0
    })).sort((a, b) => b.value - a.value);

    // Store breakdown
    const storeBreakdown = stores.map(store => {
      const storeProds = activeProducts.filter(p => p.storeId === store.id);
      const storeInStock = storeProds.filter(p => p.inStock);
      const storeVal = storeProds.reduce((sum, p) => sum + (p.price || 0), 0);
      return {
        storeId: store.id,
        storeName: store.name,
        category: store.category || "عام",
        totalProducts: storeProds.length,
        inStockCount: storeInStock.length,
        valuation: storeVal,
      };
    }).filter(s => s.totalProducts > 0).sort((a, b) => b.valuation - a.valuation);

    return {
      totalProductsCount: activeProducts.length,
      inStockCount: inStockProducts.length,
      totalValuation,
      totalAllValuation,
      centralValuation,
      centralCount,
      partnersValuation,
      partnersCount,
      categoryBreakdown,
      storeBreakdown
    };
  }, [products, stores]);

  const handleSettleStore = async (storeId: string, _storeName: string) => {
    if (saving) return;
    setFinanceError('');
    setSaving(true);
    try {
      const paid = new Set(ledger.filter(r => r.storeId === storeId).flatMap(r => r.orderIds));
      const orderIds = deliveredOrders
        .filter(o => !paid.has(o.id) && o.items.some(i => i.product.storeId === storeId))
        .map(o => o.id);
      if (!orderIds.length) throw new Error('لا توجد طلبات جديدة للتسوية في الفترة المحددة.');
      const preview = await adminApi('data', { action: 'settlement-preview', storeId, orderIds });
      if (!confirm(`صافي التسوية ${formatEGP(preview.quote.net)}، العمولة ${formatEGP(preview.quote.commission)}. تُسجّل هذه العملية تحويلًا منفذًا خارج المنصة ولا تنفذ تحويلًا بنكيًا. هل تتابع؟`)) return;
      const reference = prompt('اكتب مرجع التحويل الفعلي:');
      if (!reference?.trim()) return;
      await adminApi('data', {
        action: 'settlement-save',
        id: crypto.randomUUID(),
        storeId,
        orderIds,
        quoteHash: preview.quoteHash,
        reference
      });
      await loadLedger();
    } catch (e) {
      setFinanceError(e instanceof Error ? e.message : 'تعذر تسجيل التسوية.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <section dir="rtl" className="financial-reports-section space-y-6" aria-label="التقارير المالية وفواتير المتاجر">
      {financeError && (
        <div role="alert" className="p-3 text-red-800 bg-red-50 rounded-xl flex items-center justify-between border border-red-200">
          <span>{financeError}</span>
          <button type="button" onClick={() => setFinanceError('')} className="text-xs text-red-600 hover:text-red-800 font-bold px-2 py-1 bg-red-100 rounded-lg">
            إغلاق ✕
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="bg-white p-5 rounded-3xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
              <DollarSign size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 m-0">الإدارة المالية ودفتر الأستاذ العام</h1>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                كشوف حسابات المتاجر، القيود المحاسبية المركزية، وتقييم القيمة السوقية للمخزون
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period Selector */}
          <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold">
            {(
              [
                ["today", "اليوم"],
                ["week", "آخر 7 أيام"],
                ["month", "هذا الشهر"],
                ["all", "كل الفترات"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setDatePeriod(key)}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  datePeriod === key
                    ? "bg-white text-slate-900 shadow-xs font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Printer size={15} />
            طباعة التقرير
          </button>
        </div>
      </header>

      {/* Sub-Navigation Tabs: The 3 Financial Pillars */}
      <div className="flex items-center gap-2 bg-slate-200/70 p-1.5 rounded-2xl">
        <button
          onClick={() => setActivePillar("settlements")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all ${
            activePillar === "settlements"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Building size={16} className={activePillar === "settlements" ? "text-amber-500" : ""} />
          1. كشوف حسابات وتسويات المتاجر
        </button>

        <button
          onClick={() => setActivePillar("hq-ledger")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all ${
            activePillar === "hq-ledger"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <BookOpen size={16} className={activePillar === "hq-ledger" ? "text-blue-600" : ""} />
          2. دفتر الأستاذ وقيد سنجوب المركزي
        </button>

        <button
          onClick={() => setActivePillar("catalog-valuation")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all ${
            activePillar === "catalog-valuation"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Layers size={16} className={activePillar === "catalog-valuation" ? "text-emerald-600" : ""} />
          3. تقييم القيمة السوقية للمخزون
        </button>
      </div>

      {/* PILLAR 1: MERCHANT SETTLEMENTS */}
      {activePillar === "settlements" && (
        <div className="space-y-6">
          {/* Primary KPI Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">إجمالي تحصيلات الطلبات</span>
                <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Receipt size={17} />
                </span>
              </div>
              <strong className="text-2xl font-black text-slate-900 block font-mono">
                {formatEGP(totalGrossRevenue)}
              </strong>
              <p className="text-[11px] text-slate-400 m-0">من {totalDeliveredOrders} طلب مسلّم</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">مبيعات الأصناف (الأغذية والبضائع)</span>
                <span className="w-8 h-8 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center">
                  <StoreIcon size={17} />
                </span>
              </div>
              <strong className="text-2xl font-black text-slate-900 block font-mono">
                {formatEGP(grossFoodSales)}
              </strong>
              <p className="text-[11px] text-slate-400 m-0">مستحقات المتاجر + عمولة المنصة</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">عمولات المنصة المستحقة</span>
                <span className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <TrendingUp size={17} />
                </span>
              </div>
              <strong className="text-2xl font-black text-purple-700 block font-mono">
                {formatEGP(platformCommissionTotal)}
              </strong>
              <p className="text-[11px] text-slate-400 m-0">بناءً على نسب التعاقد المعتمدة</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">صافي مستحقات المتاجر (Net Payable)</span>
                <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <DollarSign size={17} />
                </span>
              </div>
              <strong className="text-2xl font-black text-blue-700 block font-mono">
                {formatEGP(netDueToRestaurants)}
              </strong>
              <p className="text-[11px] text-slate-400 m-0">جاهز للتسوية والتحويل للشركاء</p>
            </div>
          </div>

          {/* Filtering Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative w-full">
                <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث برقم الطلب، اسم العميل، أو الوزارة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-4 pr-10 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-2xl text-xs font-bold text-slate-700">
                <Building size={14} className="text-slate-400" />
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="bg-transparent border-none outline-hidden cursor-pointer"
                >
                  <option value="all">كافة المتاجر ({stores.length})</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-2xl text-xs font-bold text-slate-700">
                <CreditCard size={14} className="text-slate-400" />
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="bg-transparent border-none outline-hidden cursor-pointer"
                >
                  <option value="all">كافة طرق الدفع</option>
                  <option value="cash">نقداً عند الاستلام</option>
                  <option value="wallet">محفظة سنجوب</option>
                  <option value="card">بطاقة إلكترونية</option>
                  <option value="instapay">إنستاباي</option>
                  <option value="vodafone_cash">فودافون كاش</option>
                </select>
              </div>
            </div>
          </div>

          {/* Settlements Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 m-0 flex items-center gap-2">
                <StoreIcon size={16} className="text-amber-500" />
                كشف حساب ومستحقات المتاجر الشريكة
              </h2>
              <span className="text-xs text-slate-500 font-bold">
                {storeSettlements.length} متجر مسجل
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-bold">المتجر والتصنيف</th>
                    <th className="py-3 px-4 font-bold text-center">الطلبات المسلّمة</th>
                    <th className="py-3 px-4 font-bold">إجمالي المبيعات</th>
                    <th className="py-3 px-4 font-bold">العمولة المتفق عليها</th>
                    <th className="py-3 px-4 font-bold text-blue-700">صافي المستحق للتاجر</th>
                    <th className="py-3 px-4 font-bold text-center">حالة التحويل</th>
                    <th className="py-3 px-4 font-bold text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {storeSettlements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        لا توجد مبيعات مسجلة لهذه الفترة
                      </td>
                    </tr>
                  ) : (
                    storeSettlements.map((settlement) => {
                      const settledInfo = settledStores[settlement.storeId];
                      const isExpanded = expandedStoreId === settlement.storeId;
                      const storeOrders = deliveredOrders.filter(o => o.items.some(i => i.product.storeId === settlement.storeId));

                      return (
                        <React.Fragment key={settlement.storeId}>
                          <tr className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-black text-slate-900 text-sm">{settlement.storeName}</div>
                              <span className="text-[10px] text-slate-400">{settlement.category}</span>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 font-bold font-mono">
                                {settlement.deliveredOrdersCount}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                              {formatEGP(settlement.grossSales)}
                            </td>

                            <td className="py-3.5 px-4 font-mono font-bold text-purple-700">
                              {formatEGP(settlement.platformCommission)}
                              <span className="text-[10px] text-slate-400 mr-1">({settlement.commissionRate}%)</span>
                            </td>

                            <td className="py-3.5 px-4 font-mono font-black text-blue-700 text-sm">
                              {formatEGP(settlement.netPayout)}
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              {settledInfo ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px] flex items-center gap-1">
                                    <CheckCircle2 size={12} />
                                    تم التحويل
                                  </span>
                                  <span className="text-[9px] text-slate-400 mt-0.5" title={settledInfo.ref}>
                                    مرجع: {settledInfo.ref}
                                  </span>
                                </div>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200 text-[10px] flex items-center gap-1">
                                  <Clock size={12} />
                                  معلق للتسوية
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setExpandedStoreId(isExpanded ? null : settlement.storeId)}
                                  className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors"
                                  title="عرض تفاصيل الطلبات"
                                >
                                  {isExpanded ? "إخفاء الطلبات" : `تفاصيل (${storeOrders.length})`}
                                </button>
                                <button
                                  disabled={saving || Boolean(settledInfo)}
                                  onClick={() => void handleSettleStore(settlement.storeId, settlement.storeName)}
                                  className={`px-3 py-1 rounded-xl font-bold text-[11px] transition-colors ${
                                    settledInfo
                                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                  }`}
                                >
                                  {settledInfo ? "تمت التسوية" : "تسجيل التحويل"}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Order List for Store */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="p-4 bg-slate-50 border-t border-b border-slate-200">
                                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-100 pb-2">
                                    <span>كشف طلبات {settlement.storeName} ({storeOrders.length} طلب)</span>
                                    <span className="text-slate-400 font-mono">صافي الحساب: {formatEGP(settlement.netPayout)}</span>
                                  </div>

                                  <div className="max-h-60 overflow-y-auto space-y-2">
                                    {storeOrders.map(o => {
                                      const storeItems = o.items.filter(i => i.product.storeId === settlement.storeId);
                                      const storeSubtotal = storeItems.reduce((acc, it) => acc + (it.product.price + it.extraPrice) * it.quantity, 0);

                                      return (
                                        <div key={o.id} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                          <div>
                                            <span className="font-bold text-slate-900 ml-2">#{o.orderNumber}</span>
                                            <span className="text-slate-500 font-normal ml-3">{o.profileName} ({o.ministry})</span>
                                            <span className="text-[10px] text-slate-400 font-mono">
                                              {storeItems.map(i => `${i.product.name} × ${i.quantity}`).join('، ')}
                                            </span>
                                          </div>
                                          <div className="text-left font-mono">
                                            <span className="font-bold text-slate-900">{formatEGP(storeSubtotal)}</span>
                                            <span className="text-[10px] text-slate-400 block">{o.paymentMethod === 'cash' ? 'كاش' : 'دفع إلكتروني'}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PILLAR 2: SANGOUB HQ CENTRAL LEDGER */}
      {activePillar === "hq-ledger" && (
        <div className="space-y-6">
          {/* HQ KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">صافي دخل منصة سنجوب</span>
                <span className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <Coins size={17} />
                </span>
              </div>
              <strong className="text-2xl font-black text-purple-800 block font-mono">
                {formatEGP(sangoubNetRevenue)}
              </strong>
              <p className="text-[11px] text-slate-400 m-0">العمولات المستحقة + رسوم التوصيل</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">إجمالي رسوم التوصيل المحصلة</span>
                <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <TrendingUp size={17} />
                </span>
              </div>
              <strong className="text-2xl font-black text-blue-700 block font-mono">
                {formatEGP(totalDeliveryFees)}
              </strong>
              <p className="text-[11px] text-slate-400 m-0">معدل {totalDeliveredOrders > 0 ? formatEGP(totalDeliveryFees / totalDeliveredOrders) : '0'} لكل طلب</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">إكراميات المناديب المحصلة</span>
                <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Receipt size={17} />
                </span>
              </div>
              <strong className="text-2xl font-black text-emerald-700 block font-mono">
                {formatEGP(totalTips)}
              </strong>
              <p className="text-[11px] text-slate-400 m-0">تُحول بالكامل لصالح المناديب</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">نسبة المدفوعات الرقمية</span>
                <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <CreditCard size={17} />
                </span>
              </div>
              <strong className="text-2xl font-black text-amber-800 block font-mono">
                {totalGrossRevenue > 0 ? `${((paymentBreakdown.digitalTotal / totalGrossRevenue) * 100).toFixed(1)}%` : '0%'}
              </strong>
              <p className="text-[11px] text-slate-400 m-0">محافظ وبطاقات وإنستاباي</p>
            </div>
          </div>

          {/* Payment Channels Matrix */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-slate-900 m-0 flex items-center gap-2">
              <CreditCard size={16} className="text-blue-600" />
              توزيع قنوات التدفق النقدي والتحصيل (Cashflow Channels)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] text-slate-500 font-bold block mb-1">نقداً عند الاستلام (كاش)</span>
                <span className="text-lg font-black text-slate-900 font-mono block">{formatEGP(paymentBreakdown.cash)}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {totalGrossRevenue > 0 ? `${((paymentBreakdown.cash / totalGrossRevenue) * 100).toFixed(0)}% من الإجمالي` : '0%'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100">
                <span className="text-[11px] text-blue-700 font-bold block mb-1">بطاقات الدفع الإلكتروني</span>
                <span className="text-lg font-black text-blue-900 font-mono block">{formatEGP(paymentBreakdown.card)}</span>
                <span className="text-[10px] text-blue-500 font-mono">بوابة الدفع البنكية</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100">
                <span className="text-[11px] text-purple-700 font-bold block mb-1">تحويلات إنستاباي (InstaPay)</span>
                <span className="text-lg font-black text-purple-900 font-mono block">{formatEGP(paymentBreakdown.instapay)}</span>
                <span className="text-[10px] text-purple-500 font-mono">إشعار تحويل لحظي</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-red-50/50 border border-red-100">
                <span className="text-[11px] text-red-700 font-bold block mb-1">فودافون كاش ومحافظ</span>
                <span className="text-lg font-black text-red-900 font-mono block">{formatEGP(paymentBreakdown.vodafone)}</span>
                <span className="text-[10px] text-red-500 font-mono">محافظ كاش الإلكترونية</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                <span className="text-[11px] text-emerald-700 font-bold block mb-1">محفظة سنجوب الرقمية</span>
                <span className="text-lg font-black text-emerald-900 font-mono block">{formatEGP(paymentBreakdown.wallet)}</span>
                <span className="text-[10px] text-emerald-500 font-mono">رصيد حساب العميل</span>
              </div>
            </div>
          </div>

          {/* Central Journal Entries (دفتر اليومية المجمعة) */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 m-0 flex items-center gap-2">
                <BookOpen size={16} className="text-blue-600" />
                سجل قيود دفتر الأستاذ العام (Sangoub General Ledger Journal)
              </h2>
              <span className="text-xs text-slate-500 font-bold">قيود محاسبية مزدوجة متوازنة</span>
            </div>

            <div className="p-4 space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 font-bold">رقم القيد والتاريخ</th>
                      <th className="py-2.5 px-4 font-bold">البيان والحساب المحاسبي</th>
                      <th className="py-2.5 px-4 font-bold font-mono text-emerald-700">مدين (Debit)</th>
                      <th className="py-2.5 px-4 font-bold font-mono text-purple-700">دائن (Credit)</th>
                      <th className="py-2.5 px-4 font-bold text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        GL-{cairoDay(new Date())}-01
                        <span className="block text-[10px] text-slate-400 font-normal">إجمالي إيرادات المبيعات المحصلة</span>
                      </td>
                      <td className="py-3 px-4">
                        <strong className="text-slate-900 block">حـ/ الصندوق وبوابات الدفع (إجمالي المقبوضات)</strong>
                        <span className="text-[10px] text-slate-400">إجمالي الفواتير المحصلة من عملاء الحي الحكومي</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-emerald-700">{formatEGP(totalGrossRevenue)}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">-</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">موزون</span>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        GL-{cairoDay(new Date())}-02
                        <span className="block text-[10px] text-slate-400 font-normal">مستحقات الشركاء والمتاجر</span>
                      </td>
                      <td className="py-3 px-4">
                        <strong className="text-slate-900 block">إلى حـ/ التزامات التجار الشركاء (Accounts Payable)</strong>
                        <span className="text-[10px] text-slate-400">صافي المستحقات المحتجزة للتحويل الدوري</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">-</td>
                      <td className="py-3 px-4 font-mono font-black text-purple-700">{formatEGP(netDueToRestaurants)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[10px]">مستحق</span>
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        GL-{cairoDay(new Date())}-03
                        <span className="block text-[10px] text-slate-400 font-normal">إيرادات عمولات ورسوم سنجوب</span>
                      </td>
                      <td className="py-3 px-4">
                        <strong className="text-slate-900 block">إلى حـ/ إيرادات تشغيل سنجوب (عمولات + رسوم توصيل)</strong>
                        <span className="text-[10px] text-slate-400">دخل الشركة التشغيلي الصافي قبل المصاريف</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">-</td>
                      <td className="py-3 px-4 font-mono font-black text-purple-700">{formatEGP(sangoubNetRevenue)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold text-[10px]">إيراد</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PILLAR 3: TOTAL CATALOG VALUATION */}
      {activePillar === "catalog-valuation" && (
        <div className="space-y-6">
          {/* Valuation KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">القيمة السوقية للبضائع المعروضة</span>
                <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Layers size={17} />
                </span>
              </div>
              <strong className="text-2xl font-black text-emerald-800 block font-mono">
                {formatEGP(catalogValuation.totalAllValuation)}
              </strong>
              <p className="text-[11px] text-slate-400 m-0">إجمالي قيمة {catalogValuation.totalProductsCount} صنف على التطبيق</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">بضائع متوفرة للطلب الفوري</span>
                <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Package size={17} />
                </span>
              </div>
              <strong className="text-2xl font-black text-blue-700 block font-mono">
                {formatEGP(catalogValuation.totalValuation)}
              </strong>
              <p className="text-[11px] text-slate-400 m-0">{catalogValuation.inStockCount} صنف متوفر في المخزون حالياً</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">حصة مخزن سنجوب المركزي</span>
                <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Sparkles size={17} />
                </span>
              </div>
              <strong className="text-2xl font-black text-amber-800 block font-mono">
                {formatEGP(catalogValuation.centralValuation)}
              </strong>
              <p className="text-[11px] text-slate-400 m-0">{catalogValuation.centralCount} صنف بمخزن سنجوب إكسبريس</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">حصة المتاجر والشركاء</span>
                <span className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <StoreIcon size={17} />
                </span>
              </div>
              <strong className="text-2xl font-black text-purple-800 block font-mono">
                {formatEGP(catalogValuation.partnersValuation)}
              </strong>
              <p className="text-[11px] text-slate-400 m-0">{catalogValuation.partnersCount} صنف بالمطاعم ومتاجر التجزئة</p>
            </div>
          </div>

          {/* Breakdown by Category */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-slate-900 m-0 flex items-center gap-2">
              <PieChart size={16} className="text-emerald-600" />
              توزيع القيمة السوقية حسب التصنيفات الرئيسية
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {catalogValuation.categoryBreakdown.slice(0, 8).map(cat => (
                <div key={cat.name} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-800 truncate">{cat.name}</span>
                    <span className="text-slate-400 font-mono">{cat.count} صنف</span>
                  </div>
                  <strong className="text-sm font-black text-slate-900 font-mono block">
                    {formatEGP(cat.value)}
                  </strong>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.max(5, cat.percentage))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Breakdown by Store Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 m-0 flex items-center gap-2">
                <StoreIcon size={16} className="text-amber-500" />
                القيمة السوقية للمخزون لكل متجر وشريك
              </h2>
              <span className="text-xs text-slate-500 font-bold">
                {catalogValuation.storeBreakdown.length} متجر مفعل بالكتالوج
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-bold">المتجر</th>
                    <th className="py-3 px-4 font-bold">النشاط</th>
                    <th className="py-3 px-4 font-bold text-center">إجمالي الأصناف</th>
                    <th className="py-3 px-4 font-bold text-center">المتوفر في المخزون</th>
                    <th className="py-3 px-4 font-bold font-mono">القيمة التقديرية للمخزون</th>
                    <th className="py-3 px-4 font-bold text-center">حالة التوافر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {catalogValuation.storeBreakdown.map((s) => {
                    const stockRatio = s.totalProducts > 0 ? (s.inStockCount / s.totalProducts) * 100 : 0;
                    return (
                      <tr key={s.storeId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {s.storeName}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {s.category}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                          {s.totalProducts}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-700">
                          {s.inStockCount}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-black text-slate-900 text-sm">
                          {formatEGP(s.valuation)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            stockRatio >= 80
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : stockRatio >= 40
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}>
                            {stockRatio.toFixed(0)}% متوفر
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
