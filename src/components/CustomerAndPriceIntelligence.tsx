import React, { useState, useMemo } from "react";
import {
  Users,
  Award,
  TrendingUp,
  Tag,
  Building,
  DollarSign,
  Package,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  MapPin,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  AlertTriangle,
  CreditCard,
  Phone,
  Layers,
} from "lucide-react";
import type { Order, Store, Product } from "../types";
import { formatEGP, calculateDistanceKm } from "../utils/orderCalculations";
import { MINISTRIES_LIST } from "../data/seedData";
import { cairoDay } from "../utils/orderIntegration";

interface CustomerProfileSummary {
  profileId: string;
  name: string;
  phone: string;
  ministry: string;
  deliveredOrdersCount: number;
  totalSpent: number;
  avgOrderValue: number;
  preferredPayment: string;
  lastOrderDate: string;
  topOrderedStoreName?: string;
}

export function CustomerAndPriceIntelligence({
  orders,
  stores,
  products,
}: {
  orders: Order[];
  stores: Store[];
  products: Product[];
}) {
  const [activeTab, setActiveTab] = useState<"customers" | "price-audit" | "velocity" | "proximity">("customers");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMinistry, setSelectedMinistry] = useState<string>("all");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");

  // 1. Customer Intelligence calculations
  const customerAnalytics = useMemo(() => {
    const delivered = orders.filter((o) => o.orderStatus === "delivered");
    const customerMap = new Map<string, {
      name: string;
      phone: string;
      ministry: string;
      orders: Order[];
      lastDate: string;
    }>();

    delivered.forEach((o) => {
      const pId = o.profileId || o.phone || o.profileName;
      if (!pId) return;

      const existing = customerMap.get(pId);
      const dateStr = o.deliveredAt || o.createdAt || "";

      if (existing) {
        existing.orders.push(o);
        if (dateStr > existing.lastDate) {
          existing.lastDate = dateStr;
        }
      } else {
        customerMap.set(pId, {
          name: o.profileName || "عميل بدون اسم",
          phone: o.phone || "غير مسجل",
          ministry: o.ministry || "وزارة غير محددة",
          orders: [o],
          lastDate: dateStr,
        });
      }
    });

    const profiles: CustomerProfileSummary[] = [];

    customerMap.forEach((data, pId) => {
      const deliveredCount = data.orders.length;
      const totalSpent = data.orders.reduce((sum, o) => sum + o.total, 0);
      const avgOrderValue = deliveredCount > 0 ? totalSpent / deliveredCount : 0;

      // Find preferred payment
      const paymentCounts = new Map<string, number>();
      data.orders.forEach((o) => {
        const pm = o.paymentMethod || "cash";
        paymentCounts.set(pm, (paymentCounts.get(pm) || 0) + 1);
      });
      let preferredPayment = "نقداً";
      let maxCount = 0;
      paymentCounts.forEach((cnt, pm) => {
        if (cnt > maxCount) {
          maxCount = cnt;
          preferredPayment = pm === "cash" ? "نقداً (كاش)" : pm === "geidea" || pm === "card" ? "بطاقة دفع" : "إنستاباي";
        }
      });

      profiles.push({
        profileId: pId,
        name: data.name,
        phone: data.phone,
        ministry: data.ministry,
        deliveredOrdersCount: deliveredCount,
        totalSpent,
        avgOrderValue: Math.round(avgOrderValue),
        preferredPayment,
        lastOrderDate: data.lastDate ? new Date(data.lastDate).toLocaleDateString("ar-EG") : "اليوم",
      });
    });

    // Sort VIPs by total spend
    const topVips = [...profiles].sort((a, b) => b.totalSpent - a.totalSpent);

    // Ministry volume breakdown
    const ministryMap = new Map<string, { count: number; spend: number }>();
    delivered.forEach((o) => {
      const m = o.ministry || "أخرى";
      const ex = ministryMap.get(m) || { count: 0, spend: 0 };
      ministryMap.set(m, { count: ex.count + 1, spend: ex.spend + o.total });
    });

    const ministryRanking = Array.from(ministryMap.entries())
      .map(([ministry, data]) => ({
        ministry,
        count: data.count,
        spend: data.spend,
      }))
      .sort((a, b) => b.count - a.count);

    const totalCustomers = customerMap.size;
    const totalSpentAll = profiles.reduce((sum, p) => sum + p.totalSpent, 0);
    const overallAov = delivered.length > 0 ? Math.round(totalSpentAll / delivered.length) : 0;

    return {
      totalCustomers,
      totalSpentAll,
      overallAov,
      topVips,
      ministryRanking,
    };
  }, [orders]);

  // 2. Price changes and promotions audit
  const priceAuditData = useMemo(() => {
    const discountedProducts = products.filter(
      (p) => !p.archived && Boolean(p.originalPrice && p.originalPrice > p.price)
    );

    const changesList = discountedProducts.map((p) => {
      const orig = p.originalPrice || p.price;
      const curr = p.price;
      const diff = orig - curr;
      const percent = orig > 0 ? Math.round((diff / orig) * 100) : 0;

      return {
        id: p.id,
        name: p.name,
        storeName: p.storeName || stores.find((s) => s.id === p.storeId)?.name || "سنجوب إكسبريس",
        category: p.category,
        originalPrice: orig,
        currentPrice: curr,
        discountAmount: diff,
        discountPercent: percent,
        inStock: p.inStock,
      };
    }).sort((a, b) => b.discountPercent - a.discountPercent);

    const avgDiscountPercent =
      changesList.length > 0
        ? Math.round(changesList.reduce((sum, item) => sum + item.discountPercent, 0) / changesList.length)
        : 0;

    return {
      discountedProductsCount: discountedProducts.length,
      avgDiscountPercent,
      changesList,
    };
  }, [products, stores]);

  // 3. Stock velocity & fast-moving items
  const inventoryVelocity = useMemo(() => {
    const delivered = orders.filter((o) => o.orderStatus === "delivered");
    const productSoldMap = new Map<string, { count: number; revenue: number; name: string; storeName: string; price: number }>();

    delivered.forEach((o) => {
      o.items.forEach((item) => {
        const pId = item.product.id;
        const count = item.quantity;
        const rev = (item.product.price + item.extraPrice) * count;
        const ex = productSoldMap.get(pId);

        if (ex) {
          ex.count += count;
          ex.revenue += rev;
        } else {
          productSoldMap.set(pId, {
            count,
            revenue: rev,
            name: item.product.name,
            storeName: item.product.storeName,
            price: item.product.price,
          });
        }
      });
    });

    const fastMoving = Array.from(productSoldMap.entries())
      .map(([id, d]) => ({
        id,
        name: d.name,
        storeName: d.storeName,
        soldCount: d.count,
        totalRevenue: d.revenue,
        price: d.price,
      }))
      .sort((a, b) => b.soldCount - a.soldCount);

    const activeCount = products.filter((p) => !p.archived).length;
    const inStockCount = products.filter((p) => !p.archived && p.inStock).length;
    const outOfStockCount = activeCount - inStockCount;

    return {
      fastMoving: fastMoving.slice(0, 15),
      activeCount,
      inStockCount,
      outOfStockCount,
    };
  }, [orders, products]);

  // 4. Proximity matrix between Stores and Ministries
  const proximityMatrix = useMemo(() => {
    // Top ministries sample coordinates (New Administrative Capital Ministries District)
    const baseMinistries = [
      { name: "رئاسة مجلس الوزراء", lat: 30.0150, lng: 31.7350 },
      { name: "وزارة المالية", lat: 30.0135, lng: 31.7340 },
      { name: "وزارة النقل", lat: 30.0142, lng: 31.7365 },
      { name: "وزارة الإسكان والمرافق", lat: 30.0158, lng: 31.7335 },
      { name: "وزارة الخارجية", lat: 30.0165, lng: 31.7380 },
      { name: "وزارة الاتصالات", lat: 30.0125, lng: 31.7390 },
      { name: "وزارة العدل", lat: 30.0148, lng: 31.7345 },
    ];

    return stores.map((store) => {
      const sLat = store.coordinates?.latitude || 30.0131;
      const sLng = store.coordinates?.longitude || 31.7346;

      const ministryDistances = baseMinistries.map((m) => {
        const distKm = calculateDistanceKm(sLat, sLng, m.lat, m.lng);
        // Estimated delivery time: 5 mins preparation + 4 mins per km in government complex
        const estimatedMins = Math.round(5 + distKm * 4);
        return {
          ministryName: m.name,
          distanceKm: Number(distKm.toFixed(2)),
          estimatedMins,
        };
      }).sort((a, b) => a.distanceKm - b.distanceKm);

      return {
        storeId: store.id,
        storeName: store.name,
        category: store.category || "مطعم",
        distances: ministryDistances,
        closestMinistry: ministryDistances[0],
      };
    });
  }, [stores]);

  return (
    <section dir="rtl" className="customer-and-price-intelligence-section space-y-6" aria-label="تحليلات العملاء وحركة الأسعار">
      {/* Top Header */}
      <header className="bg-white p-5 rounded-3xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 m-0">تحليلات العملاء ومتابعة الأسعار والمخزون</h1>
            <p className="text-xs text-slate-500 m-0 mt-0.5">
              سجل كبار العملاء (VIP)، تاريخ تعديل الأسعار، دوران المخزون، ومصفوفة تغطية المتاجر للوزارات
            </p>
          </div>
        </div>

        {/* Top Summary Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-xs font-bold text-indigo-800">
            {customerAnalytics.totalCustomers} عميل نشط
          </div>
          <div className="px-3 py-1.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-xs font-bold text-emerald-800">
            متوسط الطلب: {formatEGP(customerAnalytics.overallAov)}
          </div>
        </div>
      </header>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي قاعدة العملاء المسجلين</span>
            <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Users size={17} />
            </span>
          </div>
          <strong className="text-2xl font-black text-indigo-900 block font-mono">
            {customerAnalytics.totalCustomers} عميل
          </strong>
          <p className="text-[11px] text-slate-400 m-0">من كافة وزارات وهيئات الحي الحكومي</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">متوسط قيمة السلة (AOV)</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <DollarSign size={17} />
            </span>
          </div>
          <strong className="text-2xl font-black text-emerald-800 block font-mono">
            {formatEGP(customerAnalytics.overallAov)}
          </strong>
          <p className="text-[11px] text-slate-400 m-0">متوسط الإنفاق لكل طلب مسلّم</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">أصناف عليها خصومات نشطة</span>
            <span className="w-8 h-8 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center">
              <Tag size={17} />
            </span>
          </div>
          <strong className="text-2xl font-black text-orange-800 block font-mono">
            {priceAuditData.discountedProductsCount} صنف
          </strong>
          <p className="text-[11px] text-slate-400 m-0">متوسط الخصم {priceAuditData.avgDiscountPercent}% للمستهلك</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">جاهزية وتوافر المخزون</span>
            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Package size={17} />
            </span>
          </div>
          <strong className="text-2xl font-black text-blue-800 block font-mono">
            {inventoryVelocity.inStockCount} / {inventoryVelocity.activeCount}
          </strong>
          <p className="text-[11px] text-slate-400 m-0">{inventoryVelocity.outOfStockCount} صنف غير متوفر حالياً</p>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 bg-slate-200/70 p-1.5 rounded-2xl">
        <button
          onClick={() => setActiveTab("customers")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all ${
            activeTab === "customers"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Award size={16} className={activeTab === "customers" ? "text-amber-500" : ""} />
          1. كبار العملاء (VIP) وتحليلات الوزارات
        </button>

        <button
          onClick={() => setActiveTab("price-audit")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all ${
            activeTab === "price-audit"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Tag size={16} className={activeTab === "price-audit" ? "text-orange-600" : ""} />
          2. سجل تعديل وحركة الأسعار (Price Audit)
        </button>

        <button
          onClick={() => setActiveTab("velocity")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all ${
            activeTab === "velocity"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Flame size={16} className={activeTab === "velocity" ? "text-red-500" : ""} />
          3. الأصناف الأسرع دوراناً (Fast-Moving)
        </button>

        <button
          onClick={() => setActiveTab("proximity")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all ${
            activeTab === "proximity"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Compass size={16} className={activeTab === "proximity" ? "text-blue-600" : ""} />
          4. مصفوفة قرب المتاجر من الوزارات
        </button>
      </div>

      {/* TAB 1: CUSTOMERS & VIP */}
      {activeTab === "customers" && (
        <div className="space-y-6">
          {/* Ministry Distribution Summary */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-sm font-black text-slate-900 m-0 flex items-center gap-2">
              <Building size={16} className="text-indigo-600" />
              الوزارات والهيئات الأكثر طلباً في الحي الحكومي
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {customerAnalytics.ministryRanking.slice(0, 6).map((m, idx) => (
                <div key={m.ministry} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 font-bold">#{idx + 1}</span>
                    <span className="font-bold text-slate-900 font-mono">{m.count} طلب</span>
                  </div>
                  <strong className="text-xs font-black text-slate-800 block truncate" title={m.ministry}>
                    {m.ministry}
                  </strong>
                  <span className="text-[10px] text-emerald-600 font-mono block font-bold">
                    {formatEGP(m.spend)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top VIP Customers Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 m-0 flex items-center gap-2">
                <Award size={16} className="text-amber-500" />
                قائمة كبار العملاء (Top VIP Customers) مرتبين بحجم الإنفاق
              </h2>
              <span className="text-xs text-slate-500 font-bold">
                {customerAnalytics.topVips.length} عميل في السجل
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-bold text-center">الرتبة</th>
                    <th className="py-3 px-4 font-bold">العميل والهاتف</th>
                    <th className="py-3 px-4 font-bold">الوزارة أو الهيئة</th>
                    <th className="py-3 px-4 font-bold text-center">الطلبات المسلّمة</th>
                    <th className="py-3 px-4 font-bold font-mono text-emerald-700">إجمالي المشتريات</th>
                    <th className="py-3 px-4 font-bold font-mono">متوسط الطلب (AOV)</th>
                    <th className="py-3 px-4 font-bold text-center">طريقة الدفع المفضلة</th>
                    <th className="py-3 px-4 font-bold text-center">آخر طلب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customerAnalytics.topVips.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        لا توجد بيانات عملاء مسجلة حالياً
                      </td>
                    </tr>
                  ) : (
                    customerAnalytics.topVips.map((c, idx) => (
                      <tr key={c.profileId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 text-center">
                          {idx === 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-black text-xs">
                              👑 VIP 1
                            </span>
                          ) : idx < 3 ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-black text-xs">
                              ⭐ VIP {idx + 1}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono font-bold">#{idx + 1}</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <strong className="text-slate-900 block font-bold text-sm">{c.name}</strong>
                          <span className="text-[10px] text-slate-400 font-mono">{c.phone}</span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-700 font-bold">
                          {c.ministry}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 font-bold font-mono">
                            {c.deliveredOrdersCount} طلب
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-black text-emerald-700 text-sm">
                          {formatEGP(c.totalSpent)}
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                          {formatEGP(c.avgOrderValue)}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {c.preferredPayment}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono text-slate-500 text-[11px]">
                          {c.lastOrderDate}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRICE AUDIT */}
      {activeTab === "price-audit" && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900 m-0 flex items-center gap-2">
                <Tag size={16} className="text-orange-500" />
                سجل وتاريخ تعديلات الأسعار والعروض الترويجية
              </h2>
              <p className="text-xs text-slate-400 m-0 mt-0.5">
                تتبع الفارق بين السعر السابق والسعر الحالي ونسب التخفيضات المقدمة للعملاء
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold">الصنف والتصنيف</th>
                  <th className="py-3 px-4 font-bold">المتجر التابع</th>
                  <th className="py-3 px-4 font-bold font-mono text-slate-400">السعر الأصلي</th>
                  <th className="py-3 px-4 font-bold font-mono text-emerald-700">السعر بعد التخفيض</th>
                  <th className="py-3 px-4 font-bold font-mono text-orange-600">قيمة التوفير</th>
                  <th className="py-3 px-4 font-bold text-center">نسبة التخفيض</th>
                  <th className="py-3 px-4 font-bold text-center">حالة الصنف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {priceAuditData.changesList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      لا توجد عروض أسعار مخفضة نشطة حالياً بالكتالوج
                    </td>
                  </tr>
                ) : (
                  priceAuditData.changesList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <strong className="text-slate-900 block font-bold text-sm">{item.name}</strong>
                        <span className="text-[10px] text-slate-400">{item.category}</span>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-700">
                        {item.storeName}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-400 line-through">
                        {formatEGP(item.originalPrice)}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-black text-emerald-700 text-sm">
                        {formatEGP(item.currentPrice)}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-orange-600">
                        -{formatEGP(item.discountAmount)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 font-bold font-mono text-[11px]">
                          {item.discountPercent}% خصم
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.inStock
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}>
                          {item.inStock ? "متوفر للطلب" : "غير متوفر"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: VELOCITY */}
      {activeTab === "velocity" && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900 m-0 flex items-center gap-2">
                <Flame size={16} className="text-red-500" />
                الأصناف الأكثر دوراناً ومبيعاً (Fast-Moving Items)
              </h2>
              <p className="text-xs text-slate-400 m-0 mt-0.5">
                توجيه المشتريات وسلاسل الإمداد وإعادة الطلب لمخزن سنجوب إكسبريس والمتاجر
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold text-center">الترتيب</th>
                  <th className="py-3 px-4 font-bold">اسم المنتج</th>
                  <th className="py-3 px-4 font-bold">المتجر</th>
                  <th className="py-3 px-4 font-bold font-mono">سعر الوحدة</th>
                  <th className="py-3 px-4 font-bold text-center">الكميات المباعة</th>
                  <th className="py-3 px-4 font-bold font-mono text-emerald-700">إجمالي المبيعات</th>
                  <th className="py-3 px-4 font-bold text-center">حالة الدوران</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventoryVelocity.fastMoving.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      لا توجد مبيعات مسجلة بعد للأصناف
                    </td>
                  </tr>
                ) : (
                  inventoryVelocity.fastMoving.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-400">
                        #{idx + 1}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                        {item.name}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {item.storeName}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {formatEGP(item.price)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 font-bold font-mono text-[11px] border border-red-100">
                          🔥 {item.soldCount} وحدة
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-black text-emerald-700 text-sm">
                        {formatEGP(item.totalRevenue)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                          سريع الدوران
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PROXIMITY MATRIX */}
      {activeTab === "proximity" && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900 m-0 flex items-center gap-2">
                <Compass size={16} className="text-blue-600" />
                مصفوفة القرب الجغرافي وتغطية مقرات الوزارات
              </h2>
              <p className="text-xs text-slate-400 m-0 mt-0.5">
                قياس المسافة وزمن التوصيل التقديري بين كل متجر ومقرات الوزارات في الحي الحكومي
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {proximityMatrix.map((store) => (
              <div key={store.storeId} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <strong className="text-sm font-black text-slate-900">{store.storeName}</strong>
                  <span className="text-[10px] text-slate-500 font-bold">{store.category}</span>
                </div>

                <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-100 text-xs">
                  <span className="text-blue-800 font-bold block mb-0.5">أقرب مقر حكومي:</span>
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-blue-900 font-black">{store.closestMinistry.ministryName}</span>
                    <span className="text-blue-700 font-bold">{store.closestMinistry.distanceKm} كم ({store.closestMinistry.estimatedMins} دقيقة)</span>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <span className="text-[10px] text-slate-400 font-bold block">نطاقات باقي الوزارات:</span>
                  {store.distances.slice(1, 4).map((dist) => (
                    <div key={dist.ministryName} className="flex items-center justify-between text-slate-600 font-mono text-[11px]">
                      <span className="truncate">{dist.ministryName}</span>
                      <span>{dist.distanceKm} كم • {dist.estimatedMins} د</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

