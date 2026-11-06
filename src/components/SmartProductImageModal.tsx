import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Check,
  Loader2,
  Image as ImageIcon,
  Search,
  Link2,
  ExternalLink,
  Upload,
  Database,
  Globe,
} from 'lucide-react';
import type { Product } from '../types';
import { searchImagesForProduct, type ImageCandidate } from '../utils/productImageFinder';

interface SmartProductImageModalProps {
  product: Product | null;
  onClose: () => void;
  onSelectImage: (productId: string, imageUrl: string) => Promise<void>;
}

export function SmartProductImageModal({
  product,
  onClose,
  onSelectImage,
}: SmartProductImageModalProps) {
  const [candidates, setCandidates] = useState<ImageCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!product) return;
    setSearchTerm(product.name);
    performSearch(product.name);
  }, [product?.id, product?.name]);

  async function performSearch(query: string) {
    if (!query.trim()) return;
    setLoading(true);
    setUploadError('');
    try {
      const results = await searchImagesForProduct(query.trim());
      setCandidates(results);
    } catch (err) {
      console.warn('Failed searching images:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!product) return null;

  async function handleApply(url: string) {
    if (!url || !product) return;
    setSavingUrl(url);
    try {
      await onSelectImage(product.id, url);
      onClose();
    } catch (err) {
      console.error('Failed applying image:', err);
    } finally {
      setSavingUrl(null);
    }
  }

  // معالجة رفع صورة محلية من جهاز المستخدم (مباشرة بعد حفظها من جوجل أو المعرض)
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('يرجى اختيار ملف صورة صالح (JPG, PNG, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('حجم الصورة كبير جداً (الحد الأقصى 5 ميجابايت)');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        await handleApply(dataUrl);
      }
    };
    reader.onerror = () => {
      setUploadError('تعذر قراءة ملف الصورة، يرجى المحاولة مرة أخرى.');
    };
    reader.readAsDataURL(file);
  }

  // رابط البحث المباشر على صور جوجل
  const googleImagesUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(
    searchTerm.trim() || product.name
  )}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 font-cairo"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <header className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-xs sm:text-sm">البحث عن صورة للصنف</h3>
              <p className="text-[11px] text-slate-500 font-bold truncate" title={product.name}>
                {product.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-colors cursor-pointer shrink-0"
            title="إغلاق"
          >
            <X size={15} />
          </button>
        </header>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1 text-xs">
          {/* Search Bar for adjusting keywords */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              performSearch(searchTerm);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث باسم الصنف في كتالوج سنجوب..."
                className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !searchTerm.trim()}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50 shrink-0 shadow-xs flex items-center gap-1.5"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              <span>بحث في الكتالوج</span>
            </button>
          </form>

          {/* Quick Action: Search Google Images Button */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-sky-50/70 border border-sky-100 rounded-2xl">
            <div className="flex items-center gap-2 text-[11px] text-sky-900 font-bold">
              <Globe size={14} className="text-sky-600 shrink-0" />
              <span>لم تجد في الكتالوج؟ ابحث في Google واحفظ الصورة:</span>
            </div>
            <a
              href={googleImagesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-[11px] font-bold shadow-2xs transition"
              title="فتح بحث صور جوجل في صفحة جديدة"
            >
              <ExternalLink size={12} />
              <span>بحث على صور Google ↗</span>
            </a>
          </div>

          {/* Candidates Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500">
                نتائج مطابقة من الكتالوج المركزي والمكتبة:
              </span>
              <span className="text-[10px] text-slate-400 font-bold">
                {candidates.length} صورة متوفرة
              </span>
            </div>

            {loading ? (
              <div className="py-10 flex flex-col items-center justify-center text-slate-500 space-y-2">
                <Loader2 size={22} className="animate-spin text-amber-600" />
                <span className="text-xs font-bold">جارٍ فحص الكتالوج المركزي الموحد…</span>
              </div>
            ) : candidates.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs border border-dashed border-slate-200 rounded-2xl p-4 space-y-2 bg-slate-50/50">
                <p className="font-bold text-slate-700">لم يتم العثور على صورة في الكتالوج المركزي بهذا الاسم.</p>
                <p className="text-[11px] text-slate-400">
                  اضغط على زر (بحث على صور Google) لحفظ الصورة من جوجل، ثم ارفعها من الزر أدناه مباشرة.
                </p>
                <a
                  href={googleImagesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-xs mt-2"
                >
                  <ExternalLink size={13} />
                  <span>البحث في صور Google الآن</span>
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {candidates.map((cand, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={savingUrl !== null}
                    onClick={() => handleApply(cand.url)}
                    className="border-2 border-slate-100 hover:border-amber-500 rounded-2xl overflow-hidden transition-all shadow-2xs group bg-white flex flex-col text-right cursor-pointer disabled:opacity-50 relative focus:outline-none focus:border-amber-500"
                  >
                    <div className="h-28 w-full overflow-hidden bg-slate-100 relative">
                      <img
                        src={cand.url}
                        alt={cand.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                      {cand.source === 'master_spu' && (
                        <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md bg-emerald-700/90 text-white text-[9px] font-bold backdrop-blur-xs flex items-center gap-1">
                          <Database size={9} /> كتالوج سنجوب
                        </span>
                      )}
                      {savingUrl === cand.url && (
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center text-white text-xs font-bold gap-1.5">
                          <Loader2 size={16} className="animate-spin" />
                          <span>جارٍ التعيين…</span>
                        </div>
                      )}
                    </div>

                    <div className="p-2 bg-white border-t border-slate-100 flex items-center justify-between w-full">
                      <span className="text-[11px] font-bold text-slate-800 truncate" title={cand.label}>
                        {cand.label}
                      </span>
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold shrink-0">
                        اختيار ✓
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Upload File / Paste URL Option */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <Upload size={13} className="text-slate-500" />
                <span>رفع صورة من جهازك أو لصق رابط:</span>
              </span>
            </div>

            {uploadError && (
              <p className="text-[11px] text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-200 font-bold">
                {uploadError}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Device Upload Button */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Upload size={14} className="text-orange-400" />
                  <span>رفع صورة جديدة من الجهاز</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </footer>
      </div>
    </div>
  );
}
