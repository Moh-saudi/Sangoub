import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  Search,
  Link2,
  ExternalLink,
  Upload,
  Database,
  Globe,
  Check,
} from 'lucide-react';
import type { Product } from '../types';
import { searchImagesForProduct, type ImageCandidate } from '../utils/productImageFinder';
import { ProductGalleryModal } from './ProductGalleryModal';

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
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [directUrl, setDirectUrl] = useState('');
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
    const cleanUrl = url.trim();
    if (!cleanUrl || !product) return;
    setSavingUrl(cleanUrl);
    try {
      await onSelectImage(product.id, cleanUrl);
      onClose();
    } catch (err) {
      console.error('Failed applying image:', err);
      setUploadError('تعذر حفظ الصورة، يرجى المحاولة مرة أخرى.');
    } finally {
      setSavingUrl(null);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('يرجى اختيار ملف صورة مدعوم (JPG, PNG, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('الحد الأقصى لحجم الصورة 5 ميجابايت');
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
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <header className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-sm">البحث عن صورة للمنتج</h3>
              <p className="text-xs text-slate-500 font-semibold truncate max-w-md" title={product.name}>
                {product.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-colors cursor-pointer shrink-0"
            title="إغلاق النافذة"
          >
            <X size={16} />
          </button>
        </header>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Search Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              performSearch(searchTerm);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="اكتب اسم الصنف للبحث عنه..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1"
                  title="مسح"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !searchTerm.trim()}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50 shrink-0 shadow-xs flex items-center gap-1.5 whitespace-nowrap"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              <span>بحث تلقائي</span>
            </button>
          </form>

          {/* Quick Actions Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsGalleryOpen(true)}
              className="flex items-center justify-between px-3 py-2.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl text-xs text-orange-950 font-bold transition cursor-pointer whitespace-nowrap"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#FF5900] shrink-0" />
                <span>معرض الأصناف المعتمدة</span>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-orange-200/80 text-orange-900 text-[11px] font-bold">
                تصفح ↗
              </span>
            </button>

            <a
              href={googleImagesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl text-xs text-sky-950 font-bold transition cursor-pointer whitespace-nowrap"
              title="فتح بحث صور جوجل في نافذة جديدة"
            >
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-sky-600 shrink-0" />
                <span>البحث في صور Google</span>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-200/80 text-sky-900 text-[11px] font-bold">
                <ExternalLink size={11} />
                فتح ↗
              </span>
            </a>
          </div>

          {/* Results Section */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-bold text-slate-700">
                الصور المقترحة:
              </span>
              <span className="text-[11px] text-slate-500 font-bold">
                {candidates.length > 0 ? `${candidates.length} صورة متوفرة` : 'لا توجد نتائج'}
              </span>
            </div>

            {loading ? (
              <div className="py-10 flex flex-col items-center justify-center text-slate-500 space-y-2">
                <Loader2 size={24} className="animate-spin text-amber-600" />
                <span className="text-xs font-bold">جارٍ البحث عن أفضل صورة مطابقة…</span>
              </div>
            ) : candidates.length === 0 ? (
              <div className="py-6 text-center text-slate-500 border border-dashed border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50/60">
                <p className="text-xs font-bold text-slate-700">لم يتم العثور على صورة تلقائية مطابقة لهذا الاسم.</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <a
                    href={googleImagesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    <ExternalLink size={13} />
                    <span>البحث في Google وحفظ الصورة</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Upload size={13} />
                    <span>رفع صورة من جهازك</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {candidates.map((cand, idx) => {
                  let sourceTag = '';
                  let cleanName = cand.label;
                  if (cand.label.startsWith('من الأصناف المعتمدة:')) {
                    sourceTag = 'معتمد';
                    cleanName = cand.label.replace(/^من الأصناف المعتمدة:\s*/, '');
                  } else if (cand.label.startsWith('من الأصناف المشابهة:')) {
                    sourceTag = 'مشابه';
                    cleanName = cand.label.replace(/^من الأصناف المشابهة:\s*/, '');
                  } else if (cand.label.startsWith('الكتالوج العام:')) {
                    sourceTag = 'كتالوج';
                    cleanName = cand.label.replace(/^الكتالوج العام:\s*/, '');
                  } else if (cand.label.startsWith('كتالوج مركزي:')) {
                    sourceTag = 'مركزي';
                    cleanName = cand.label.replace(/^كتالوج مركزي:\s*/, '');
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={savingUrl !== null}
                      onClick={() => handleApply(cand.url)}
                      className="border border-slate-200 hover:border-amber-500 rounded-2xl overflow-hidden transition-all shadow-2xs hover:shadow-xs group bg-white flex flex-col text-right cursor-pointer disabled:opacity-50 relative focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <div className="h-24 sm:h-28 w-full overflow-hidden bg-slate-50 flex items-center justify-center p-2 relative">
                        <img
                          src={cand.url}
                          alt={cleanName}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        {sourceTag && (
                          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-slate-900/80 text-white text-[9px] font-bold backdrop-blur-xs flex items-center gap-0.5">
                            {cand.source === 'master_spu' && <Database size={9} />}
                            <span>{sourceTag}</span>
                          </span>
                        )}
                        {savingUrl === cand.url && (
                          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center text-white text-[11px] font-bold gap-1">
                            <Loader2 size={14} className="animate-spin" />
                            <span>جارٍ التعيين…</span>
                          </div>
                        )}
                      </div>

                      <div className="p-2 bg-white border-t border-slate-100 flex flex-col justify-between flex-1 w-full gap-1">
                        <div className="min-h-[2.4em]">
                          <p className="text-[11px] font-bold text-slate-800 line-clamp-2 leading-tight" title={cleanName}>
                            {cleanName}
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-50 mt-auto">
                          <span className="text-[9.5px] font-semibold text-slate-400 truncate max-w-[65px]">
                            {sourceTag || 'اقتراح'}
                          </span>
                          <span className="text-[10px] text-amber-800 bg-amber-50 group-hover:bg-amber-500 group-hover:text-white border border-amber-200/80 px-2 py-0.5 rounded-md font-bold transition-colors shrink-0">
                            اختيار ✓
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upload & Link Options */}
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <span className="text-xs font-bold text-slate-800 block">
              طرق إضافية لتعيين الصورة:
            </span>

            {uploadError && (
              <p className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200 font-bold">
                {uploadError}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* File Upload from Device */}
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
                  className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                >
                  <Upload size={14} className="text-amber-400" />
                  <span>رفع صورة من جهازك</span>
                </button>
              </div>

              {/* Direct Image URL input */}
              <div className="flex gap-1.5">
                <input
                  type="url"
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  placeholder="أو الصق رابط صورة هنا..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  disabled={!directUrl.trim() || savingUrl !== null}
                  onClick={() => handleApply(directUrl)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition disabled:opacity-40 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  تطبيق
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </footer>
      </div>

      {isGalleryOpen && (
        <ProductGalleryModal
          isOpen={isGalleryOpen}
          onClose={() => setIsGalleryOpen(false)}
          onSelectImage={async (url) => {
            await handleApply(url);
          }}
          currentImageUrl={product.imageUrl}
          title={`معرض صور الأصناف - اختيار صورة لـ "${product.name}"`}
          initialSearch={searchTerm.trim() ? searchTerm.trim().split(' ')[0] : product.name.trim().split(' ')[0]}
        />
      )}
    </div>
  );
}
