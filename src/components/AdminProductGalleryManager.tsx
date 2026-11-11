import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  UploadCloud,
  Search,
  Trash2,
  Check,
  Loader2,
  Copy,
  ExternalLink,
  Sparkles,
  Layers,
  Image as ImageIcon,
  FolderOpen,
  Filter,
  Pencil,
  X,
  Tag,
  Plus,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { operationsApi } from '../lib/operationsApi';
import { uploadCatalogImage } from '../lib/catalogImages';
import type { GalleryItem } from './ProductGalleryModal';

export const CATEGORIES = [
  { id: 'all', label: 'جميع الأصناف' },
  { id: 'dairy', label: 'ألبان وأجبان' },
  { id: 'grocery', label: 'بقالة ومعلبات' },
  { id: 'produce', label: 'خضار وفواكه' },
  { id: 'bakery', label: 'مخبوزات وحلويات' },
  { id: 'beverages', label: 'مشروبات وعصائر' },
  { id: 'meat', label: 'لحوم ودواجن' },
  { id: 'snacks', label: 'شيبس وتسالي' },
  { id: 'cleaning', label: 'منظفات وعناية' },
  { id: 'other', label: 'أصناف متنوعة' },
] as const;

interface PendingBatchItem {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  category: string;
}

export function AdminProductGalleryManager() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [errorNotice, setErrorNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Batch upload modal state
  const [pendingBatch, setPendingBatch] = useState<PendingBatchItem[] | null>(null);
  const [batchGlobalCategory, setBatchGlobalCategory] = useState<string>('grocery');
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  // Edit single item modal state
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('grocery');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    loadGallery();
  }, []);

  async function loadGallery() {
    setIsLoading(true);
    setErrorNotice('');
    try {
      const { data: row } = await supabase.from('app_content').select('content').eq('id', true).maybeSingle();
      let content: any = row?.content;
      if (typeof content === 'string') {
        try { content = JSON.parse(content); } catch {}
      }

      const list: GalleryItem[] = [];

      // 1. Custom gallery from app_content
      if (content && Array.isArray(content.productGallery)) {
        list.push(...content.productGallery.map((item: any) => ({ ...item, isCustom: true })));
      }

      // 2. High quality product images from products catalog
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, image_url, category')
        .not('image_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (prods) {
        for (const p of prods) {
          if (p.image_url && p.image_url.startsWith('http') && !list.some(x => x.url === p.image_url)) {
            list.push({
              id: `prod-${p.id}`,
              title: p.name,
              url: p.image_url,
              category: mapCategory(p.category),
              isCustom: false
            });
          }
        }
      }

      setItems(list);
    } catch (err: any) {
      console.warn('Gallery loading error:', err);
      setErrorNotice('تعذر تحميل عناصر المعرض.');
    } finally {
      setIsLoading(false);
    }
  }

  function mapCategory(catText?: string): string {
    if (!catText) return 'grocery';
    const c = catText.toLowerCase();
    if (c.includes('لبن') || c.includes('جبن') || c.includes('ألبان')) return 'dairy';
    if (c.includes('خضار') || c.includes('فاكه') || c.includes('فواكه')) return 'produce';
    if (c.includes('مخبز') || c.includes('عيش') || c.includes('حلويات')) return 'bakery';
    if (c.includes('مشروب') || c.includes('عصير') || c.includes('مياه')) return 'beverages';
    if (c.includes('لحم') || c.includes('دجاج') || c.includes('فراخ')) return 'meat';
    if (c.includes('شيبس') || c.includes('تسالي') || c.includes('سناك')) return 'snacks';
    if (c.includes('نظاف') || c.includes('صابون') || c.includes('غسيل')) return 'cleaning';
    return 'grocery';
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    const validFiles = rawFiles.filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setErrorNotice('يرجى اختيار ملفات صور صالحة (JPG, PNG, WEBP)');
      return;
    }

    const defaultCategory = selectedCategory !== 'all' ? selectedCategory : 'grocery';
    setBatchGlobalCategory(defaultCategory);

    const batchItems: PendingBatchItem[] = validFiles.map((file, idx) => {
      const previewUrl = URL.createObjectURL(file);
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      return {
        id: `batch-${Date.now()}-${idx}`,
        file,
        previewUrl,
        title: fileNameWithoutExt || `صنف ${idx + 1}`,
        category: defaultCategory
      };
    });

    setPendingBatch(batchItems);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleApplyGlobalCategory(catId: string) {
    setBatchGlobalCategory(catId);
    if (pendingBatch) {
      setPendingBatch(pendingBatch.map(it => ({ ...it, category: catId })));
    }
  }

  function handleUpdatePendingTitle(id: string, newTitle: string) {
    if (!pendingBatch) return;
    setPendingBatch(pendingBatch.map(it => it.id === id ? { ...it, title: newTitle } : it));
  }

  function handleUpdatePendingCategory(id: string, newCat: string) {
    if (!pendingBatch) return;
    setPendingBatch(pendingBatch.map(it => it.id === id ? { ...it, category: newCat } : it));
  }

  function handleRemovePendingItem(id: string) {
    if (!pendingBatch) return;
    const next = pendingBatch.filter(it => it.id !== id);
    if (next.length === 0) {
      setPendingBatch(null);
    } else {
      setPendingBatch(next);
    }
  }

  async function confirmBatchUpload() {
    if (!pendingBatch || pendingBatch.length === 0) return;
    setIsUploading(true);
    setNotice('');
    setErrorNotice('');
    setUploadProgress({ current: 0, total: pendingBatch.length });

    const uploadedItems: GalleryItem[] = [];

    try {
      for (let i = 0; i < pendingBatch.length; i++) {
        const item = pendingBatch[i];
        setUploadProgress({ current: i + 1, total: pendingBatch.length });
        const itemId = `gal-prod-${Date.now()}-${i}`;
        const uploadRes = await uploadCatalogImage('products', itemId, item.file);

        uploadedItems.push({
          id: itemId,
          title: item.title.trim() || 'صنف في المعرض',
          url: uploadRes.url,
          category: item.category || 'grocery',
          addedAt: new Date().toISOString(),
          isCustom: true
        });
      }

      // Persist all batch items to app-content
      await operationsApi('app-content', {
        action: 'add-product-gallery',
        items: uploadedItems
      });

      // Update state
      setItems(prev => [...uploadedItems, ...prev.filter(x => !uploadedItems.some(u => u.url === x.url))]);
      
      const catLabel = CATEGORIES.find(c => c.id === batchGlobalCategory)?.label || batchGlobalCategory;
      setNotice(`✅ تم بنجاح رفع وحفظ ${uploadedItems.length} صورة وتصنيفها في قسم (${catLabel})!`);

      // Switch to this category tab automatically so user sees them right away
      if (batchGlobalCategory && batchGlobalCategory !== 'all') {
        setSelectedCategory(batchGlobalCategory);
      }

      setPendingBatch(null);
    } catch (err: any) {
      console.error('Batch upload error:', err);
      setErrorNotice(err.message || 'حدث خطأ أثناء رفع مجموعة الصور.');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  }

  function openEditModal(item: GalleryItem) {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditCategory(item.category || 'grocery');
    setErrorNotice('');
  }

  async function saveEdit() {
    if (!editingItem) return;
    if (!editTitle.trim()) {
      setErrorNotice('يرجى إدخال اسم صالح للصنف');
      return;
    }

    setIsSavingEdit(true);
    try {
      await operationsApi('app-content', {
        action: 'update-product-gallery',
        id: editingItem.id,
        url: editingItem.url,
        title: editTitle.trim(),
        category: editCategory
      });

      const updated: GalleryItem = {
        ...editingItem,
        title: editTitle.trim(),
        category: editCategory,
        isCustom: true
      };

      setItems(prev => prev.map(it => (it.id === editingItem.id || it.url === editingItem.url ? updated : it)));
      const catLabel = CATEGORIES.find(c => c.id === editCategory)?.label || editCategory;
      setNotice(`✅ تم تعديل اسم وقسم صنف "${updated.title}" إلى (${catLabel}) بنجاح!`);
      setEditingItem(null);
    } catch (err: any) {
      setErrorNotice(err.message || 'تعذر حفظ تعديلات الصنف.');
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDelete(item: GalleryItem) {
    if (!window.confirm(`هل أنت متأكد من حذف صورة "${item.title}" نهائياً من المعرض؟`)) return;

    try {
      await operationsApi('app-content', {
        action: 'delete-product-gallery',
        id: item.id
      });
      setItems(prev => prev.filter(i => i.id !== item.id));
      setNotice('تم حذف الصورة من المعرض بنجاح.');
    } catch (err: any) {
      setErrorNotice(err.message || 'تعذر حذف الصورة.');
    }
  }

  function handleCopy(url: string) {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2500);
  }

  const filteredItems = useMemo(() => {
    let list = items;
    if (selectedCategory !== 'all') {
      list = list.filter(i => i.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(i => i.title.toLowerCase().includes(q) || (i.category && i.category.toLowerCase().includes(q)));
    }
    return list;
  }, [items, selectedCategory, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in font-['Cairo',sans-serif]" dir="rtl">
      
      {/* Page Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-black">
              <ImageIcon size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">معرض صور الأصناف والمنتجات</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                مكتبة صور موحدة مع إمكانية رفع مجموعة صور لقسم دفعة واحدة وتعديل اسم وتصنيف أي صنف
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
            id="admin-gallery-file-input"
          />
          <label
            htmlFor="admin-gallery-file-input"
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-xs transition-all cursor-pointer bg-[#FF5900] hover:bg-[#E04E00] active:scale-95"
          >
            <UploadCloud size={16} />
            <span>رفع مجموعة صور لقسم (Batch)</span>
          </label>
        </div>
      </div>

      {/* Notices */}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center justify-between animate-fade-in shadow-xs">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">✕</button>
        </div>
      )}
      {errorNotice && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl flex items-center justify-between animate-fade-in shadow-xs">
          <span>{errorNotice}</span>
          <button type="button" onClick={() => setErrorNotice('')} className="text-rose-600 hover:text-rose-900 cursor-pointer">✕</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن صنف بالاسم (جبنة، حليب، أرز، زيت، طماطم، بسكويت، عصير، صابون…)"
              className="w-full pr-10 pl-9 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-xs sm:text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5 shrink-0 px-1">
            <Layers size={15} />
            <span>{filteredItems.length} صورة متوفرة</span>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Images */}
      {isLoading ? (
        <div className="py-24 bg-white rounded-3xl border border-slate-200/80 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 size={36} className="animate-spin text-orange-500" />
          <p className="text-xs font-bold">جارٍ تحميل معرض الأصناف…</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-20 bg-white rounded-3xl border border-slate-200/80 text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <ImageIcon size={32} />
          </div>
          <h3 className="font-bold text-slate-800 text-base">لا توجد صور في هذا التصنيف</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            اضغط على زر "رفع مجموعة صور لقسم" بالأعلى لإضافة صور أصناف متعددة وتحديد قسمها دفعة واحدة.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs hover:border-orange-300 hover:shadow-md transition-all flex flex-col"
            >
              {/* Image Preview */}
              <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                <img
                  src={item.url}
                  alt={item.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />

                {/* Hover overlay with action buttons */}
                <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="w-8 h-8 rounded-xl bg-white/95 text-slate-800 hover:bg-orange-500 hover:text-white flex items-center justify-center shadow-xs transition cursor-pointer"
                    title="تعديل الاسم أو القسم"
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopy(item.url)}
                    className="w-8 h-8 rounded-xl bg-white/95 text-slate-800 hover:bg-white flex items-center justify-center shadow-xs transition cursor-pointer"
                    title="نسخ رابط الصورة"
                  >
                    {copiedUrl === item.url ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-xl bg-white/95 text-slate-800 hover:bg-white flex items-center justify-center shadow-xs transition cursor-pointer"
                    title="فتح الصورة بالحجم الكامل"
                  >
                    <ExternalLink size={14} />
                  </a>

                  {item.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="w-8 h-8 rounded-xl bg-rose-600 text-white hover:bg-rose-700 flex items-center justify-center shadow-xs transition cursor-pointer"
                      title="حذف من المعرض"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {item.isCustom && (
                  <span className="absolute top-2 right-2 text-[9px] font-black px-2 py-0.5 rounded-full bg-orange-500 text-white shadow-xs">
                    مرفوعة يدوياً
                  </span>
                )}
              </div>

              {/* Title & Category */}
              <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-xs line-clamp-2 leading-snug" title={item.title}>
                    {item.title}
                  </h4>
                  <div className="mt-1 flex items-center gap-1">
                    <span className="text-[10px] text-orange-700 bg-orange-50 border border-orange-200/60 font-bold px-2 py-0.5 rounded-md">
                      {CATEGORIES.find(c => c.id === item.category)?.label || 'صنف عام'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 mt-2.5 flex items-center justify-between text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Pencil size={12} />
                    <span>تعديل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopy(item.url)}
                    className="text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Copy size={11} />
                    <span>{copiedUrl === item.url ? 'تم النسخ' : 'نسخ'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal 1: Batch Upload Confirmation & Category Assignment ── */}
      {pendingBatch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fade-in font-['Cairo',sans-serif]">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-right animate-scale-up" dir="rtl">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <UploadCloud size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                    رفع مجموعة صور على قسم ({pendingBatch.length} صورة)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    اختر القسم الموحد للمجموعة مع إمكانية تعديل اسم كل صنف على حدة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingBatch(null)}
                disabled={isUploading}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Batch Global Category Toolbar */}
            <div className="px-6 py-4 bg-orange-50/70 border-b border-orange-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <Tag size={16} className="text-orange-600 shrink-0" />
                <span className="text-xs font-bold text-slate-800">
                  تحديد قسم موحد لجميع الصور المحددة:
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <select
                  value={batchGlobalCategory}
                  onChange={(e) => handleApplyGlobalCategory(e.target.value)}
                  disabled={isUploading}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-orange-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-xs font-bold text-slate-800 outline-none transition-all cursor-pointer shadow-2xs"
                >
                  {CATEGORIES.filter(c => c.id !== 'all').map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-orange-700 bg-orange-100/80 px-2.5 py-1 rounded-lg font-bold shrink-0">
                  يطبق على الـ {pendingBatch.length} صورة
                </span>
              </div>
            </div>

            {/* Upload Progress Bar if currently uploading */}
            {uploadProgress && (
              <div className="px-6 py-3 bg-slate-900 text-white shrink-0 space-y-1.5 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-orange-400" />
                    <span>جارٍ رفع الصور إلى المعرض…</span>
                  </span>
                  <span>{uploadProgress.current} من {uploadProgress.total} ({Math.round((uploadProgress.current / uploadProgress.total) * 100)}%)</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#FF5900] h-full transition-all duration-300 rounded-full"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Scrollable List of Items */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
              {pendingBatch.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-white hover:border-orange-200 transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-200 border border-slate-300 shrink-0">
                      <img
                        src={item.previewUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-0 right-0 bg-slate-900/80 text-white text-[9px] font-bold px-1 rounded-tl">
                        #{idx + 1}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        اسم الصنف:
                      </label>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => handleUpdatePendingTitle(item.id, e.target.value)}
                        placeholder="اسم الصنف في المعرض…"
                        disabled={isUploading}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 focus:border-orange-500 text-xs font-bold text-slate-800 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-between sm:justify-start pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        القسم:
                      </label>
                      <select
                        value={item.category}
                        onChange={(e) => handleUpdatePendingCategory(item.id, e.target.value)}
                        disabled={isUploading}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 focus:border-orange-500 text-xs font-bold text-slate-800 outline-none transition-all cursor-pointer"
                      >
                        {CATEGORIES.filter(c => c.id !== 'all').map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemovePendingItem(item.id)}
                      disabled={isUploading}
                      className="mt-3.5 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="استبعاد هذه الصورة"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white shrink-0">
              <span className="text-xs font-bold text-slate-500">
                إجمالي الصور الجاهزة للرفع: <span className="text-orange-600 font-black">{pendingBatch.length}</span>
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setPendingBatch(null)}
                  disabled={isUploading}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmBatchUpload}
                  disabled={isUploading || pendingBatch.length === 0}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#FF5900] hover:bg-[#E04E00] active:scale-95 transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                  <span>{isUploading ? `جارٍ الرفع (${uploadProgress?.current || 0}/${uploadProgress?.total || pendingBatch.length})…` : `تأكيد ورفع الـ (${pendingBatch.length}) صور`}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Modal 2: Edit Name & Category of Existing Single Item ── */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-['Cairo',sans-serif]">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-right animate-scale-up" dir="rtl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <Pencil size={16} />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">تعديل اسم وقسم صورة الصنف</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Image Preview */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <img
                src={editingItem.url}
                alt={editingItem.title}
                className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
              />
              <div className="text-xs text-slate-500 overflow-hidden">
                <p className="font-bold text-slate-800 line-clamp-1">{editingItem.title}</p>
                <p className="mt-0.5 text-orange-600 font-bold">
                  القسم الحالي: {CATEGORIES.find(c => c.id === editingItem.category)?.label || 'صنف عام'}
                </p>
              </div>
            </div>

            {/* Input Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم الصنف <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="أدخل اسم الصنف الجديد…"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-xs sm:text-sm font-medium outline-none transition-all"
                autoFocus
              />
            </div>

            {/* Category Select */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تغيير القسم / التصنيف <span className="text-rose-500">*</span>
              </label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-xs sm:text-sm font-bold outline-none transition-all cursor-pointer"
              >
                {CATEGORIES.filter(c => c.id !== 'all').map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                disabled={isSavingEdit}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={isSavingEdit || !editTitle.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#FF5900] hover:bg-[#E04E00] active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span>{isSavingEdit ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
