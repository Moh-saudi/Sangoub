import React, { useState, useRef, useEffect } from "react";
import {
  Store as StoreIcon,
  X,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Image as ImageIcon,
  Save,
  Building2,
  MapPin,
  Truck,
  Percent,
  CreditCard,
  Sparkles,
} from "lucide-react";
import type { Store, StoreCategory } from "../types";
import { storeCategories } from "../utils/catalogManagement";
import { uploadCatalogImage, validateCatalogImage } from "../lib/catalogImages";
import { getMerchantPaymentSettings, type MerchantPaymentInfo } from "../utils/merchantPaymentSettings";

export interface StoreEditorModalProps {
  store?: Store | null;
  busy?: boolean;
  onClose: () => void;
  onSave: (payload: {
    id: string;
    name: string;
    nameEn: string;
    type: string;
    category: StoreCategory;
    status: "open" | "closed" | "busy";
    address: string;
    minOrder: number;
    deliveryFee: number;
    deliveryTime: string;
    commissionRate?: number;
    taxRate: number;
    taxRegistrationNumber: string;
    pricesIncludeTax: boolean;
    bannerUrl: string;
    logoUrl: string;
    paymentSettings: MerchantPaymentInfo;
  }) => Promise<void>;
}

export function StoreEditorModal({
  store,
  busy = false,
  onClose,
  onSave,
}: StoreEditorModalProps) {
  // 1. Basic Information State
  const [name, setName] = useState(store?.name || "");
  const [nameEn, setNameEn] = useState(store?.nameEn || "");
  const [type, setType] = useState(store?.type || "سوبرماركت ومستلزمات البيت اليومية");
  const [category, setCategory] = useState<StoreCategory>(store?.category || "supermarket");
  const [status, setStatus] = useState<"open" | "closed" | "busy">(store?.status || "open");

  // 2. Location
  const [address, setAddress] = useState(store?.locationInDistrict || "");

  // 3. Delivery & Ordering Settings
  const [minOrder, setMinOrder] = useState<number>(store?.minOrder ?? 20);
  const [deliveryFee, setDeliveryFee] = useState<number>(store?.deliveryFee ?? 10);
  const [deliveryTime, setDeliveryTime] = useState(store?.deliveryTime || "15-25 دقيقة");

  // 4. Commission & Taxes
  const [commissionRate, setCommissionRate] = useState<string>(
    store?.commissionRate !== undefined && store?.commissionRate !== null ? String(store.commissionRate) : ""
  );
  const [taxRate, setTaxRate] = useState<number>(store?.taxRate ?? 0);
  const [taxRegistrationNumber, setTaxRegistrationNumber] = useState(store?.taxRegistrationNumber || "");
  const [pricesIncludeTax, setPricesIncludeTax] = useState<boolean>(store?.pricesIncludeTax !== false);

  // 5. Visual Identity (Images)
  const initialBanner = store?.bannerUrl || store?.banner || store?.imageUrl || "";
  const initialLogo = store?.logoUrl || (typeof store?.logo === "string" && store.logo.length > 4 ? store.logo : "") || "";
  const [bannerUrl, setBannerUrl] = useState(initialBanner);
  const [logoUrl, setLogoUrl] = useState(initialLogo);

  // Upload States & Notices
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [bannerNotice, setBannerNotice] = useState("");
  const [logoNotice, setLogoNotice] = useState("");
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // 6. Payment Settings (InstaPay & Vodafone Cash)
  const [paymentSettings, setPaymentSettings] = useState<MerchantPaymentInfo>(() =>
    getMerchantPaymentSettings(store?.id)
  );

  // General States
  const [errorMsg, setErrorMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy && !isSaving) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, isSaving, onClose]);

  // Unified Image Upload Handler
  async function handleImageUpload(field: "banner" | "logo", file: File) {
    try {
      validateCatalogImage(file);
      setErrorMsg("");

      if (field === "banner") {
        setIsUploadingBanner(true);
        setBannerNotice("");
      } else {
        setIsUploadingLogo(true);
        setLogoNotice("");
      }

      // Generate entity identifier for unified storage path
      const entityId = (store?.id || "store-" + Date.now()) + (field === "logo" ? "-logo" : "-banner");
      const res = await uploadCatalogImage("stores", entityId, file);

      if (res?.url) {
        if (field === "banner") {
          setBannerUrl(res.url);
          setBannerNotice("🎉 تم رفع واستبدال صورة الغلاف بنجاح!");
        } else {
          setLogoUrl(res.url);
          setLogoNotice("🎉 تم رفع واستبدال شعار المتجر بنجاح!");
        }
      }
    } catch (err: any) {
      console.error("Store image upload error:", err);
      setErrorMsg(err?.message || "تعذر رفع الصورة. تحقق من الاتصال وحجم الملف.");
    } finally {
      if (field === "banner") setIsUploadingBanner(false);
      else setIsUploadingLogo(false);
    }
  }

  // Submit Handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();

    if (!trimmedName) {
      setErrorMsg("يرجى إدخال اسم المتجر.");
      return;
    }
    if (!trimmedAddress) {
      setErrorMsg("يرجى إدخال عنوان المتجر داخل الحي.");
      return;
    }

    if (minOrder < 0 || minOrder > 100000) {
      setErrorMsg("الحد الأدنى للطلب يجب أن يكون بين 0 و 100,000 ج.م.");
      return;
    }
    if (deliveryFee < 0 || deliveryFee > 1000) {
      setErrorMsg("رسوم التوصيل يجب أن تكون بين 0 و 1,000 ج.م.");
      return;
    }

    let parsedComm: number | undefined = undefined;
    if (commissionRate.trim() !== "") {
      parsedComm = Number(commissionRate);
      if (!Number.isFinite(parsedComm) || parsedComm < 0 || parsedComm > 100) {
        setErrorMsg("نسبة التعاقد يجب أن تكون رقمًا بين 0 و 100 %.");
        return;
      }
    }

    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      setErrorMsg("نسبة الضريبة يجب أن تكون بين 0 و 100 %.");
      return;
    }

    if (taxRate > 0 && !taxRegistrationNumber.trim()) {
      setErrorMsg("يرجى إدخال رقم التسجيل الضريبي عند تحديد نسبة ضريبة أكبر من صفر.");
      return;
    }

    setIsSaving(true);
    try {
      const storeId = store?.id || crypto.randomUUID();
      await onSave({
        id: storeId,
        name: trimmedName,
        nameEn: nameEn.trim() || trimmedName,
        type: type.trim(),
        category,
        status,
        address: trimmedAddress,
        minOrder,
        deliveryFee,
        deliveryTime: deliveryTime.trim() || "15-25 دقيقة",
        commissionRate: parsedComm,
        taxRate,
        taxRegistrationNumber: taxRegistrationNumber.trim(),
        pricesIncludeTax,
        bannerUrl: bannerUrl.trim(),
        logoUrl: logoUrl.trim(),
        paymentSettings: {
          instapayHandle: paymentSettings.instapayHandle?.trim() || "sangoub@instapay",
          walletPhone: paymentSettings.walletPhone?.trim() || "01099887766",
          instapayLink: paymentSettings.instapayLink?.trim() || "https://ipn.eg/",
        },
      });
      onClose();
    } catch (err: any) {
      console.error("Save store error:", err);
      setErrorMsg(err?.message || "حدث خطأ أثناء حفظ بيانات المتجر.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <header className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
              <StoreIcon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {store ? `تعديل متجر: ${store.name}` : "إضافة متجر جديد"}
              </h2>
              <p className="text-xs text-slate-500">
                إدارة تفاصيل المتجر، الموقع، نسب التعاقد والضرائب، والهوية البصرية الموحدة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy || isSaving}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </header>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Basic Information */}
          <div className="p-4 sm:p-5 bg-slate-50/70 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-800">
              <Building2 size={17} className="text-orange-600" />
              <h3 className="text-sm font-black">البيانات الأساسية للمتجر</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم المتجر بالعربية <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: سنجوب ماركت المركزي"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الاسم بالإنجليزية (اختياري)
                </label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="e.g. Sangoub Central Market"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نوع النشاط <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="مثال: سوبرماركت وبقالة"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  التصنيف الرئيسي <span className="text-red-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as StoreCategory)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {storeCategories.map(([catId, label]) => (
                    <option key={catId} value={catId}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  حالة المتجر التشغيلية
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus("open")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      status === "open"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>مفتوح (يستقبل الطلبات)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus("busy")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      status === "busy"
                        ? "bg-amber-50 border-amber-500 text-amber-800 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>مشغول مؤقتاً</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus("closed")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      status === "closed"
                        ? "bg-slate-100 border-slate-400 text-slate-800 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    <span>مغلق</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Address & Location */}
          <div className="p-4 sm:p-5 bg-slate-50/70 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-800">
              <MapPin size={17} className="text-orange-600" />
              <h3 className="text-sm font-black">العنوان والموقع الجغرافي</h3>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                عنوان المتجر الفعلي داخل الحي <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="مثال: الحي الحكومي - مبنى سنترال سنجوب - أمام الميدان الرئيسي"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>
          </div>

          {/* Section 3: Delivery & Ordering Parameters */}
          <div className="p-4 sm:p-5 bg-slate-50/70 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-800">
              <Truck size={17} className="text-orange-600" />
              <h3 className="text-sm font-black">إعدادات الطلب والتوصيل</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الحد الأدنى للطلب (ج.م) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100000"
                  step="0.5"
                  value={minOrder}
                  onChange={(e) => setMinOrder(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رسوم التوصيل (ج.م) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  max="1000"
                  step="0.5"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  مدة التجهيز والتوصيل
                </label>
                <input
                  type="text"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  placeholder="مثال: 15-25 دقيقة"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Commission & Taxes */}
          <div className="p-4 sm:p-5 bg-slate-50/70 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-800">
              <Percent size={17} className="text-orange-600" />
              <h3 className="text-sm font-black">العمولة والضرائب الرسمية</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نسبة التعاقد المتفق عليها %
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  placeholder="تترك فارغة حتى التعاقد"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نسبة الضريبة المسجلة %
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  placeholder="الافتراضية: 0"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم التسجيل الضريبي
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={taxRegistrationNumber}
                  onChange={(e) => setTaxRegistrationNumber(e.target.value)}
                  placeholder="مطلوب في حال وجود ضريبة"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="md:col-span-3 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={pricesIncludeTax}
                    onChange={(e) => setPricesIncludeTax(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    أسعار منتجات هذا المتجر تشمل ضريبة القيمة المضافة بالفعل
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 mt-1">
                  إذا كانت غير مفعلة، سيتم احتساب الضريبة بشكل منفصل فوق أسعار المنتجات وقت إتمام الطلب والفاتورة.
                </p>
              </div>
            </div>
          </div>

          {/* Section 5: Visual Identity & Secure Image Upload (Unified & Instant Replacement) */}
          <div className="p-4 sm:p-5 bg-slate-50/70 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-slate-800">
              <div className="flex items-center gap-2">
                <ImageIcon size={17} className="text-orange-600" />
                <h3 className="text-sm font-black">الهوية البصرية وصور المتجر</h3>
              </div>
              <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                <Sparkles size={11} /> رفع موحد ومؤمن
              </span>
            </div>

            <p className="text-[11.5px] text-slate-600">
              قم برفع غلاف وشعار المتجر مباشرة من جهازك. يتم الرفع فوراً وحفظ الصورة تلقائياً في التخزين الموحد واستبدال الصورة القديمة دون إظهار أي روابط مكشوفة.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cover Banner Uploader */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">صورة غلاف المتجر (Banner)</label>
                  {bannerUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setBannerUrl("");
                        setBannerNotice("");
                      }}
                      className="text-[11px] text-red-600 hover:text-red-700 flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <Trash2 size={12} />
                      <span>إزالة الغلاف</span>
                    </button>
                  )}
                </div>

                {/* Banner Preview Box */}
                <div className="w-full h-32 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative flex items-center justify-center">
                  {bannerUrl ? (
                    <img
                      src={bannerUrl}
                      alt="غلاف المتجر"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "/brand/sangoub-market-logo.jpg";
                      }}
                    />
                  ) : (
                    <div className="text-center p-3 text-slate-400">
                      <ImageIcon size={28} className="mx-auto mb-1 opacity-50" />
                      <span className="text-[11px]">لا يوجد غلاف محدد للمتجر</span>
                    </div>
                  )}

                  {isUploadingBanner && (
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold gap-2">
                      <Loader2 size={18} className="animate-spin text-orange-500" />
                      <span>جاري رفع الغلاف وتحديثه...</span>
                    </div>
                  )}
                </div>

                {bannerNotice && (
                  <p className="text-[11px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>{bannerNotice}</span>
                  </p>
                )}

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={bannerInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload("banner", file);
                    e.target.value = "";
                  }}
                />

                <button
                  type="button"
                  disabled={isUploadingBanner || busy || isSaving}
                  onClick={() => bannerInputRef.current?.click()}
                  className="w-full py-2 px-3.5 bg-orange-600 hover:bg-orange-700 active:scale-98 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isUploadingBanner ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>جاري الرفع...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>{bannerUrl ? "استبدال صورة الغلاف من جهازك" : "رفع صورة غلاف من جهازك"}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Store Logo Uploader */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">شعار المتجر (Logo)</label>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoUrl("");
                        setLogoNotice("");
                      }}
                      className="text-[11px] text-red-600 hover:text-red-700 flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <Trash2 size={12} />
                      <span>إزالة الشعار</span>
                    </button>
                  )}
                </div>

                {/* Logo Preview Box */}
                <div className="w-full h-32 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative flex items-center justify-center p-2">
                  {logoUrl ? (
                    <div className="w-24 h-24 rounded-2xl bg-white border border-slate-200 p-1 shadow-xs overflow-hidden flex items-center justify-center">
                      <img
                        src={logoUrl}
                        alt="شعار المتجر"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = "/brand/sangoub-mark-white-128.png";
                        }}
                      />
                    </div>
                  ) : (
                    <div className="text-center p-3 text-slate-400">
                      <StoreIcon size={28} className="mx-auto mb-1 opacity-50" />
                      <span className="text-[11px]">لا يوجد شعار محدد</span>
                    </div>
                  )}

                  {isUploadingLogo && (
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold gap-2">
                      <Loader2 size={18} className="animate-spin text-orange-500" />
                      <span>جاري رفع الشعار وتحديثه...</span>
                    </div>
                  )}
                </div>

                {logoNotice && (
                  <p className="text-[11px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>{logoNotice}</span>
                  </p>
                )}

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={logoInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload("logo", file);
                    e.target.value = "";
                  }}
                />

                <button
                  type="button"
                  disabled={isUploadingLogo || busy || isSaving}
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full py-2 px-3.5 bg-orange-600 hover:bg-orange-700 active:scale-98 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isUploadingLogo ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>جاري الرفع...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>{logoUrl ? "استبدال شعار المتجر من جهازك" : "رفع شعار من جهازك"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Section 6: Payment Settings (InstaPay & Vodafone Cash) */}
          <div className="p-4 sm:p-5 bg-orange-50/70 rounded-2xl border-2 border-orange-200 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-orange-200 text-slate-800">
              <CreditCard size={17} className="text-orange-600" />
              <h3 className="text-sm font-black">بيانات تحصيل إنستاباي والمحافظ الإلكترونية</h3>
            </div>

            <p className="text-[11.5px] text-slate-600">
              تظهر هذه البيانات للعميل عند اختيار إنستاباي للدفع لطلب هذا التاجر، وتُدار بالكامل من لوحة التحكم ديناميكياً دون أي كود ثابت.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  معرّف أو عنوان إنستاباي (InstaPay Handle)
                </label>
                <input
                  type="text"
                  value={paymentSettings.instapayHandle}
                  onChange={(e) =>
                    setPaymentSettings((prev) => ({ ...prev, instapayHandle: e.target.value }))
                  }
                  placeholder="مثال: sangoub@instapay"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم محفظة فودافون كاش / كاش فون
                </label>
                <input
                  type="tel"
                  value={paymentSettings.walletPhone}
                  onChange={(e) =>
                    setPaymentSettings((prev) => ({ ...prev, walletPhone: e.target.value }))
                  }
                  placeholder="مثال: 01099887766"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رابط دفع إنستاباي المباشر (Link / URL) — اختياري
                </label>
                <input
                  type="url"
                  value={paymentSettings.instapayLink}
                  onChange={(e) =>
                    setPaymentSettings((prev) => ({ ...prev, instapayLink: e.target.value }))
                  }
                  placeholder="https://ipn.eg/..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-2 flex items-center justify-end gap-3 sticky bottom-0 bg-white/95 backdrop-blur-xs py-3 border-t border-slate-200">
            <button
              type="button"
              disabled={busy || isSaving}
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={busy || isSaving || isUploadingBanner || isUploadingLogo}
              className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>جاري حفظ التعديلات...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>{store ? "حفظ تعديلات المتجر" : "إضافة المتجر إلى الكتالوج"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

