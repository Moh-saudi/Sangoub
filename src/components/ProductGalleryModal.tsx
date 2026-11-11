import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Search,
  UploadCloud,
  Check,
  Loader2,
  Trash2,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Plus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { operationsApi } from '../lib/operationsApi';
import { uploadCatalogImage } from '../lib/catalogImages';

export interface GalleryItem {
  id: string;
  title: string;
  url: string;
  category?: string;
  addedAt?: string;
  isCustom?: boolean;
}

interface ProductGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string, title?: string) => void;
  currentImageUrl?: string;
  title?: string;
}

const GALLERY_CATEGORIES = [
  { id: 'all', label: 'جميع الأصناف' },
  { id: 'dairy', label: 'ألبان وأجبان' },
  { id: 'grocery', label: 'بقالة ومعلبات' },
  { id: 'produce', label: 'خضار وفواكه' },
  { id: 'bakery', label: 'مخبوزات وحلويات' },
  { id: 'beverages', label: 'مشروبات وعصائر' },
  { id: 'meat', label: 'لحوم ودواجن' },
  { id: 'snacks', label: 'شيبس وتسالي' },
  { id: 'cleaning', label: 'منظفات وعناية' },
] as const;

// Curated high quality product photography for quick selection
const DEFAULT_CURATED_PRODUCTS: GalleryItem[] = [
  // ألبان وأجبان
  { id: 'cur-1', title: 'حليب كامل الدسم 1 لتر', category: 'dairy', url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-2', title: 'جبنة بيضاء فيتا كريمي', category: 'dairy', url: 'https://images.unsplash.com/photo-1552767059-ce182ead6c1b?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-3', title: 'جبن رومي وشيدر أصفر', category: 'dairy', url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-4', title: 'زبادي طبيعي طازج', category: 'dairy', url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-5', title: 'زبدة طبيعية فاخرة', category: 'dairy', url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-6', title: 'بيض مزارع طازج 30 بيضة', category: 'dairy', url: 'https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?auto=format&fit=crop&w=600&q=80' },

  // بقالة ومعلبات
  { id: 'cur-7', title: 'زيت عباد الشمس 1 لتر', category: 'grocery', url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-8', title: 'أرز مصري أبيض فاخر 1 كجم', category: 'grocery', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-9', title: 'سكر أبيض نقي 1 كجم', category: 'grocery', url: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-10', title: 'مكرونة فرن إيطالية 400 جم', category: 'grocery', url: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281692?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-11', title: 'صلصة طماطم معجون برطمان', category: 'grocery', url: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-12', title: 'علبة تونة قطع في الزيت', category: 'grocery', url: 'https://images.unsplash.com/photo-1534483509719-3feaee7c30da?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-13', title: 'فول مدمس درجة أولى', category: 'grocery', url: 'https://images.unsplash.com/photo-1585476962176-963d76e73c8d?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-14', title: 'شاي أسود ناعم أحمر', category: 'grocery', url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-15', title: 'بُن قهوة تركي محوج', category: 'grocery', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80' },

  // خضروات وفواكه
  { id: 'cur-16', title: 'طماطم بلدي طازجة 1 كجم', category: 'produce', url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-17', title: 'خيار بلدي طازج 1 كجم', category: 'produce', url: 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-18', title: 'بطاطس تحمير ممتازة 1 كجم', category: 'produce', url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-19', title: 'بصل أحمر مصري 1 كجم', category: 'produce', url: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-20', title: 'موز بلدي فاخر 1 كجم', category: 'produce', url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-21', title: 'تفاح أحمر سكري 1 كجم', category: 'produce', url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-22', title: 'برتقال عصير طازج 1 كجم', category: 'produce', url: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-23', title: 'ليمون أصفر بلدي 500 جم', category: 'produce', url: 'https://images.unsplash.com/photo-1533038590840-1cde6e668a91?auto=format&fit=crop&w=600&q=80' },

  // مخبوزات وحلويات
  { id: 'cur-24', title: 'خبز فينو طازج كيس 5 رغيف', category: 'bakery', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-25', title: 'خبز بلدي طازج بالردة', category: 'bakery', url: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-26', title: 'خبز توست أبيض شرائح', category: 'bakery', url: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-27', title: 'كرواسون زبدة سادة وشوكولاتة', category: 'bakery', url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-28', title: 'شوكولاتة بالحليب والبندق', category: 'bakery', url: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=600&q=80' },

  // مشروبات وعصائر
  { id: 'cur-29', title: 'مياه معدنية طبيعية 1.5 لتر', category: 'beverages', url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-30', title: 'مشروب غازي كانز 330 مل', category: 'beverages', url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-31', title: 'عصير برتقال طبيعي 1 لتر', category: 'beverages', url: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-32', title: 'عصير مانجو طبيعي فاخر', category: 'beverages', url: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80' },

  // شيبس وتسالي
  { id: 'cur-33', title: 'رقائق بطاطس مقرمشة شيبسي', category: 'snacks', url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-34', title: 'مكسرات مشكلة محمصة مملحة', category: 'snacks', url: 'https://images.unsplash.com/photo-1536591375315-1988d689622d?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-35', title: 'بسكويت ويفر بالشوكولاتة', category: 'snacks', url: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80' },

  // لحوم ودواجن
  { id: 'cur-36', title: 'صدور دجاج بانيه طازجة 1 كجم', category: 'meat', url: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-37', title: 'لحم مفروم بلدي طازج 1 كجم', category: 'meat', url: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-38', title: 'برجر لحم بقري فاخر', category: 'meat', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80' },

  // منظفات وعناية
  { id: 'cur-39', title: 'مسحوق غسيل أوتوماتيك 2.5 كجم', category: 'cleaning', url: 'https://images.unsplash.com/photo-1585670270608-b4be4fb880ed?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-40', title: 'سائل غسيل الأطباق بالليمون 1 لتر', category: 'cleaning', url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-41', title: 'مناديل مطبخ وتواليت رول', category: 'cleaning', url: 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-42', title: 'صابون يدين سائل مرطب 500 مل', category: 'cleaning', url: 'https://images.unsplash.com/photo-1600428877878-1a0ee97bed84?auto=format&fit=crop&w=600&q=80' },
];

export function ProductGalleryModal({
  isOpen,
  onClose,
  onSelectImage,
  currentImageUrl,
  title = 'معرض صور الأصناف والمنتجات',
}: ProductGalleryModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [customItems, setCustomItems] = useState<GalleryItem[]>([]);
  const [catalogItems, setCatalogItems] = useState<GalleryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState('');
  const [errorNotice, setErrorNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load custom gallery items from Supabase app_content & catalog products
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function loadGalleryData() {
      setIsLoading(true);
      setErrorNotice('');
      try {
        // 1. Fetch custom uploaded product gallery from app_content
        const { data: row } = await supabase.from('app_content').select('content').eq('id', true).maybeSingle();
        let content: any = row?.content;
        if (typeof content === 'string') {
          try { content = JSON.parse(content); } catch {}
        }
        if (content && Array.isArray(content.productGallery) && mounted) {
          setCustomItems(content.productGallery.map((item: any) => ({
            ...item,
            isCustom: true
          })));
        }

        // 2. Fetch distinct high quality product images from products table
        const { data: prods } = await supabase
          .from('products')
          .select('id, name, image_url, category')
          .not('image_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(80);

        if (prods && mounted) {
          const validProds = prods
            .filter((p: any) => p.image_url && p.image_url.startsWith('http'))
            .map((p: any) => ({
              id: `prod-cat-${p.id}`,
              title: p.name,
              url: p.image_url,
              category: mapBackendCategory(p.category),
              isCustom: false
            }));
          setCatalogItems(validProds);
        }
      } catch (err: any) {
        console.warn('Product gallery load notice:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadGalleryData();
    return () => { mounted = false; };
  }, [isOpen]);

  // Helper to map backend category text to filter category
  function mapBackendCategory(catText?: string): string {
    if (!catText) return 'grocery';
    const c = catText.toLowerCase();
    if (c.includes('لبن') || c.includes('جبن') || c.includes('ألبان') || c.includes('dairy')) return 'dairy';
    if (c.includes('خضار') || c.includes('فاكه') || c.includes('فواكه') || c.includes('produce')) return 'produce';
    if (c.includes('مخبز') || c.includes('عيش') || c.includes('حلويات') || c.includes('bakery')) return 'bakery';
    if (c.includes('مشروب') || c.includes('عصير') || c.includes('مياه') || c.includes('beverage')) return 'beverages';
    if (c.includes('لحم') || c.includes('دجاج') || c.includes('فراخ') || c.includes('meat')) return 'meat';
    if (c.includes('شيبس') || c.includes('شيبسي') || c.includes('تسالي') || c.includes('سناك')) return 'snacks';
    if (c.includes('نظاف') || c.includes('صابون') || c.includes('غسيل') || c.includes('clean')) return 'cleaning';
    return 'grocery';
  }

  // Combine custom items (top priority), curated library, and existing store catalog items
  const allItems = useMemo(() => {
    const urlsSeen = new Set<string>();
    const list: GalleryItem[] = [];

    // Custom uploads first
    for (const item of customItems) {
      if (item.url && !urlsSeen.has(item.url)) {
        urlsSeen.add(item.url);
        list.push(item);
      }
    }

    // Curated high quality list second
    for (const item of DEFAULT_CURATED_PRODUCTS) {
      if (item.url && !urlsSeen.has(item.url)) {
        urlsSeen.add(item.url);
        list.push(item);
      }
    }

    // Catalog items third
    for (const item of catalogItems) {
      if (item.url && !urlsSeen.has(item.url)) {
        urlsSeen.add(item.url);
        list.push(item);
      }
    }

    return list;
  }, [customItems, catalogItems]);

  // Filter items by category and search
  const filteredItems = useMemo(() => {
    let result = allItems;
    if (selectedCategory !== 'all') {
      result = result.filter((it) => it.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (it) => it.title.toLowerCase().includes(q) || (it.category && it.category.toLowerCase().includes(q))
      );
    }
    return result;
  }, [allItems, selectedCategory, searchQuery]);

  // Handle uploading a brand new product image into the shared gallery
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
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

    setIsUploading(true);
    setUploadNotice('');
    setErrorNotice('');

    try {
      const itemId = 'gal-prod-' + Date.now();
      const uploadRes = await uploadCatalogImage('products', itemId, file);
      
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const newItem: GalleryItem = {
        id: itemId,
        title: fileNameWithoutExt || 'صنف جديد في المعرض',
        url: uploadRes.url,
        category: selectedCategory === 'all' ? 'grocery' : selectedCategory,
        addedAt: new Date().toISOString(),
        isCustom: true,
      };

      // Persist to shared app_content
      try {
        await operationsApi('app-content', {
          action: 'add-product-gallery',
          item: newItem
        });
      } catch (saveErr) {
        console.warn('operationsApi add-product-gallery notice, attempting direct save:', saveErr);
      }

      setCustomItems((prev) => [newItem, ...prev.filter((i) => i.url !== newItem.url)]);
      setSelectedItem(newItem);
      setUploadNotice('✅ تم رفع الصورة وإضافتها إلى معرض الأصناف بنجاح!');
    } catch (err: any) {
      console.error('Gallery upload error:', err);
      setErrorNotice(err.message || 'تعذر رفع الصورة إلى المعرض.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Handle delete custom item
  async function handleDeleteCustomItem(e: React.MouseEvent, item: GalleryItem) {
    e.stopPropagation();
    if (!window.confirm(`هل أنت متأكد من حذف صورة "${item.title}" من المعرض؟`)) return;

    try {
      await operationsApi('app-content', {
        action: 'delete-product-gallery',
        id: item.id
      });
      setCustomItems((prev) => prev.filter((i) => i.id !== item.id));
      if (selectedItem?.id === item.id) setSelectedItem(null);
    } catch (err: any) {
      setErrorNotice(err.message || 'تعذر حذف الصورة من المعرض.');
    }
  }

  function handleConfirmSelection() {
    if (!selectedItem) return;
    onSelectImage(selectedItem.url, selectedItem.title);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-fade-in font-['Cairo',sans-serif]"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold">
              <ImageIcon size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base sm:text-lg flex items-center gap-1.5">
                <span>{title}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                  {filteredItems.length} صورة
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                اختر صورة جاهزة عالية الجودة للأصناف أو ارفع صورة جديدة لتظهر لجميع المتاجر
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Upload Button */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileUpload}
              className="hidden"
              id="gallery-modal-upload-input"
            />
            <label
              htmlFor="gallery-modal-upload-input"
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer ${
                isUploading ? 'bg-orange-400 cursor-not-allowed' : 'bg-[#FF5900] hover:bg-[#E04E00] active:scale-95'
              }`}
            >
              {isUploading ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
              <span>{isUploading ? 'جارٍ الرفع…' : 'رفع صورة للمعرض'}</span>
            </label>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Notices */}
        {uploadNotice && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between animate-fade-in">
            <span>{uploadNotice}</span>
            <button type="button" onClick={() => setUploadNotice('')} className="text-emerald-600 hover:text-emerald-900">
              <X size={14} />
            </button>
          </div>
        )}
        {errorNotice && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between animate-fade-in">
            <span>{errorNotice}</span>
            <button type="button" onClick={() => setErrorNotice('')} className="text-rose-600 hover:text-rose-900">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Search & Category Filter Toolbar */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
          <div className="relative w-full">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم عن صنف (جبنة، حليب، زيت، أرز، طماطم، شيبس، عصير…)"
              className="w-full pr-10 pl-9 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-xs sm:text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Categories Pill Rail */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {GALLERY_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
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

        {/* Gallery Image Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/50">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 size={32} className="animate-spin text-orange-500" />
              <p className="text-xs font-bold">جارٍ تحميل معرض الأصناف…</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <ImageIcon size={28} />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">لا توجد صور مطابقة لبحثك</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                يمكنك رفع صورة صنفك الخاصة مباشرة إلى المعرض المشترك بالضغط على زر "رفع صورة للمعرض" بالأعلى.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {filteredItems.map((item) => {
                const isSelected = selectedItem?.url === item.url || currentImageUrl === item.url;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`group relative flex flex-col rounded-2xl overflow-hidden bg-white border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 ring-2 ring-orange-500/20 shadow-md scale-[1.02]'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    {/* Thumbnail Image */}
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

                      {/* Selected Overlay Checkmark */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-orange-600/20 backdrop-blur-[1px] flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-[#FF5900] text-white flex items-center justify-center shadow-lg">
                            <Check size={18} strokeWidth={3} />
                          </div>
                        </div>
                      )}

                      {/* Custom uploaded badge or delete */}
                      {item.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustomItem(e, item)}
                          className="absolute top-1.5 left-1.5 w-6 h-6 rounded-lg bg-black/60 text-white hover:bg-rose-600 flex items-center justify-center transition-colors cursor-pointer shadow-sm"
                          title="حذف من المعرض"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="p-2.5">
                      <h5 className="font-bold text-slate-800 text-xs line-clamp-1 leading-snug">
                        {item.title}
                      </h5>
                      <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                        {GALLERY_CATEGORIES.find((c) => c.id === item.category)?.label || 'صنف عام'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-white">
          <div className="min-w-0 pr-1">
            {selectedItem ? (
              <div className="flex items-center gap-2">
                <img
                  src={selectedItem.url}
                  alt={selectedItem.title}
                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                />
                <span className="text-xs font-bold text-slate-800 line-clamp-1">
                  المحدد: {selectedItem.title}
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-500 font-medium">
                اضغط على أي صورة لتحديدها وتطبيقها على الصنف
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={!selectedItem}
              onClick={handleConfirmSelection}
              className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 ${
                selectedItem
                  ? 'bg-[#FF5900] hover:bg-[#E04E00] shadow-sm cursor-pointer active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check size={15} />
              <span>اعتماد وتطبيق الصورة</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
