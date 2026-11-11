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
  Tag
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

  // Pre-upload confirmation dialog state
  const [pendingUpload, setPendingUpload] = useState<{
    file: File;
    previewUrl: string;
    title: string;
    category: string;
  } | null>(null);

  // Edit modal state for existing items
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

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorNotice('يرجى اختيار ملف صورة صالح (JPG, PNG, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorNotice('حجم الصورة كبير جداً (الحد الأقصى 5 ميجابايت)');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    const defaultCategory = selectedCategory !== 'all' ? selectedCategory : 'grocery';

    setPendingUpload({
      file,
      previewUrl,
      title: fileNameWithoutExt || 'صنف جديد في المعرض',
      category: defaultCategory
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function confirmUpload() {
    if (!pendingUpload) return;
    if (!pendingUpload.title.trim()) {
      setErrorNotice('يرجى إدخال اسم للصنف قبل الرفع');
      return;
    }

    setIsUploading(true);
    setNotice('');
    setErrorNotice('');

    try {
      const itemId = 'gal-prod-' + Date.now();
      const uploadRes = await uploadCatalogImage('products', itemId, pendingUpload.file);

      const newItem: GalleryItem = {
        id: itemId,
        title: pendingUpload.title.trim(),
        url: uploadRes.url,
        category: pendingUpload.category || 'grocery',
        addedAt: new Date().toISOString(),
        isCustom: true,
      };

      await operationsApi('app-content', {
        action: 'add-product-gallery',
        item: newItem
      });

      setItems(prev => [newItem, ...prev.filter(i => i.url !== newItem.url)]);
      const catLabel = CATEGORIES.find(c => c.id === newItem.category)?.label || newItem.category;
      setNotice(`✅ تم رفع صنف "${newItem.title}" وتصنيفه في قسم (${catLabel}) بنجاح!`);
      setPendingUpload(null);
    } catch (err: any) {
      console.error('Upload error:', err);
      setErrorNotice(err.message || 'تعذر رفع الصورة.');
    } finally {
      setIsUploading(false);
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
                مكتبة صور موحدة مع إمكانية تعديل اسم الصنف وتحديد قسمه وتغييره بدقة
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
            onChange={handleFileSelected}
            className="hidden"
            id="admin-gallery-file-input"
          />
          <label
            htmlFor="admin-gallery-file-input"
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-xs transition-all cursor-pointer bg-[#FF5900] hover:bg-[#E04E00] active:scale-95"
          >
            <UploadCloud size={16} />
            <span>رفع وتسمية صورة جديدة</span>
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
            اضغط على زر "رفع وتسمية صورة جديدة" بالأعلى لإضافة صورة صنف مع تحديد اسمه وقسمه.
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

      {/* ── Modal 1: Pre-Upload Name & Category Setup ── */}
      {pendingUpload && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-['Cairo',sans-serif]">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-right animate-scale-up" dir="rtl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <UploadCloud size={18} />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">تحديد اسم وقسم الصورة قبل الرفع</h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingUpload(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Preview & Details */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <img
                src={pendingUpload.previewUrl}
                alt="معاينة"
                className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
              />
              <div className="text-xs text-slate-500 overflow-hidden">
                <p className="font-bold text-slate-800 truncate">{pendingUpload.file.name}</p>
                <p className="mt-0.5">الحجم: {(pendingUpload.file.size / (1024 * 1024)).toFixed(2)} ميجابايت</p>
              </div>
            </div>

            {/* Input Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم الصنف بالكامل <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={pendingUpload.title}
                onChange={(e) => setPendingUpload({ ...pendingUpload, title: e.target.value })}
                placeholder="مثال: حليب جهينة كامل الدسم 1 لتر"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-xs sm:text-sm font-medium outline-none transition-all"
                autoFocus
              />
            </div>

            {/* Category Select */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                القسم / التصنيف <span className="text-rose-500">*</span>
              </label>
              <select
                value={pendingUpload.category}
                onChange={(e) => setPendingUpload({ ...pendingUpload, category: e.target.value })}
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
                onClick={() => setPendingUpload(null)}
                disabled={isUploading}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={confirmUpload}
                disabled={isUploading || !pendingUpload.title.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#FF5900] hover:bg-[#E04E00] active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isUploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                <span>{isUploading ? 'جارٍ الرفع والحفظ…' : 'حفظ ورفع للمعرض'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Edit Name & Category of Existing Item ── */}
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
