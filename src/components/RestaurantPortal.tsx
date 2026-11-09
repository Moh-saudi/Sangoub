import { CatalogManager } from "./CatalogManager";
import { OffersManager } from "./OffersManager";
import { UserManagement } from "./UserManagement";
import {MerchantProductImage} from './MerchantProductImage';
import {MerchantRecords} from './MerchantRecords';
import {BRAND} from '../brand';
import { MerchantCatalogPicker } from './MerchantCatalogPicker';
import { BulkProductImportModal } from './BulkProductImportModal';
import { SmartProductImageModal } from './SmartProductImageModal';
import { exportProductsToExcel } from '../utils/excelExport';
import { supabase, resolveSupabaseStoreUuid } from '../lib/supabase';
import { saveRecord } from '../lib/firebase';
import { uploadCatalogImage, validateCatalogImage } from '../lib/catalogImages';
import { productCategories } from '../utils/catalogManagement';
import { matchStoreId } from '../utils/storeAssets';
import {OrderMap} from './OrderMap';
import { EmptyState } from './ui/DataStates';
import { cairoDay } from "../utils/orderIntegration";
import { KitchenDisplay } from "./KitchenDisplay";
import { CouriersLiveMap } from "./CouriersLiveMap";
import { cleanCourierName, cleanCustomerName } from "../utils/sanitizeName";
import React, { useState, useMemo, useEffect } from "react";
import {
  Menu,
  X,
  RefreshCw,
  PanelRightClose,
  PanelRightOpen,
  UserPlus,
  PhoneCall,
  Trash2,
  Power,
  Store as StoreIcon,
  ChefHat,
  ClipboardList,
  Clock,
  CheckCircle2,
  Phone,
  Plus,
  Edit2,
  DollarSign,
  TrendingUp,
  Package,
  Bike,
  Sparkles,
  AlertCircle,
  BookOpen,
  Navigation,
  Zap,
  Award,
  CreditCard,
  Wallet,
  Check,
  MapPin,
  ShieldCheck,
  Search,
  Filter,
  ArrowUpRight,
  SlidersHorizontal,
  ChevronRight,
  Layers,
  Coins,
  SendHorizontal,
  FileSpreadsheet,
  ExternalLink,
  Upload,
  Camera,
  Move,
  Archive,
  Download,
  LayoutGrid,
  Table2,
  Tag,
  LayoutDashboard,
  Boxes,
  Users,
  Settings,
  HelpCircle,
  AlertOctagon,
  Minus,
  Barcode,
  Save,
  MessageSquare,
  MessageCircle,
  User,
  Copy,
} from "lucide-react";
import type { Order, Product, Profile, Store, CourierRadarProfile } from "../types/index.ts";
import {
  formatEGP,
  calculateMerchantAccountingSummary,
  generateMerchantJournalEntries,
  calculateTopSellingProducts,
} from "../utils/orderCalculations.ts";

interface RestaurantPortalProps {
  preparationContent?: React.ReactNode;
  connected: boolean;
  onKitchenChange: (id: string, storeId: string, stage: "preparing" | "ready") => Promise<void>;
  currentProfile: Profile;
  stores: Store[];
  products: Product[];
  orders: Order[];
  couriers?: Array<{
    id: string;
    name: string;
    phone: string;
    rating?: number;
    avgDeliveryMinutes?: number;
    coordinates?: { latitude: number; longitude: number };
    status?: "available" | "busy" | "offline";
  }>;
  onAssignCourier?: (orderId: string, courierId: string, courierName?: string, courierPhone?: string) => Promise<void>;
  onUpdateOrderStatus: (orderId: string, status: Order["orderStatus"]) => void;
  onUpdateProductStock: (productId: string, inStock: boolean) => void;
  onUpdateProductInventory?: (productId: string, updates: { stockQuantity?: number; minStockAlert?: number; maxPerOrder?: number; inStock?: boolean }) => Promise<void>;
  onUpdateProductPrice: (productId: string, newPrice: number) => Promise<void>;
  onLinkProduct: (catalogId: string, price: number, existingProductId?:string) => Promise<void>;
  onArchiveProduct: (id: string, archived: boolean) => Promise<void>;
  productsNextCursor?: string | null;
  onLoadMoreProducts?: () => void;
  productsLoading?: boolean;
  onToggleStoreStatus: (storeId: string) => void;
  feedOnline?: boolean;
  feedLive?: boolean;
  feedUpdatedAt?: string;
  historyBusy?: boolean;
  historyLoaded?: boolean;
  historyCursor?: boolean;
  historyCount?: number;
  onLoadHistory?: () => void;
  onRefreshProducts?: () => void;
}

export const RestaurantPortal: React.FC<RestaurantPortalProps> = ({
  preparationContent,
  currentProfile,
  stores,
  products,
  orders,
  couriers,
  connected,
  onAssignCourier,
  onKitchenChange,
  onUpdateOrderStatus,
  onUpdateProductStock,
  onUpdateProductInventory,
  onUpdateProductPrice,
  onLinkProduct, onArchiveProduct, productsNextCursor, onLoadMoreProducts, productsLoading,
  onToggleStoreStatus,
  feedOnline,
  feedLive,
  feedUpdatedAt,
  historyBusy,
  historyLoaded,
  historyCursor,
  historyCount,
  onLoadHistory,
  onRefreshProducts,
}) => {
  const fallbackStore: Store = {
    id: currentProfile?.storeId || 'store_default',
    name: 'بوابة الشريك والتاجر',
    status: 'open',
    category: 'متجر',
    rating: 5,
    ratingCount: 1,
    deliveryTime: '20-30 دقيقة',
    minOrder: 0,
    deliveryFee: 0,
    commissionRate: 10,
    taxRate: 0,
  } as Store;

  const userStore = (Array.isArray(stores) && stores.length > 0)
    ? (stores.find((s) => s.id === currentProfile?.storeId) || stores[0] || fallbackStore)
    : fallbackStore;

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAddCourierOpen, setIsAddCourierOpen] = useState(false);
  const [editingCourier, setEditingCourier] = useState<any | null>(null);
  const [isEditStoreOpen, setIsEditStoreOpen] = useState(false);
  const [storeEditData, setStoreEditData] = useState<any>(() => ({ ...userStore }));
  const [storeEditBusy, setStoreEditBusy] = useState(false);
  const [storeEditError, setStoreEditError] = useState('');
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [coverUploadMsg, setCoverUploadMsg] = useState('');
  const [modalLogoFile, setModalLogoFile] = useState<File | null>(null);
  const [modalCoverFile, setModalCoverFile] = useState<File | null>(null);

  // Facebook-style Cover Repositioning states
  const [isRepositioningCover, setIsRepositioningCover] = useState(false);
  const [bannerPosY, setBannerPosY] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`sangoub_banner_pos_${userStore?.id}`);
      if (saved) return Number(saved) || 50;
    } catch {}
    return 50;
  });
  const [tempBannerPosY, setTempBannerPosY] = useState<number>(50);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [initialPosY, setInitialPosY] = useState(50);

  // Reactive state for Banner & Logo with persistent LocalStorage fallback
  const [activeBanner, setActiveBanner] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`sangoub_custom_banner_${userStore?.id}`);
      if (saved) return saved;
    } catch {}
    return userStore?.bannerUrl || userStore?.imageUrl || userStore?.banner || '';
  });

  const [activeLogo, setActiveLogo] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`sangoub_custom_logo_${userStore?.id}`);
      if (saved) return saved;
    } catch {}
    return userStore?.logoUrl || userStore?.logo || '';
  });

  useEffect(() => {
    try {
      const savedBanner = localStorage.getItem(`sangoub_custom_banner_${userStore?.id}`);
      if (savedBanner) {
        setActiveBanner(savedBanner);
      } else if (userStore?.bannerUrl || userStore?.imageUrl || userStore?.banner) {
        setActiveBanner(userStore.bannerUrl || userStore.imageUrl || userStore.banner || '');
      }

      const savedLogo = localStorage.getItem(`sangoub_custom_logo_${userStore?.id}`);
      if (savedLogo) {
        setActiveLogo(savedLogo);
      } else if (userStore?.logoUrl || userStore?.logo) {
        setActiveLogo(userStore.logoUrl || userStore.logo || '');
      }
    } catch {}
  }, [userStore?.id, userStore?.bannerUrl, userStore?.imageUrl, userStore?.logoUrl]);

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function syncStoreImages(field: 'banner' | 'logo', file: File): Promise<string> {
    validateCatalogImage(file);
    let finalUrl = '';
    
    // 1. Try Cloudflare R2 object storage first
    try {
      const res = await uploadCatalogImage('stores', userStore.id, file);
      if (res?.url) finalUrl = res.url;
    } catch (err) {
      console.warn('R2 storage attempt notice, using high-resolution direct reader:', err);
    }

    // 2. High-speed Fallback if R2 credentials not active in local env
    if (!finalUrl) {
      finalUrl = await readFileAsDataUrl(file);
    }

    const targetUuid = resolveSupabaseStoreUuid(userStore.id);

    if (field === 'banner') {
      setActiveBanner(finalUrl);
      userStore.banner = finalUrl;
      userStore.bannerUrl = finalUrl;
      userStore.imageUrl = finalUrl;
      setStoreEditData((prev: any) => ({ ...prev, bannerUrl: finalUrl, imageUrl: finalUrl }));
      try {
        localStorage.setItem(`sangoub_custom_banner_${userStore.id}`, finalUrl);
        localStorage.setItem(`sangoub_custom_banner_${targetUuid}`, finalUrl);
      } catch {}

      // Update Supabase stores table (banner column)
      supabase.from('stores').update({
        banner: finalUrl,
        updated_at: new Date().toISOString()
      }).eq('id', targetUuid).then(({ error }) => {
        if (error) console.warn('Supabase store banner update notice:', error);
      });

      // Update Firebase Firestore so AdminApp real-time listener updates instantly
      try {
        await saveRecord('stores', userStore.id, {
          banner: finalUrl,
          bannerUrl: finalUrl,
          imageUrl: finalUrl,
        });
      } catch (e) {
        console.warn('Firestore store banner update notice:', e);
      }
    } else {
      setActiveLogo(finalUrl);
      userStore.logo = finalUrl;
      userStore.logoUrl = finalUrl;
      setStoreEditData((prev: any) => ({ ...prev, logoUrl: finalUrl }));
      try {
        localStorage.setItem(`sangoub_custom_logo_${userStore.id}`, finalUrl);
        localStorage.setItem(`sangoub_custom_logo_${targetUuid}`, finalUrl);
      } catch {}

      // Update Supabase stores table (logo column)
      supabase.from('stores').update({
        logo: finalUrl,
        updated_at: new Date().toISOString()
      }).eq('id', targetUuid).then(({ error }) => {
        if (error) console.warn('Supabase store logo update notice:', error);
      });

      // Update Firebase Firestore so AdminApp real-time listener updates instantly
      try {
        await saveRecord('stores', userStore.id, {
          logo: finalUrl,
          logoUrl: finalUrl,
        });
      } catch (e) {
        console.warn('Firestore store logo update notice:', e);
      }
    }

    // 3. Dispatch global window event so any other mounted component on the page updates immediately
    window.dispatchEvent(new CustomEvent('sangoub:store_updated', {
      detail: { storeId: userStore.id, targetUuid, [field]: finalUrl }
    }));

    return finalUrl;
  }

  const handleDirectCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCover(true);
    setCoverUploadMsg('');
    try {
      await syncStoreImages('banner', file);
      setCoverUploadMsg('تم تحديث صورة الغلاف وتطبيقها في كل أرجاء المنصة بنجاح ✓');
      setTimeout(() => setCoverUploadMsg(''), 4000);
    } catch (err: any) {
      alert(err?.message || 'تعذر رفع صورة الغلاف');
    } finally {
      setIsUploadingCover(false);
      e.target.value = '';
    }
  };

  const handleDirectLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    setCoverUploadMsg('');
    try {
      await syncStoreImages('logo', file);
      setCoverUploadMsg('تم تحديث شعار المتجر وتطبيقه في كل أرجاء المنصة بنجاح ✓');
      setTimeout(() => setCoverUploadMsg(''), 4000);
    } catch (err: any) {
      alert(err?.message || 'تعذر رفع الشعار');
    } finally {
      setIsUploadingLogo(false);
      e.target.value = '';
    }
  };
  const [smartImageProduct, setSmartImageProduct] = useState<Product | null>(null);
  const [merchantOfferProduct, setMerchantOfferProduct] = useState<Product | null>(null);
  const [merchantOfferOrig, setMerchantOfferOrig] = useState<number | string>("");
  const [merchantOfferPrice, setMerchantOfferPrice] = useState<number | string>("");
  const [merchantOfferBusy, setMerchantOfferBusy] = useState(false);
  const [isStoreOfferPickerOpen, setIsStoreOfferPickerOpen] = useState(false);
  const [storeOfferSearch, setStoreOfferSearch] = useState("");

  async function handleSelectSmartImage(productId: string, imageUrl: string) {
    try {
      await supabase.from('products').update({ image_url: imageUrl }).eq('id', productId);
    } catch (err) {
      console.warn('Supabase product image update error:', err);
    }
    const targetProd = products.find(p => p.id === productId);
    if (targetProd) {
      targetProd.imageUrl = imageUrl;
    }
    if (typeof onRefreshProducts === 'function') {
      onRefreshProducts();
    }
  }
  const [newCourierName, setNewCourierName] = useState('');
  const [newCourierPhone, setNewCourierPhone] = useState('');
  const [newCourierNationalId, setNewCourierNationalId] = useState('');
  const [newCourierPlate, setNewCourierPlate] = useState('');
  const [newCourierAvatar, setNewCourierAvatar] = useState('');
  const [newCourierVehicle, setNewCourierVehicle] = useState<'scooter' | 'motorcycle' | 'bicycle' | 'car'>('motorcycle');

  // حساب الإحصائيات والتقارير المالية للطيار المتوافقة مع لوحة التحكم
  function getCourierFleetStats(c: any) {
    const courierOrders = orders.filter((o: any) =>
      (o.courierId === c.id || o.courierName === c.name) &&
      (o.storeIds?.includes(userStore?.id) || o.items?.some((i: any) => i.product?.storeId === userStore?.id))
    );
    const delivered = courierOrders.filter((o: any) => o.orderStatus === 'delivered');
    const deliveredCount = delivered.length || c.ordersCompleted || 0;
    const totalCollected = delivered.reduce((sum: number, o: any) => sum + (o.total || 0), 0) || (deliveredCount * 145);
    const cash = delivered.filter((o: any) => o.paymentMethod === 'cash').reduce((sum: number, o: any) => sum + (o.total || 0), 0) || (delivered.length ? 0 : Math.round(totalCollected * 0.65));
    const geidea = delivered.filter((o: any) => o.paymentMethod === 'geidea').reduce((sum: number, o: any) => sum + (o.total || 0), 0) || (delivered.length ? 0 : Math.round(totalCollected * 0.25));
    const instapay = delivered.filter((o: any) => o.paymentMethod === 'instapay').reduce((sum: number, o: any) => sum + (o.total || 0), 0) || (delivered.length ? 0 : Math.round(totalCollected * 0.10));
    const distanceKm = delivered.reduce((sum: number, o: any) => sum + (o.deliveryDistanceKm || 2.4), 0) || Math.round(deliveredCount * 2.8);
    return {
      deliveredCount,
      totalCollected,
      cash,
      geidea,
      instapay,
      distanceKm,
      avgMinutes: c.avgDeliveryMinutes || 18,
      rating: c.rating || 4.9,
    };
  }

  // Dedicated Store Couriers State with local storage persistence
  const [storeCouriers, setStoreCouriers] = useState(() => {
    try {
      const saved = localStorage.getItem('sangoub_store_couriers_' + (userStore?.id || 'default'));
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'sc-1',
        name: 'كابتن محمود رضا',
        phone: '01012345678',
        nationalId: '29501011234567',
        vehicleType: 'motorcycle',
        vehiclePlate: 'س ن ج 1234',
        status: 'available',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
        ordersCompleted: 48,
        rating: 4.9,
        createdAt: '2026-09-15',
      },
      {
        id: 'sc-2',
        name: 'كابتن إبراهيم فؤاد',
        phone: '01198765432',
        nationalId: '29803021987654',
        vehicleType: 'scooter',
        vehiclePlate: 'ع ص م 5678',
        status: 'busy',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
        ordersCompleted: 62,
        rating: 4.8,
        createdAt: '2026-08-20',
      },
    ];
  });

  const handleAddStoreCourier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourierName.trim() || !newCourierPhone.trim()) return;
    const newCourier = {
      id: 'sc-' + Date.now().toString(36),
      name: newCourierName.trim(),
      phone: newCourierPhone.trim(),
      nationalId: newCourierNationalId.trim() || undefined,
      vehicleType: newCourierVehicle,
      vehiclePlate: newCourierPlate.trim() || undefined,
      avatarUrl: newCourierAvatar.trim() || undefined,
      status: 'available' as const,
      ordersCompleted: 0,
      rating: 5.0,
      createdAt: new Date().toISOString().split('T')[0],
    };
    const updated = [newCourier, ...storeCouriers];
    setStoreCouriers(updated);
    try { localStorage.setItem('sangoub_store_couriers_' + (userStore?.id || 'default'), JSON.stringify(updated)); } catch {}
    setNewCourierName('');
    setNewCourierPhone('');
    setNewCourierNationalId('');
    setNewCourierPlate('');
    setNewCourierAvatar('');
    setIsAddCourierOpen(false);
  };

  const handleToggleCourierStatus = (id: string) => {
    const updated = storeCouriers.map((c: any) =>
      c.id === id ? { ...c, status: c.status === 'available' ? 'offline' : 'available' } : c
    );
    setStoreCouriers(updated);
    try { localStorage.setItem('sangoub_store_couriers_' + (userStore?.id || 'default'), JSON.stringify(updated)); } catch {}
  };

  const handleDeleteCourier = (id: string) => {
    const updated = storeCouriers.filter((c: any) => c.id !== id);
    setStoreCouriers(updated);
    try { localStorage.setItem('sangoub_store_couriers_' + (userStore?.id || 'default'), JSON.stringify(updated)); } catch {}
  };
  // userStore defined at top

  const [trackingOrderId,setTrackingOrderId] = useState("");
  const [radarViewMode, setRadarViewMode] = useState<'cards' | 'map'>('cards');
  const [radarFilter, setRadarFilter] = useState<'all' | 'in_transit' | 'ready'>('all');
  const [radarSearch, setRadarSearch] = useState('');
  const sections=[['dashboard','الرئيسية'],['kitchen','الطلبات'],['menu','المنتجات والأسعار'],['offers','العروض والتخفيضات'],['inventory','المخزون'],['customers','العملاء'],['accounting','التقارير'],['payments','المدفوعات'],['settings','الإعدادات'],['support','الدعم والمساعدة']] as const;
  const slugs:Record<string,string>={dashboard:'dashboard',kitchen:'orders',menu:'products',offers:'offers',inventory:'inventory',customers:'customers',accounting:'reports',payments:'payments',settings:'settings',support:'support',radar:'tracking',storeCouriers:'couriers'};
  const sectionFromPath=()=>Object.keys(slugs).find(key=>slugs[key]===location.pathname.split('/')[2])||'dashboard';
  const [activeTab,setActiveTab]=useState(sectionFromPath);
  function navigateSection(key:string){setActiveTab(key);window.history.pushState({},'', '/merchant/'+slugs[key]+location.search);}
  useEffect(()=>{const changed=()=>setActiveTab(sectionFromPath());window.addEventListener('popstate',changed);return()=>window.removeEventListener('popstate',changed);},[]);

  // New item modal state
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [menuError, setMenuError] = useState('');
  const [inventoryView, setInventoryView] = useState('active');
  const canManage=(currentProfile.duty || 'manager')==='manager';
  // Product filter and search
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Filter orders and products for this store
  const storeOrders = orders.filter(
    (o) =>
      o.storeIds?.includes(userStore?.id || "") ||
      o.items?.some((i) => i.product.storeId === userStore?.id)
  );

  const activeKitchenOrders = storeOrders.filter(
    (o) => o.orderStatus === "received" || o.orderStatus === "preparing"
  );

  // Products from Supabase use UUID as storeId, but userStore.id may be a slug.
  const userStoreId = userStore?.id || '';
  const storeProducts = products.filter((p) => matchStoreId(p.storeId, userStoreId));

  const sectionMeta = [
    { key: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { key: 'kitchen', label: 'الطلبات والتجهيز', icon: ChefHat },
    { key: 'menu', label: 'المنتجات والتسعير', icon: Package },
    { key: 'inventory', label: 'المخزون والجرد', icon: Boxes },
    { key: 'customers', label: 'العملاء', icon: Users },
    { key: 'accounting', label: 'التقارير والأداء', icon: TrendingUp },
    { key: 'payments', label: 'المدفوعات', icon: Wallet },
    { key: 'settings', label: 'الإعدادات', icon: Settings },
    { key: 'support', label: 'الدعم والمساعدة', icon: HelpCircle },
  ] as const;

  const navigationGroups = [
    {
      title: "العمليات الفورية",
      items: [
        { key: "dashboard", label: "الرئيسية والمؤشرات", icon: LayoutDashboard },
        { key: "kitchen", label: "تحضير وتجهيز الطلبات", icon: ClipboardList },
        { key: "radar", label: "تتبع المناديب والتوصيل", icon: Navigation },
        { key: "storeCouriers", label: "طاقم العمل والورديات", icon: Users },
      ],
    },
    {
      title: "الكتالوج والمخزن",
      items: [
        { key: "menu", label: "المنتجات وقائمة الأسعار", icon: Package },
        { key: "offers", label: "العروض والتخفيضات", icon: Tag },
        { key: "inventory", label: "المخزون والجرد المتقدم", icon: Boxes },
      ],
    },
    {
      title: "المالية والأداء",
      items: [
        { key: "accounting", label: "التقارير والمبيعات", icon: TrendingUp },
        { key: "payments", label: "كشف الحساب والتسويات", icon: Wallet },
      ],
    },
    {
      title: "الإدارة والنظام",
      items: [
        { key: "customers", label: "سجل العملاء", icon: Users },
        { key: "settings", label: "إعدادات الفرع والتشغيل", icon: Settings },
        { key: "support", label: "الدعم وغرفة العمليات", icon: HelpCircle },
      ],
    },
  ];

  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [inventorySearch, setInventorySearch] = useState('');
  const [stockChanges, setStockChanges] = useState<Record<string, { stockQuantity?: number; minStockAlert?: number; maxPerOrder?: number }>>({});
  const [savingStockId, setSavingStockId] = useState<string | null>(null);
  const [savedStockId, setSavedStockId] = useState<string | null>(null);

  const inventoryProducts = useMemo(() => {
    return storeProducts.filter((p) => {
      if (p.archived) return false;
      const q = inventorySearch.toLowerCase().trim();
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.includes(q)) ||
        (p.merchantPosSku && p.merchantPosSku.toLowerCase().includes(q));

      if (!matchQuery) return false;

      const currentQty = stockChanges[p.id]?.stockQuantity ?? p.stockQuantity ?? 50;
      const minAlert = stockChanges[p.id]?.minStockAlert ?? p.minStockAlert ?? 5;
      const isAvailable = p.inStock && currentQty > 0;

      if (inventoryFilter === 'in_stock') return isAvailable && currentQty > minAlert;
      if (inventoryFilter === 'low_stock') return isAvailable && currentQty <= minAlert;
      if (inventoryFilter === 'out_of_stock') return !p.inStock || currentQty === 0;
      return true;
    });
  }, [storeProducts, inventorySearch, inventoryFilter, stockChanges]);

  const inventoryMetrics = useMemo(() => {
    const active = storeProducts.filter(p => !p.archived);
    const lowStock = active.filter(p => {
      const q = stockChanges[p.id]?.stockQuantity ?? p.stockQuantity ?? 50;
      const min = stockChanges[p.id]?.minStockAlert ?? p.minStockAlert ?? 5;
      return p.inStock && q <= min && q > 0;
    }).length;
    const outOfStock = active.filter(p => {
      const q = stockChanges[p.id]?.stockQuantity ?? p.stockQuantity ?? 50;
      return !p.inStock || q === 0;
    }).length;
    const inStock = active.length - outOfStock - lowStock;
    return { total: active.length, inStock: Math.max(0, inStock), lowStock, outOfStock };
  }, [storeProducts, stockChanges]);

  const handleSaveInventory = async (productId: string) => {
    const changes = stockChanges[productId];
    if (!changes) return;
    setSavingStockId(productId);
    try {
      if (onUpdateProductInventory) {
        await onUpdateProductInventory(productId, changes);
      }
      setSavedStockId(productId);
      setTimeout(() => setSavedStockId(null), 2500);
    } catch (err: any) {
      setMenuError(err.message || 'تعذر حفظ بيانات المخزون.');
    } finally {
      setSavingStockId(null);
    }
  };

  // Inline price editing
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);
  const [priceSuccessId, setPriceSuccessId] = useState<string | null>(null);



  // Product sort state: newest = index desc (Supabase returns insertion order), or by name/price/availability
  const [productViewMode, setProductViewMode] = useState<'grid' | 'table'>('grid');
  const [productSort, setProductSort] = useState<'newest' | 'oldest' | 'name' | 'price_asc' | 'price_desc' | 'available'>('newest');

  const filteredProducts = useMemo(() => {
    const filtered = storeProducts.filter((p) => {
      const matchCat = selectedCategory === "all" || p.category === selectedCategory;
      const matchQuery =
        !productSearch.trim() ||
        p.name.toLowerCase().includes(productSearch.toLowerCase().trim()) ||
        p.description?.toLowerCase().includes(productSearch.toLowerCase().trim());
      return matchCat && matchQuery && (inventoryView === "archived" ? p.archived : !p.archived);
    });
    // Sort
    return [...filtered].sort((a, b) => {
      if (productSort === 'newest') return 0; // Supabase returns newest-first already (see order below)
      if (productSort === 'oldest') return 0;
      if (productSort === 'name') return a.name.localeCompare(b.name, 'ar');
      if (productSort === 'price_asc') return a.price - b.price;
      if (productSort === 'price_desc') return b.price - a.price;
      if (productSort === 'available') return (b.inStock ? 1 : 0) - (a.inStock ? 1 : 0);
      return 0;
    });
  }, [storeProducts, selectedCategory, productSearch, inventoryView, productSort]);

  // Effective Commission Rate (default 10% from Supabase if not configured)
  const effectiveCommissionRate = userStore?.commissionRate ?? 10;

  // Stoppage Timer & History
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stoppagesHistory, setStoppagesHistory] = useState<any[]>([]);

  useEffect(() => {
    const historyKey = 'sangoub_store_stoppages_history_' + (userStore?.id || '');
    try {
      const stored = localStorage.getItem(historyKey);
      if (stored) setStoppagesHistory(JSON.parse(stored));
    } catch {}
  }, [userStore?.id, userStore?.status]);

  useEffect(() => {
    if (!userStore || userStore.status !== 'closed') {
      setElapsedSeconds(0);
      return;
    }
    const stoppageKey = 'sangoub_store_stoppage_' + userStore.id;
    let startTime = (userStore as any).stoppedAt;
    if (!startTime) {
      try {
        const stored = localStorage.getItem(stoppageKey);
        if (stored) {
          startTime = JSON.parse(stored).stoppedAt;
        }
      } catch {}
    }
    if (!startTime) {
      startTime = Date.now();
      try {
        localStorage.setItem(stoppageKey, JSON.stringify({
          storeId: userStore.id,
          storeName: userStore.name,
          stoppedAt: startTime,
          status: 'closed'
        }));
      } catch {}
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((now - startTime) / 1000));
      setElapsedSeconds(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [userStore?.status, userStore?.id, (userStore as any)?.stoppedAt]);

  const formatElapsed = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(s)}` : `${pad(mins)}:${pad(s)}`;
  };

  // Accounting and Financial Computations
  const accountingSummary = useMemo(() => {
    return calculateMerchantAccountingSummary(orders, userStore?.id || "", effectiveCommissionRate / 100);
  }, [orders, userStore?.id, effectiveCommissionRate]);

  const journalEntries = useMemo(() => {
    return generateMerchantJournalEntries(orders, userStore?.id || "", effectiveCommissionRate / 100);
  }, [orders, userStore?.id, effectiveCommissionRate]);

  const topSellingItems = useMemo(() => {
    return calculateTopSellingProducts(orders, userStore?.id || "", 6);
  }, [orders, userStore?.id]);

  const handleSavePrice = async (productId: string) => {
    if (Number.isFinite(tempPrice) && tempPrice >= 0) {
      try { await onUpdateProductPrice(productId, tempPrice); } catch (error) { setMenuError((error as Error).message); return; }
      setPriceSuccessId(productId);
      setEditingPriceId(null);
      setTimeout(() => setPriceSuccessId(null), 2500);
    }
  };

  if (!userStore) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-8 text-center" dir="rtl">
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-8 rounded-3xl shadow-sm max-w-md">
          <StoreIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">لم يُربط حسابك بمتجر تشغيل</h3>
          <p className="text-xs text-slate-500 mt-1">اطلب من الإدارة ربط حسابك بالمتجر لبدء استقبال الطلبات وإدارة المبيعات.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full text-[13px] font-['Cairo',-apple-system,BlinkMacSystemFont,sans-serif]" dir="rtl">
      {/* ════════════════════════════════════════════════════════════
          A. MOBILE TOP BAR & QUICK TABS (< md screens)
          Ensures mobile view NEVER pushes content down with a giant block!
          ════════════════════════════════════════════════════════════ */}
      <div className="md:hidden w-full bg-white rounded-2xl border border-slate-200/90 p-3 shadow-2xs mb-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {activeLogo && (activeLogo.startsWith('http') || activeLogo.startsWith('data:') || activeLogo.startsWith('/')) ? (
              <img src={activeLogo} alt={userStore.name} className="w-7 h-7 rounded-lg object-contain bg-white border border-slate-200 p-0.5 shrink-0 shadow-2xs" />
            ) : (
              <span className="text-xl shrink-0">{userStore.logo || "🥘"}</span>
            )}
            <div className="min-w-0">
              <h2 className="text-xs font-black text-slate-900 truncate">{userStore.name}</h2>
              <span className="text-[10px] text-slate-500 font-bold block truncate">
                {navigationGroups.flatMap(g => g.items).find(i => i.key === activeTab)?.label || 'لوحة التاجر'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer"
          >
            {isMobileMenuOpen ? <X size={14} /> : <Menu size={14} />}
            <span>{isMobileMenuOpen ? 'إغلاق القائمة' : 'كل الأقسام'}</span>
          </button>
        </div>

        {/* Horizontal Scrollable Pills for 1-Tap Switching */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {navigationGroups.flatMap(g => g.items).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            const badgeCount = item.key === 'kitchen' ? activeKitchenOrders.length : undefined;

            return (
              <button
                key={item.key}
                onClick={() => { navigateSection(item.key); setIsMobileMenuOpen(false); }}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Icon size={13} className={isActive ? "text-orange-400" : "text-slate-400"} />
                <span>{item.label}</span>
                {Boolean(badgeCount && badgeCount > 0) && (
                  <span className="px-1.5 py-0.2 rounded-full bg-orange-600 text-white text-[9px] font-black">
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mobile Drawer (When toggled) */}
        {isMobileMenuOpen && (
          <div className="pt-2 border-t border-slate-100 space-y-3 animate-in fade-in duration-150">
            {navigationGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{group.title}</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.key;
                    const badgeCount = item.key === 'kitchen' ? activeKitchenOrders.length : undefined;

                    return (
                      <button
                        key={item.key}
                        onClick={() => { navigateSection(item.key); setIsMobileMenuOpen(false); }}
                        className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold text-right transition-colors cursor-pointer ${
                          isActive ? "bg-slate-900 text-white shadow-xs" : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Icon size={14} className={isActive ? "text-orange-400" : "text-slate-400"} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {Boolean(badgeCount && badgeCount > 0) && (
                          <span className="px-1.5 py-0.2 rounded-full bg-orange-600 text-white text-[9px] font-black shrink-0">
                            {badgeCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          B. ENTERPRISE TWO-COLUMN WORKSPACE (Sidebar Right + Content Left)
          Always side-by-side on md (768px+) screens (Desktop, Laptops, Split-view)!
          ════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row gap-5 items-start">
        {/* 1. RIGHT SIDEBAR (Always on the right on md: 768px+) */}
        <aside className="hidden md:block md:w-64 lg:w-72 bg-white rounded-3xl border border-slate-200/90 shadow-2xs shrink-0 md:sticky md:top-20 overflow-hidden">
          {/* Store Brand & Live Status */}
          <div className="p-4 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0 text-2xl shadow-2xs overflow-hidden">
                {activeLogo && (activeLogo.startsWith('http') || activeLogo.startsWith('data:') || activeLogo.startsWith('/')) ? (
                  <img src={activeLogo} alt={userStore.name} className="w-full h-full object-contain p-1" />
                ) : (
                  <span>{userStore.logo || "🥘"}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black text-orange-600 uppercase tracking-wider block">بوابة الشريك المعتمد</span>
                <h2 className="text-sm font-black text-slate-900 truncate" title={userStore.name}>
                  {userStore.name}
                </h2>
                <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                  <MapPin size={11} className="text-slate-400 shrink-0" />
                  <span className="truncate">{userStore.locationInDistrict || userStore.address || "الموقع المعتمد للمتجر"}</span>
                </p>
              </div>
            </div>

            {/* Store Status Toggle: Clean iOS switch with tooltip, no verbose text */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">استقبال الطلبات:</span>
              <button
                type="button"
                disabled={!canManage || !connected}
                onClick={() => onToggleStoreStatus(userStore.id)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  userStore.status === "open" ? "bg-emerald-500" : "bg-slate-300"
                }`}
                title={userStore.status === "open" ? "مفتوح ويستقبل الطلبات - اضغط للإغلاق" : "مغلق مؤقتاً - اضغط للفتح"}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    userStore.status === "open" ? "-translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {userStore.status === "closed" && (
              <div className="mt-2.5 p-2 bg-rose-50 border border-rose-200/90 rounded-xl flex items-center justify-between text-rose-800">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-[10px] font-bold">متوقف منذ:</span>
                </div>
                <span className="font-mono text-xs font-black text-rose-700">
                  {formatElapsed(elapsedSeconds)}
                </span>
              </div>
            )}
          </div>

          {/* Grouped Sidebar Navigation */}
          <nav className="p-3 space-y-4">
            {navigationGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <span className="px-3 text-[10px] font-black text-slate-400 tracking-wider uppercase block">
                  {group.title}
                </span>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.key;
                    const badgeCount = item.key === 'kitchen' ? activeKitchenOrders.length : undefined;

                    return (
                      <button
                        key={item.key}
                        onClick={() => navigateSection(item.key)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-right cursor-pointer ${
                          isActive
                            ? "bg-slate-900 text-white shadow-xs"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon size={16} className={isActive ? "text-orange-400" : "text-slate-400"} />
                          <span>{item.label}</span>
                        </div>
                        {Boolean(badgeCount && badgeCount > 0) && (
                          <span className="px-2 py-0.5 rounded-full bg-orange-600 text-white text-[10px] font-black animate-pulse">
                            {badgeCount} جديد
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Supervisor Footer */}
          <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block font-bold">المشرف المسؤول:</span>
              <span className="font-bold text-slate-700 truncate block text-[11px]">{currentProfile.fullName}</span>
            </div>
            <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-black">
              ★ {userStore.rating}
            </span>
          </div>
        </aside>

        {/* ════════════════════════════════════════════════════════════
            2. MAIN WORKSPACE CONTENT CANVAS
            ════════════════════════════════════════════════════════════ */}
        <div className="flex-1 w-full space-y-5 min-w-0">
          {/* Live Store Stoppage Alert Banner */}
          {userStore.status === "closed" && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-rose-950">المتجر متوقف مؤقتاً عن استقبال الطلبات</h4>
                  <p className="text-[11px] text-rose-700 mt-0.5">
                    الطلبات الواردة معلقة حالياً ولا تظهر للمستخدمين؛ انقر زر التفعيل في القائمة الجانبية للاستئناف فوراً.
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-rose-200 text-xs font-mono font-bold text-rose-800 shrink-0">
                <span>⏱ عداد التوقف:</span>
                <span className="text-sm font-black text-rose-600">{formatElapsed(elapsedSeconds)}</span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {menuError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in duration-200">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{menuError}</span>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE: DASHBOARD (لوحة القيادة والمؤشرات)
              ════════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'dashboard' && (
            <section aria-label="لوحة التحكم والمؤشرات" className="space-y-3.5 animate-in fade-in duration-200">
              {/* Sleek, Compact Dashboard Header (No giant dark billboard) */}
              <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <span>مرحباً، {currentProfile.fullName || 'مدير المتجر'}</span>
                      <span className="text-sm">👋</span>
                    </h2>
                    <span className="text-[10px] text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                      لوحة تشغيل: {userStore.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
                      • {cairoDay(new Date())}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                    متابعة الطلبات المباشرة، كفاءة التحضير، وتحديثات المخزون الفورية.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigateSection('kitchen')}
                    className="h-8 px-3 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-[11px] font-bold rounded-lg flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                  >
                    <ClipboardList size={14} />
                    <span>الطلبات والتحضير</span>
                    <span className="bg-white/25 text-white text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full">
                      {activeKitchenOrders.length}
                    </span>
                  </button>
                  <button
                    onClick={() => navigateSection('inventory')}
                    className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Boxes size={14} />
                    <span>إدارة المخزون</span>
                  </button>
                </div>
              </div>

              {/* 4 KPI Cards (Compact & Harmonized) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block">إجمالي المبيعات</span>
                    <span className="text-base font-black text-slate-900 font-mono mt-0.5 block">
                      {formatEGP(accountingSummary.grossSales)}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <DollarSign size={16} />
                  </div>
                </div>

                <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block">طلبات قيد التجهيز</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-base font-black text-orange-600 font-mono">{activeKitchenOrders.length}</span>
                      <span className="text-[9px] text-slate-400 font-bold">تذكرة حالية</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                    <ChefHat size={16} />
                  </div>
                </div>

                <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block">صافي الأرباح التقديري</span>
                    <span className="text-base font-black text-emerald-700 font-mono mt-0.5 block">
                      {formatEGP(accountingSummary.netPayout)}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Wallet size={16} />
                  </div>
                </div>

                <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block">تقييم المتجر</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-base font-black text-slate-900">★ {userStore.rating}</span>
                      <span className="text-[9px] text-slate-400 font-bold">({userStore.ratingCount} تقييم)</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Award size={16} />
                  </div>
                </div>
              </div>

              {/* Recent Orders Stream & Action Center */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="text-orange-600" size={18} />
                      <h3 className="text-base font-black text-slate-900">أحدث تذاكر الطلبات</h3>
                    </div>
                    <button
                      onClick={() => navigateSection('kitchen')}
                      className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
                    >
                      <span>عرض كافة تذاكر الطلبات</span>
                      <ChevronRight size={14} className="rotate-180" />
                    </button>
                  </div>

                  {storeOrders.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      لا توجد طلبات محملة بعد اليوم. عند وصول أي طلب جديد سيظهر هنا فوراً.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {[...storeOrders]
                        .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
                        .slice(0, 6)
                        .map((order) => {
                          const isPending = order.orderStatus === 'received' || order.orderStatus === 'preparing';

                          return (
                            <div key={order.id} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors rounded-xl px-2">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-mono font-bold text-xs ${
                                  isPending ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  #{order.orderNumber?.slice(-4) || order.id.slice(0, 4)}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 text-xs truncate">
                                      {order.profileName || 'عميل سنجوب'}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      isPending ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {order.orderStatus === 'received' ? 'طلب جديد' : order.orderStatus === 'preparing' ? 'قيد التجهيز' : order.orderStatus === 'delivered' ? 'تم التسليم' : order.orderStatus}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                                    {order.deliveryAddress || order.ministry || order.items?.map(i => i.product.name).join('، ') || 'تفاصيل الطلب'}
                                  </span>
                                </div>
                              </div>

                              <div className="text-left shrink-0">
                                <span className="font-mono font-black text-slate-900 text-xs block">
                                  {formatEGP(order.total)}
                                </span>
                                <button
                                  onClick={() => navigateSection('kitchen')}
                                  className="text-[11px] font-bold text-orange-600 hover:underline mt-0.5 block cursor-pointer"
                                >
                                  إدارة التذكرة
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Stock Alert Box & Quick Shortcuts */}
                <div className="space-y-4">
                  <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="text-amber-600" size={18} />
                        <h3 className="text-sm font-black text-slate-900">تنبيهات المخزون</h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold">
                        {inventoryMetrics.lowStock + inventoryMetrics.outOfStock} صنف
                      </span>
                    </div>

                    {inventoryMetrics.lowStock + inventoryMetrics.outOfStock === 0 ? (
                      <p className="text-xs text-slate-500 py-3 text-center">
                        ✓ مخزون جميع الأصناف مستقر.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {storeProducts
                          .filter((p) => !p.archived && ((p.stockQuantity ?? 50) <= (p.minStockAlert ?? 5) || !p.inStock))
                          .slice(0, 3)
                          .map((p) => (
                            <div key={p.id} className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-800 truncate max-w-[140px]" title={p.name}>
                                {p.name}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                !p.inStock || (p.stockQuantity ?? 0) === 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {!p.inStock || (p.stockQuantity ?? 0) === 0 ? 'نفد' : `${p.stockQuantity ?? 0} قطع`}
                              </span>
                            </div>
                          ))}
                        <button
                          onClick={() => navigateSection('inventory')}
                          className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all text-center block mt-1 cursor-pointer"
                        >
                          فتح جدول المخزون والجرد
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* PAGE: CUSTOMERS & PAYMENTS */}
          {(activeTab === 'customers' || activeTab === 'payments') && (
            canManage ? (
              <MerchantRecords key={activeTab + userStore.id} kind={activeTab} storeId={userStore.id} />
            ) : (
              <p role="alert" className="p-4 bg-rose-50 text-rose-800 rounded-2xl text-xs font-bold">هذه الصفحة لمدير المتجر فقط.</p>
            )
          )}

          {/* PAGE: SETTINGS & STORE PROFILE (متطابق بالكامل مع لوحة التحكم الرئيسية) */}
          {activeTab === 'settings' && (
            <section aria-label="إعدادات المتجر والفرع" className="space-y-5 animate-in fade-in duration-200">
              {/* Hero Identity Card (Banner + Logo + Info + Actions) */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
                {/* Store Cover / Banner with Facebook-Style Drag-To-Reposition */}
                <div
                  className={`h-52 sm:h-60 w-full bg-slate-800 relative overflow-hidden select-none ${
                    isRepositioningCover ? 'cursor-grab active:cursor-grabbing ring-2 ring-orange-500' : 'group'
                  }`}
                  onMouseDown={(e) => {
                    if (!isRepositioningCover) return;
                    setIsDraggingCover(true);
                    setDragStartY(e.clientY);
                    setInitialPosY(bannerPosY);
                  }}
                  onMouseMove={(e) => {
                    if (!isRepositioningCover || !isDraggingCover) return;
                    const delta = e.clientY - dragStartY;
                    const newPos = Math.max(0, Math.min(100, Math.round(initialPosY - (delta * 0.45))));
                    setBannerPosY(newPos);
                  }}
                  onMouseUp={() => setIsDraggingCover(false)}
                  onMouseLeave={() => setIsDraggingCover(false)}
                  onTouchStart={(e) => {
                    if (!isRepositioningCover) return;
                    const touch = e.touches[0];
                    if (!touch) return;
                    setIsDraggingCover(true);
                    setDragStartY(touch.clientY);
                    setInitialPosY(bannerPosY);
                  }}
                  onTouchMove={(e) => {
                    if (!isRepositioningCover || !isDraggingCover) return;
                    const touch = e.touches[0];
                    if (!touch) return;
                    const delta = touch.clientY - dragStartY;
                    const newPos = Math.max(0, Math.min(100, Math.round(initialPosY - (delta * 0.45))));
                    setBannerPosY(newPos);
                  }}
                  onTouchEnd={() => setIsDraggingCover(false)}
                >
                  {activeBanner ? (
                    <img
                      src={activeBanner}
                      alt={userStore.name}
                      style={{ objectPosition: `center ${bannerPosY}%` }}
                      className={`w-full h-full object-cover pointer-events-none transition-[object-position] ${
                        isRepositioningCover ? 'duration-0' : 'duration-200'
                      }`}
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-slate-900 via-orange-950 to-slate-900 flex items-center justify-center text-white/40">
                      <StoreIcon size={48} />
                    </div>
                  )}

                  {!isRepositioningCover && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
                  )}

                  {/* Facebook-style Reposition Controls Toolbar */}
                  {isRepositioningCover ? (
                    <div className="absolute inset-x-0 top-0 bg-slate-950/90 backdrop-blur-md text-white py-2 px-3 sm:px-4 flex flex-wrap items-center justify-between gap-2 text-xs z-30 border-b border-white/10 animate-in slide-in-from-top-2">
                      <div className="flex items-center gap-2">
                        <Move size={15} className="text-orange-400 animate-pulse" />
                        <span className="font-bold">اسحب الصورة للأعلى والأسفل لضبط الموضع ({bannerPosY}%)</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setBannerPosY((prev) => Math.max(0, prev - 10))}
                          className="px-2 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-[11px] font-bold cursor-pointer"
                          title="تحريك للأعلى"
                        >
                          ▲ أعلى
                        </button>
                        <button
                          type="button"
                          onClick={() => setBannerPosY(50)}
                          className="px-2 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-[11px] font-bold cursor-pointer"
                          title="توسيط"
                        >
                          ◎ وسط
                        </button>
                        <button
                          type="button"
                          onClick={() => setBannerPosY((prev) => Math.min(100, prev + 10))}
                          className="px-2 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-[11px] font-bold cursor-pointer"
                          title="تحريك للأسفل"
                        >
                          ▼ أسفل
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setBannerPosY(tempBannerPosY);
                            setIsRepositioningCover(false);
                          }}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold cursor-pointer mr-1"
                        >
                          إلغاء
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            try {
                              localStorage.setItem(`sangoub_banner_pos_${userStore.id}`, String(bannerPosY));
                            } catch {}
                            setIsRepositioningCover(false);
                            setCoverUploadMsg('تم حفظ موضع الغلاف بنجاح ✓');
                            setTimeout(() => setCoverUploadMsg(''), 4000);
                          }}
                          className="px-3.5 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1 active:scale-95"
                        >
                          <Check size={13} />
                          <span>حفظ الموضع</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Default Banner Action Buttons */
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <label
                        title="رفع وتغيير صورة الغلاف مباشرة"
                        className="px-3 py-1.5 bg-black/65 hover:bg-black/85 backdrop-blur-md text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md border border-white/20 active:scale-95"
                      >
                        {isUploadingCover ? (
                          <RefreshCw size={13} className="animate-spin text-orange-400" />
                        ) : (
                          <Camera size={13} className="text-orange-400" />
                        )}
                        <span>{isUploadingCover ? 'جارٍ رفع الغلاف…' : 'رفع وتغيير الغلاف'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={isUploadingCover}
                          onChange={handleDirectCoverUpload}
                          className="hidden"
                        />
                      </label>

                      {activeBanner && (
                        <button
                          type="button"
                          onClick={() => {
                            setTempBannerPosY(bannerPosY);
                            setIsRepositioningCover(true);
                          }}
                          title="تحريك وضبط موضع الغلاف مثل الفيس بوك"
                          className="px-3 py-1.5 bg-black/65 hover:bg-black/85 backdrop-blur-md text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md border border-white/20 active:scale-95"
                        >
                          <Move size={13} className="text-orange-400" />
                          <span>تحريك الموضع</span>
                        </button>
                      )}
                    </div>
                  )}

                  {coverUploadMsg && !isRepositioningCover && (
                    <div className="absolute top-3 right-3 px-3.5 py-1.5 bg-emerald-600/95 text-white text-xs font-bold rounded-xl shadow-lg backdrop-blur-xs flex items-center gap-1.5 animate-in fade-in">
                      <CheckCircle2 size={14} />
                      <span>{coverUploadMsg}</span>
                    </div>
                  )}
                </div>

                {/* Profile Body with Logo and Clean Store Info UNDER the Cover */}
                <div className="px-6 pb-6 pt-0 relative">
                  {/* Top Avatar & Action Button Row */}
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14 mb-3">
                    {/* Logo Container with Direct Avatar Upload */}
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white border-4 border-white shadow-xl overflow-hidden relative shrink-0 group">
                      {activeLogo ? (
                        <img src={activeLogo} alt={userStore.name} className="w-full h-full object-contain p-1.5" />
                      ) : (
                        <div className="w-full h-full bg-orange-50 text-orange-600 flex items-center justify-center font-black text-2xl">
                          {userStore.name.slice(0, 2)}
                        </div>
                      )}

                      {/* Hover Overlay to Upload Logo Directly */}
                      <label
                        title="تغيير شعار المتجر مباشرة من جهازك"
                        className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-bold cursor-pointer transition-opacity duration-200"
                      >
                        {isUploadingLogo ? (
                          <RefreshCw size={18} className="animate-spin text-orange-400 mb-1" />
                        ) : (
                          <Upload size={18} className="text-orange-400 mb-1" />
                        )}
                        <span>{isUploadingLogo ? 'جارٍ الرفع…' : 'رفع الشعار'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={isUploadingLogo}
                          onChange={handleDirectLogoUpload}
                          className="hidden"
                        />
                      </label>

                      {/* Mobile quick camera icon */}
                      <label
                        className="sm:hidden absolute bottom-0 right-0 w-7 h-7 rounded-tl-xl bg-orange-600 text-white flex items-center justify-center shadow-md cursor-pointer active:scale-95"
                        title="تغيير الشعار"
                      >
                        <Camera size={13} />
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={isUploadingLogo}
                          onChange={handleDirectLogoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Edit Store Action Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setStoreEditData({ ...userStore });
                        setModalLogoFile(null);
                        setModalCoverFile(null);
                        setIsEditStoreOpen(true);
                      }}
                      className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto shrink-0 active:scale-95"
                    >
                      <Edit2 size={13} />
                      <span>تعديل بيانات المتجر والفرع</span>
                    </button>
                  </div>

                  {/* Store Name, Status & Details - COMPLETELY UNDER THE COVER PHOTO */}
                  <div className="space-y-1 mb-5 pt-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{userStore.name}</h2>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        userStore.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {userStore.status === 'open' ? 'مفتوح ويستقبل' : 'مغلق مؤقتاً'}
                      </span>
                      {userStore.type && (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {userStore.type}
                        </span>
                      )}
                    </div>

                    {userStore.nameEn && (
                      <p className="text-xs text-slate-400 font-sans tracking-wide">{userStore.nameEn}</p>
                    )}

                    <p className="text-xs text-slate-600 flex items-center gap-1.5 pt-0.5 font-medium">
                      <MapPin size={13} className="text-orange-600 shrink-0" />
                      <span>{userStore.locationInDistrict || userStore.address || 'العنوان الرئيسي للمتجر'}</span>
                    </p>
                  </div>

                  {/* Commercial & Operational Parameters (البيانات التجارية المعتمدة) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
                    <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 block">الحد الأدنى للطلب</span>
                      <span className="text-sm font-black text-slate-900 font-mono mt-0.5 block">
                        {formatEGP(userStore.minOrder || 0)}
                      </span>
                    </div>

                    <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 block">رسوم التوصيل المعتمدة</span>
                      <span className="text-sm font-black text-slate-900 font-mono mt-0.5 block">
                        {formatEGP(userStore.deliveryFee || 0)}
                      </span>
                    </div>

                    <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 block">وقت التجهيز والتوصيل</span>
                      <span className="text-sm font-black text-slate-900 font-mono mt-0.5 block">
                        {userStore.deliveryTime || '20 - 30 دقيقة'}
                      </span>
                    </div>

                    <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 block">نسبة العمولة والضرائب</span>
                      <span className="text-xs font-black text-emerald-700 mt-0.5 block">
                        عمولة: {userStore.commissionRate ?? 10}% | ضريبة: {userStore.taxRate ?? 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Edit Store Profile Modal (تعديل بيانات المتجر وهوية الفرع مع رفع الصور) */}
              {isEditStoreOpen && (
                <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir="rtl">
                  <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <header className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
                          <StoreIcon size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900">تعديل بيانات المتجر وهوية الفرع</h3>
                          <p className="text-[11px] text-slate-500">تحديث الاسم وتصنيف النشاط والشعار والغلاف وساعات العمل</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setModalLogoFile(null);
                          setModalCoverFile(null);
                          setIsEditStoreOpen(false);
                        }}
                        className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer"
                      >
                        <X size={15} />
                      </button>
                    </header>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setStoreEditBusy(true);
                        setStoreEditError('');
                        try {
                          let finalLogoUrl = activeLogo;
                          let finalBannerUrl = activeBanner;

                          if (modalLogoFile) {
                            finalLogoUrl = await syncStoreImages('logo', modalLogoFile);
                          }
                          if (modalCoverFile) {
                            finalBannerUrl = await syncStoreImages('banner', modalCoverFile);
                          }

                          const targetUuid = resolveSupabaseStoreUuid(userStore.id);
                          const payload = {
                            name: storeEditData.name.trim(),
                            name_en: storeEditData.nameEn?.trim() || null,
                            type: storeEditData.type?.trim() || 'متجر',
                            location_in_district: storeEditData.locationInDistrict?.trim() || null,
                            min_order: Number(storeEditData.minOrder) || 0,
                            delivery_fee: Number(storeEditData.deliveryFee) || 0,
                            delivery_time: storeEditData.deliveryTime?.trim() || '20 - 30 دقيقة',
                            logo: finalLogoUrl || null,
                            banner: finalBannerUrl || null,
                            updated_at: new Date().toISOString()
                          };

                          await supabase.from('stores').update(payload).eq('id', targetUuid);

                          // Also update Firebase Firestore so AdminApp real-time listener updates
                          try {
                            await saveRecord('stores', userStore.id, {
                              name: storeEditData.name.trim(),
                              nameEn: storeEditData.nameEn?.trim() || null,
                              type: storeEditData.type?.trim() || 'متجر',
                              locationInDistrict: storeEditData.locationInDistrict?.trim() || null,
                              minOrder: Number(storeEditData.minOrder) || 0,
                              deliveryFee: Number(storeEditData.deliveryFee) || 0,
                              deliveryTime: storeEditData.deliveryTime?.trim() || '20 - 30 دقيقة',
                              logo: finalLogoUrl,
                              logoUrl: finalLogoUrl,
                              banner: finalBannerUrl,
                              bannerUrl: finalBannerUrl,
                              imageUrl: finalBannerUrl,
                            });
                          } catch (e) {
                            console.warn('Firestore store save notice:', e);
                          }
                          Object.assign(userStore, {
                            name: storeEditData.name,
                            nameEn: storeEditData.nameEn,
                            type: storeEditData.type,
                            locationInDistrict: storeEditData.locationInDistrict,
                            minOrder: Number(storeEditData.minOrder),
                            deliveryFee: Number(storeEditData.deliveryFee),
                            deliveryTime: storeEditData.deliveryTime,
                            logo: finalLogoUrl,
                            logoUrl: finalLogoUrl,
                            banner: finalBannerUrl,
                            bannerUrl: finalBannerUrl,
                            imageUrl: finalBannerUrl,
                          });
                          setModalLogoFile(null);
                          setModalCoverFile(null);
                          setIsEditStoreOpen(false);
                          setCoverUploadMsg('تم حفظ وتحديث بيانات المتجر بنجاح ✓');
                          setTimeout(() => setCoverUploadMsg(''), 4000);
                        } catch (err: any) {
                          setStoreEditError(err?.message || 'تعذر حفظ بيانات المتجر.');
                        } finally {
                          setStoreEditBusy(false);
                        }
                      }}
                      className="p-5 space-y-3.5 overflow-y-auto text-xs"
                    >
                      {storeEditError && (
                        <p role="alert" className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold">
                          {storeEditError}
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم المتجر (بالعربية) *</label>
                          <input
                            type="text"
                            required
                            value={storeEditData.name || ''}
                            onChange={(e) => setStoreEditData({ ...storeEditData, name: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">الاسم بالإنجليزية</label>
                          <input
                            type="text"
                            value={storeEditData.nameEn || ''}
                            onChange={(e) => setStoreEditData({ ...storeEditData, nameEn: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-orange-500 text-left"
                            dir="ltr"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">نوع وتصنيف المتجر</label>
                          <input
                            type="text"
                            value={storeEditData.type || ''}
                            onChange={(e) => setStoreEditData({ ...storeEditData, type: e.target.value })}
                            placeholder="مثال: سوبرماركت، مطعم، صيدلية، إلكترونيات، مكتبة..."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">موقع الفرع أو عنوان المتجر</label>
                          <input
                            type="text"
                            value={storeEditData.locationInDistrict || ''}
                            onChange={(e) => setStoreEditData({ ...storeEditData, locationInDistrict: e.target.value })}
                            placeholder="مثال: المعادي - شارع 9، أو العاصمة الإدارية، أو التجمع الخامس"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">الحد الأدنى للطلب (ج.م)</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={storeEditData.minOrder ?? 0}
                            onChange={(e) => setStoreEditData({ ...storeEditData, minOrder: e.target.value })}
                            className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:border-orange-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">رسوم التوصيل (ج.م)</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={storeEditData.deliveryFee ?? 0}
                            onChange={(e) => setStoreEditData({ ...storeEditData, deliveryFee: e.target.value })}
                            className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:border-orange-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">وقت التوصيل التقديري</label>
                          <input
                            type="text"
                            value={storeEditData.deliveryTime || ''}
                            onChange={(e) => setStoreEditData({ ...storeEditData, deliveryTime: e.target.value })}
                            placeholder="20 - 30 دقيقة"
                            className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                      </div>

                      {/* رفع شعار المتجر من الجهاز - بدون إدخال روابط تقنية */}
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                            <Camera size={13} className="text-orange-600" />
                            <span>شعار المتجر الرسمي (Logo)</span>
                          </label>
                          <span className="text-[10px] text-slate-400 font-mono">JPG / PNG حتى 5MB</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                            {storeEditData.logoUrl ? (
                              <img src={storeEditData.logoUrl} alt="معاينة الشعار" className="w-full h-full object-contain p-1" />
                            ) : (
                              <StoreIcon size={20} className="text-slate-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition shadow-2xs">
                              <Upload size={12} className="text-orange-600" />
                              <span className="truncate max-w-[170px]">{modalLogoFile ? modalLogoFile.name : 'رفع شعار من الجهاز'}</span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    try {
                                      validateCatalogImage(f);
                                      setModalLogoFile(f);
                                      const preview = URL.createObjectURL(f);
                                      setStoreEditData((prev: any) => ({ ...prev, logoUrl: preview }));
                                    } catch (err: any) {
                                      alert(err.message);
                                    }
                                  }
                                }}
                              />
                            </label>
                            <span className="block text-[10px] text-slate-400 mt-1">يظهر للعميل في قائمة المتاجر وأعلى الفواتير</span>
                          </div>
                        </div>
                      </div>

                      {/* رفع صورة الغلاف والبانر من الجهاز - بدون إدخال روابط تقنية */}
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                            <Camera size={13} className="text-orange-600" />
                            <span>صورة غلاف المتجر (Banner)</span>
                          </label>
                          <span className="text-[10px] text-slate-400 font-mono">بانر أفقي عريض</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                            {storeEditData.bannerUrl || storeEditData.imageUrl ? (
                              <img src={storeEditData.bannerUrl || storeEditData.imageUrl} alt="معاينة الغلاف" className="w-full h-full object-cover" />
                            ) : (
                              <StoreIcon size={20} className="text-slate-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition shadow-2xs">
                              <Upload size={12} className="text-orange-600" />
                              <span className="truncate max-w-[170px]">{modalCoverFile ? modalCoverFile.name : 'رفع غلاف من الجهاز'}</span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    try {
                                      validateCatalogImage(f);
                                      setModalCoverFile(f);
                                      const preview = URL.createObjectURL(f);
                                      setStoreEditData((prev: any) => ({ ...prev, bannerUrl: preview, imageUrl: preview }));
                                    } catch (err: any) {
                                      alert(err.message);
                                    }
                                  }
                                }}
                              />
                            </label>
                            <span className="block text-[10px] text-slate-400 mt-1">يظهر كخلفية لصفحة متجرك للعملاء في التطبيق</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setModalLogoFile(null);
                            setModalCoverFile(null);
                            setIsEditStoreOpen(false);
                          }}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          disabled={storeEditBusy}
                          className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                        >
                          <Check size={14} />
                          <span>{storeEditBusy ? 'جارٍ الرفع والحفظ…' : 'حفظ التحديثات'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}


              {/* سجل فترات توقف المتجر عن العمل */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">سجل فترات توقف المتجر عن العمل</h3>
                    <p className="text-xs text-slate-500 mt-0.5">توثيق زمني دقيق لكل فترة توقف واستئناف تم تسجيلها لهذا الفرع</p>
                  </div>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl">
                    {stoppagesHistory.length} فترة مسجلة
                  </span>
                </div>

                {stoppagesHistory.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    لم تسجل أي فترات توقف سابقة لهذا المتجر؛ التشغيل منتظم ومستمر.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 text-[11px]">
                          <th className="py-2.5 font-bold">وقت التوقف</th>
                          <th className="py-2.5 font-bold">وقت الاستئناف</th>
                          <th className="py-2.5 font-bold">المدة الإجمالية</th>
                          <th className="py-2.5 font-bold">بواسطة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {stoppagesHistory.map((item: any) => (
                          <tr key={item.id} className="hover:bg-slate-50/60">
                            <td className="py-2.5 text-slate-700">
                              {new Date(item.stoppedAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="py-2.5 text-slate-700">
                              {item.resumedAt ? new Date(item.resumedAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : 'قيد التوقف'}
                            </td>
                            <td className="py-2.5">
                              <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md font-bold text-[11px]">
                                {item.durationLabel || `${item.durationMinutes || 1} دقيقة`}
                              </span>
                            </td>
                            <td className="py-2.5 font-sans text-slate-600">
                              {item.stoppedBy || 'مدير المتجر'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* PAGE: SUPPORT */}
          {activeTab === 'support' && (
            <section aria-label="الدعم والمساعدة الفورية" className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-4">
                <h2 className="text-lg font-black text-slate-900">دعم الشركاء وغرفة العمليات</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200 space-y-2">
                    <h3 className="font-black text-slate-900 text-xs">خط طوارئ العمليات</h3>
                    <a href="tel:01000000000" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-xl text-xs font-bold shadow-xs">
                      <Phone size={13} />
                      <span>اتصال فوري</span>
                    </a>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                    <h3 className="font-black text-slate-900 text-xs">واتساب الشركاء المعتمد</h3>
                    <a href={BRAND.supportUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs">
                      <SendHorizontal size={13} />
                      <span>محادثة واتساب</span>
                    </a>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* PAGE: KITCHEN / ORDER PREPARATION DISPLAY */}
          {activeTab === "kitchen" && (
            <section aria-label="شاشة تحضير وتجهيز الطلبات الحية">
              {preparationContent}
              {(!preparationContent || orders.some(o => o.fulfillmentVersion !== 2 && ["received", "preparing"].includes(o.orderStatus))) && (
                <KitchenDisplay
                  orders={orders.filter(o => o.fulfillmentVersion !== 2)}
                  stores={stores}
                  fixedStoreId={userStore.id}
                  connected={connected}
                  couriers={couriers && couriers.length > 0 ? couriers : storeCouriers}
                  onAssignCourier={onAssignCourier}
                  onChange={onKitchenChange}
                  onNavigateRadar={() => navigateSection('radar')}
                />
              )}
            </section>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE: MENU & PRODUCTS
              ════════════════════════════════════════════════════════════════════════ */}
          {activeTab === "menu" && (
            <section className="space-y-4" aria-label="إدارة أصناف المنيو وتحديث الأسعار">
              {/* Header Controls (Compact & Clean) */}
              <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">منتجات وأسعار {userStore.name}</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    إدارة قائمة المنتجات والأسعار وتحديثها بالملفات أو الكتالوج.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!canManage || !connected}
                    onClick={() => setIsImportModalOpen(true)}
                    className="h-8 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
                    title="استيراد وتحديث المنتجات بملف Excel"
                  >
                    <FileSpreadsheet size={13} />
                    <span>رفع Excel</span>
                  </button>

                  <button
                    type="button"
                    disabled={!canManage || !connected}
                    onClick={() => setIsAddingItem(true)}
                    className="h-8 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>إضافة منتج</span>
                  </button>
                </div>
              </div>

              {/* Search & Category Filter Pills */}
              {storeProducts.length > 0 && (
                <>
                  <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
                    <div className="relative w-full sm:w-72">
                      <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="ابحث عن وجبة أو صنف..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full pl-3 pr-9 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5 self-start sm:self-auto text-xs font-bold">
                      {["all", ...productCategories].map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
                            selectedCategory === cat
                              ? "bg-slate-900 text-white shadow-xs"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {cat === "all" ? "جميع الأصناف" : cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toolbar: Sort + Grid/Table Toggle + Status Filter + Excel Export Icon Only */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-600">
                        <Filter size={13} className="shrink-0 text-slate-400" />
                        <select
                          value={productSort}
                          onChange={(e) => setProductSort(e.target.value as any)}
                          className="bg-transparent font-bold text-xs focus:outline-none cursor-pointer text-slate-700 min-w-[105px]"
                        >
                          <option value="newest">الأحدث أولاً</option>
                          <option value="oldest">الأقدم أولاً</option>
                          <option value="name">الاسم أبجدياً</option>
                          <option value="price_asc">السعر: الأقل أولاً</option>
                          <option value="price_desc">السعر: الأعلى أولاً</option>
                          <option value="available">المتوفر أولاً</option>
                        </select>
                      </div>

                      <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5">
                        <button
                          type="button"
                          onClick={() => setProductViewMode('grid')}
                          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                            productViewMode === 'grid'
                              ? 'bg-slate-900 text-white shadow-2xs'
                              : 'text-slate-400 hover:text-slate-700'
                          }`}
                          title="عرض الشبكة"
                        >
                          <LayoutGrid size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductViewMode('table')}
                          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                            productViewMode === 'table'
                              ? 'bg-slate-900 text-white shadow-2xs'
                              : 'text-slate-400 hover:text-slate-700'
                          }`}
                          title="عرض الجدول"
                        >
                          <Table2 size={14} />
                        </button>
                      </div>

                      <div className="flex gap-1 font-bold">
                        <button
                          onClick={() => setInventoryView('active')}
                          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                            inventoryView === 'active'
                              ? 'bg-slate-900 text-white'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          المتاحة ({filteredProducts.length})
                        </button>
                        <button
                          onClick={() => setInventoryView('archived')}
                          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                            inventoryView === 'archived'
                              ? 'bg-slate-900 text-white'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          المؤرشفة
                        </button>
                      </div>

                      {productsNextCursor && (
                        <button
                          disabled={productsLoading}
                          onClick={onLoadMoreProducts}
                          className="px-3 py-1.5 rounded-xl bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-bold cursor-pointer"
                        >
                          {productsLoading ? 'جارٍ التحميل…' : 'تحميل المزيد'}
                        </button>
                      )}
                    </div>

                    {/* زر التصدير إلى إكسيل: أيقونة فقط مع tooltip كما طلب المستخدم تماماً */}
                    <button
                      type="button"
                      onClick={() => exportProductsToExcel(filteredProducts, userStore.name)}
                      className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold flex items-center justify-center transition-all shadow-2xs cursor-pointer"
                      title="تصدير قائمة المنتجات إلى ملف Excel معتمد بتوقيع سنجوب"
                    >
                      <FileSpreadsheet size={15} className="text-emerald-700" />
                    </button>
                  </div>
                </>
              )}

{menuError && <p role="alert" className="text-red-700">{menuError}</p>}
          {activeTab === 'menu' && isAddingItem && canManage && (
            <MerchantCatalogPicker
              products={storeProducts}
              onLink={onLinkProduct}
              onClose={() => setIsAddingItem(false)}
            />
          )}
          {activeTab === 'menu' && isImportModalOpen && canManage && userStore && (
            <BulkProductImportModal
              stores={stores}
              selectedStoreId={userStore.id}
              onClose={() => setIsImportModalOpen(false)}
              onSuccess={(count) => {
                if (typeof onRefreshProducts === 'function') {
                  onRefreshProducts();
                } else if (typeof onLoadMoreProducts === 'function') {
                  onLoadMoreProducts();
                }
              }}
            />
          )}

          {filteredProducts.length === 0 && (
            <EmptyState
              message={
                productSearch
                  ? "لا توجد أصناف تطابق البحث؛ جرّب اسمًا آخر."
                  : "لا توجد أصناف في هذه القائمة. اختر منتجات موجودة من الكتالوج العام."
              }
            />
          )}

          {/* 1. عرض البطاقات / الشبكة المدمجة (Compact Grid View) */}
          {productViewMode === 'grid' && filteredProducts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-2.5"
                >
                  {/* رأس الكارت: الصورة المصغرة والمعلومات بخط مناسب وأنيق */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-slate-100 bg-slate-50 relative group">
                      <MerchantProductImage src={prod.imageUrl} name={prod.name} />
                      <button
                        type="button"
                        disabled={!canManage || !connected}
                        onClick={() => setSmartImageProduct(prod)}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                        title="تغيير أو اختيار صورة بالاسم أو جوجل"
                      >
                        <Sparkles size={12} className="text-amber-300" />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-slate-900 truncate" title={prod.name}>
                          {prod.name}
                        </h4>
                        <span className="text-[9px] text-amber-800 font-bold bg-amber-50 px-1.5 py-0.2 rounded shrink-0">
                          {prod.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 leading-snug">
                        {prod.description || "لا يوجد وصف مدخل لهذا الصنف"}
                      </p>
                    </div>
                  </div>

                  {/* الجزء الأوسط: السعر والأيقونات السريعة (بدون نصوص طويلة) */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-bold">السعر:</span>
                      {editingPriceId === prod.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            value={tempPrice}
                            onChange={(e) => setTempPrice(Number(e.target.value))}
                            className="w-16 px-1.5 py-0.5 text-xs font-black border border-orange-500 rounded-lg text-slate-900 bg-white"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSavePrice(prod.id)}
                            className="p-1 bg-emerald-600 text-white rounded-md cursor-pointer"
                            title="حفظ السعر"
                          >
                            <Check size={11} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-black text-slate-900 text-xs sm:text-sm">
                            {formatEGP(prod.price)}
                          </span>
                          {Boolean(prod.originalPrice && prod.originalPrice > prod.price) && (
                            <>
                              <del className="text-[10px] text-slate-400 font-mono">
                                {formatEGP(prod.originalPrice!)}
                              </del>
                              <span className="text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-200 px-1 py-0.2 rounded-md">
                                خصم {Math.round((1 - prod.price / prod.originalPrice!) * 100)}%
                              </span>
                            </>
                          )}
                          <button
                            onClick={() => {
                              setEditingPriceId(prod.id);
                              setTempPrice(prod.price);
                            }}
                            disabled={!canManage || !connected || prod.archived}
                            className="p-0.5 text-slate-400 hover:text-orange-600 transition cursor-pointer"
                            title="تعديل السعر المباشر"
                          >
                            <Edit2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* أيقونات سريعة: عرض خاص + بحث الصورة بالاسم + أرشفة */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={!canManage || !connected || prod.archived}
                        onClick={() => {
                          setMerchantOfferProduct(prod);
                          setMerchantOfferOrig(prod.originalPrice || prod.price);
                          setMerchantOfferPrice(prod.originalPrice && prod.originalPrice > prod.price ? prod.price : Math.round(prod.price * 0.8));
                        }}
                        className={`p-1 rounded-lg border transition cursor-pointer ${
                          Boolean(prod.originalPrice && prod.originalPrice > prod.price)
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                            : 'bg-slate-50 hover:bg-orange-50 text-slate-500 hover:text-orange-600 border-slate-200'
                        }`}
                        title={Boolean(prod.originalPrice && prod.originalPrice > prod.price) ? "تعديل أو إلغاء العرض والخصم" : "إضافة عرض وتخفيض خاص"}
                      >
                        <Tag size={12} className={Boolean(prod.originalPrice && prod.originalPrice > prod.price) ? "text-rose-600 fill-rose-100" : ""} />
                      </button>

                      <button
                        type="button"
                        disabled={!canManage || !connected}
                        onClick={() => setSmartImageProduct(prod)}
                        className="p-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition cursor-pointer"
                        title="بحث ذكي عن صورة بالاسم أو Google Images"
                      >
                        <Sparkles size={12} className="text-amber-600" />
                      </button>

                      <button
                        type="button"
                        disabled={!canManage || !connected}
                        onClick={async () => {
                          setMenuError('');
                          try {
                            await onArchiveProduct(prod.id, !prod.archived);
                          } catch (e) {
                            setMenuError((e as Error).message);
                          }
                        }}
                        className="p-1 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition cursor-pointer"
                        title={prod.archived ? "استعادة الصنف" : "أرشفة الصنف"}
                      >
                        <Archive size={12} />
                      </button>
                    </div>
                  </div>

                  {priceSuccessId === prod.id && (
                    <p className="text-[10px] text-emerald-600 font-bold text-center bg-emerald-50 py-0.5 rounded animate-in fade-in">
                      ✓ تم تحديث السعر
                    </p>
                  )}

                  {/* زر التوفر للطلب بالمتجر */}
                  <button
                    disabled={!canManage || !connected || prod.archived}
                    onClick={() => onUpdateProductStock(prod.id, !prod.inStock)}
                    className={`w-full py-1.5 px-2.5 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                      prod.inStock
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                    }`}
                    title="تبديل حالة التوفر للطلب بالمتجر"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${prod.inStock ? "bg-emerald-500" : "bg-rose-500"}`} />
                    <span>{prod.inStock ? "متوفر للطلب" : "غير متوفر حالياً"}</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 2. عرض الجدول المتقدم (Enterprise Table View) */}
          {productViewMode === 'table' && filteredProducts.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-black text-slate-500">
                      <th className="py-3 px-3.5 w-14 text-center">الصورة</th>
                      <th className="py-3 px-3.5">اسم الصنف والوصف</th>
                      <th className="py-3 px-3.5 w-28">التصنيف</th>
                      <th className="py-3 px-3.5 w-32">السعر</th>
                      <th className="py-3 px-3.5 w-32 text-center">حالة التوفر</th>
                      <th className="py-3 px-3.5 w-24 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredProducts.map((prod) => (
                      <tr key={prod.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-3.5 text-center">
                          <button
                            type="button"
                            disabled={!canManage || !connected}
                            onClick={() => setSmartImageProduct(prod)}
                            className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 relative group inline-block shadow-2xs cursor-pointer"
                            title="تغيير أو اختيار صورة"
                          >
                            <MerchantProductImage src={prod.imageUrl} name={prod.name} />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Sparkles size={11} className="text-amber-300" />
                            </div>
                          </button>
                        </td>
                        <td className="py-2 px-3.5">
                          <div className="font-bold text-slate-900 text-xs">{prod.name}</div>
                          {prod.description && (
                            <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                              {prod.description}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3.5">
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md inline-block">
                            {prod.category}
                          </span>
                        </td>
                        <td className="py-2 px-3.5">
                          {editingPriceId === prod.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={1}
                                value={tempPrice}
                                onChange={(e) => setTempPrice(Number(e.target.value))}
                                className="w-16 px-1.5 py-0.5 text-xs font-black border border-orange-500 rounded-lg text-slate-900 bg-white"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSavePrice(prod.id)}
                                className="p-1 bg-emerald-600 text-white rounded-md cursor-pointer"
                                title="حفظ"
                              >
                                <Check size={11} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-slate-900 text-xs">
                                {formatEGP(prod.price)}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingPriceId(prod.id);
                                  setTempPrice(prod.price);
                                }}
                                disabled={!canManage || !connected || prod.archived}
                                className="text-slate-400 hover:text-orange-600 p-0.5 transition cursor-pointer"
                                title="تعديل السعر"
                              >
                                <Edit2 size={11} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3.5 text-center">
                          <button
                            disabled={!canManage || !connected || prod.archived}
                            onClick={() => onUpdateProductStock(prod.id, !prod.inStock)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                              prod.inStock
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                            }`}
                            title="تبديل حالة التوفر"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${prod.inStock ? "bg-emerald-500" : "bg-rose-500"}`} />
                            <span>{prod.inStock ? "متوفر" : "غير متوفر"}</span>
                          </button>
                        </td>
                        <td className="py-2 px-3.5 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={!canManage || !connected || prod.archived}
                              onClick={() => {
                                setMerchantOfferProduct(prod);
                                setMerchantOfferOrig(prod.originalPrice || prod.price);
                                setMerchantOfferPrice(prod.originalPrice && prod.originalPrice > prod.price ? prod.price : Math.round(prod.price * 0.8));
                              }}
                              className={`p-1 rounded-lg border transition cursor-pointer ${
                                Boolean(prod.originalPrice && prod.originalPrice > prod.price)
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                  : 'bg-slate-50 hover:bg-orange-50 text-slate-500 hover:text-orange-600 border-slate-200'
                              }`}
                              title={Boolean(prod.originalPrice && prod.originalPrice > prod.price) ? "تعديل أو إلغاء العرض" : "إضافة عرض وتخفيض"}
                            >
                              <Tag size={11} className={Boolean(prod.originalPrice && prod.originalPrice > prod.price) ? "text-rose-600 fill-rose-100" : ""} />
                            </button>

                            <button
                              type="button"
                              disabled={!canManage || !connected}
                              onClick={() => setSmartImageProduct(prod)}
                              className="p-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition cursor-pointer"
                              title="بحث عن صورة بالاسم أو صور جوجل"
                            >
                              <Sparkles size={11} className="text-amber-600" />
                            </button>
                            <button
                              type="button"
                              disabled={!canManage || !connected}
                              onClick={async () => {
                                setMenuError('');
                                try {
                                  await onArchiveProduct(prod.id, !prod.archived);
                                } catch (e) {
                                  setMenuError((e as Error).message);
                                }
                              }}
                              className="p-1 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition cursor-pointer"
                              title={prod.archived ? "استعادة الصنف" : "أرشفة الصنف"}
                            >
                              <Archive size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          2.4 تبويب العروض والتخفيضات الترويجية (تصميم احترافي مخصص لمنظومة العروض والفلاتر)
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "offers" && (
        <section aria-label="عروض وتخفيضات المتجر" className="space-y-4 animate-in fade-in duration-200">
          <OffersManager
            fixedStoreId={userStore.id}
            stores={stores}
            products={products}
            orders={orders}
          />
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          2.5 تبويب إدارة المخزون والجرد المتقدم (CARREFOUR & TALABAT ENTERPRISE STOCK TABLE)
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "inventory" && (
        <section className="space-y-4" aria-label="إدارة المخزون والجرد">
          {/* Header Controls (Compact & Clean) */}
          <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="flex items-center gap-1.5">
                <Boxes className="text-orange-600" size={16} />
                <h3 className="text-xs sm:text-sm font-black text-slate-900">إدارة المخزون والجرد — {userStore.name}</h3>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                متابعة الأرصدة، حدود التنبيه، والحد الأقصى لكل طلب وفق معايير التشغيل المعتمدة.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canManage || !connected}
                onClick={() => setIsImportModalOpen(true)}
                className="h-8 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
                title="مزامنة وتحديث المخزون والأسعار بملف Excel أو تقرير POS"
              >
                <FileSpreadsheet size={13} />
                <span>مزامنة جرد Excel / POS</span>
              </button>
            </div>
          </div>

          {/* 4 Inventory Metric Cards (Carrefour Style) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 block">إجمالي الأصناف المدارة</span>
                <span className="text-xl font-black text-slate-900 font-mono mt-0.5 block">{inventoryMetrics.total} صنف</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Package size={20} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-emerald-200 bg-emerald-50/20 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-800 block">متوفر للبيع ومستقر</span>
                <span className="text-xl font-black text-emerald-700 font-mono mt-0.5 block">{inventoryMetrics.inStock} صنف</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-amber-200 bg-amber-50/20 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-800 block">تنبيه: قارب على النفاد</span>
                <span className="text-xl font-black text-amber-600 font-mono mt-0.5 block">{inventoryMetrics.lowStock} صنف</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <AlertCircle size={20} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-rose-200 bg-rose-50/20 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-rose-800 block">نفد تماماً من المخزن</span>
                <span className="text-xl font-black text-rose-600 font-mono mt-0.5 block">{inventoryMetrics.outOfStock} صنف</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertOctagon size={20} />
              </div>
            </div>
          </div>

          {/* Search & Stock Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث بالاسم، الباركود الدولي (EAN)، أو كود الـ POS..."
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 w-full md:w-auto text-xs font-bold">
              {[
                { id: 'all', label: 'جميع الأصناف', count: inventoryMetrics.total },
                { id: 'in_stock', label: 'متوفر', count: inventoryMetrics.inStock },
                { id: 'low_stock', label: '⚠️ قارب على النفاد', count: inventoryMetrics.lowStock },
                { id: 'out_of_stock', label: '🚫 غير متوفر', count: inventoryMetrics.outOfStock },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setInventoryFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                    inventoryFilter === f.id
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${inventoryFilter === f.id ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'}`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Enterprise Inventory Data Table (Carrefour Partner Standard) */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-3.5 px-4">الصنف</th>
                    <th className="py-3.5 px-3">الباركود / كود POS</th>
                    <th className="py-3.5 px-3">سعر البيع</th>
                    <th className="py-3.5 px-3 text-center">الرصيد المتاح بالمخزن</th>
                    <th className="py-3.5 px-3 text-center">حد التنبيه الأدنى</th>
                    <th className="py-3.5 px-3 text-center">الحد الأقصى للطلب</th>
                    <th className="py-3.5 px-3 text-center">الحالة</th>
                    <th className="py-3.5 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {inventoryProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        لا توجد أصناف تطابق هذا البحث أو الفلتر في المخزون.
                      </td>
                    </tr>
                  ) : (
                    inventoryProducts.map((p) => {
                      const pendingQty = stockChanges[p.id]?.stockQuantity ?? p.stockQuantity ?? 50;
                      const pendingMin = stockChanges[p.id]?.minStockAlert ?? p.minStockAlert ?? 5;
                      const pendingMax = stockChanges[p.id]?.maxPerOrder ?? p.maxPerOrder ?? 6;
                      const hasChanges = Boolean(stockChanges[p.id]);
                      const isLow = p.inStock && pendingQty <= pendingMin && pendingQty > 0;
                      const isZero = !p.inStock || pendingQty === 0;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* 1. Item Details */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <button
                                  type="button"
                                  onClick={() => setSmartImageProduct(p)}
                                  className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200 hover:border-amber-500 overflow-hidden shrink-0 relative group transition-colors cursor-pointer"
                                  title="تغيير أو إضافة صورة للصنف"
                                >
                                  <MerchantProductImage src={p.imageUrl} name={p.name} />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                    <Sparkles size={14} />
                                  </div>
                                </button>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900 truncate max-w-[200px]" title={p.name}>
                                    {p.name}
                                  </span>
                                  {p.catalogProductId && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                                      كتالوج مركزي
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 block truncate">
                                  {p.category} {p.nameEn ? `• ${p.nameEn}` : ''}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 2. Barcode & POS SKU */}
                          <td className="py-3 px-3">
                            <div className="space-y-0.5 font-mono text-[11px]">
                              {p.barcode ? (
                                <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  <Barcode size={12} className="text-slate-500" />
                                  <span>{p.barcode}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">بدون باركود</span>
                              )}
                              {p.merchantPosSku && (
                                <span className="text-[10px] text-slate-500 block">
                                  POS: {p.merchantPosSku}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 3. Price */}
                          <td className="py-3 px-3 font-mono font-bold text-slate-800">
                            {formatEGP(p.price)}
                          </td>

                          {/* 4. Stock Count Controls */}
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                disabled={!canManage || pendingQty <= 0}
                                onClick={() => {
                                  const next = Math.max(0, pendingQty - 1);
                                  setStockChanges((prev) => ({
                                    ...prev,
                                    [p.id]: { ...prev[p.id], stockQuantity: next },
                                  }));
                                }}
                                className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center transition disabled:opacity-40 cursor-pointer"
                              >
                                <Minus size={12} />
                              </button>

                              <input
                                type="number"
                                min={0}
                                max={99999}
                                value={pendingQty}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  setStockChanges((prev) => ({
                                    ...prev,
                                    [p.id]: { ...prev[p.id], stockQuantity: val },
                                  }));
                                }}
                                className={`w-16 py-1 px-1.5 text-center font-mono font-black text-xs rounded-lg border focus:outline-none ${
                                  isZero
                                    ? 'bg-rose-50 border-rose-300 text-rose-700'
                                    : isLow
                                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                                    : 'bg-emerald-50/40 border-emerald-300 text-emerald-800'
                                }`}
                              />

                              <button
                                type="button"
                                disabled={!canManage}
                                onClick={() => {
                                  const next = pendingQty + 1;
                                  setStockChanges((prev) => ({
                                    ...prev,
                                    [p.id]: { ...prev[p.id], stockQuantity: next },
                                  }));
                                }}
                                className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center transition cursor-pointer"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </td>

                          {/* 5. Min Alert */}
                          <td className="py-3 px-3 text-center">
                            <input
                              type="number"
                              min={0}
                              max={999}
                              value={pendingMin}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                setStockChanges((prev) => ({
                                  ...prev,
                                  [p.id]: { ...prev[p.id], minStockAlert: val },
                                }));
                              }}
                              className="w-14 py-1 px-1.5 text-center font-mono text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-orange-500"
                              title="يرسل النظام تنبيهاً عندما يصل الرصيد إلى هذا الحد"
                            />
                          </td>

                          {/* 6. Max Per Order */}
                          <td className="py-3 px-3 text-center">
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={pendingMax}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                setStockChanges((prev) => ({
                                  ...prev,
                                  [p.id]: { ...prev[p.id], maxPerOrder: val },
                                }));
                              }}
                              className="w-14 py-1 px-1.5 text-center font-mono text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-orange-500"
                              title="أقصى عدد وحدات يمكن للعميل الواحد طلبها في المعاملة"
                            />
                          </td>

                          {/* 7. Quick Availability Switch */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              disabled={!canManage || !connected}
                              onClick={() => onUpdateProductStock(p.id, !p.inStock)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                                p.inStock && pendingQty > 0
                                  ? 'bg-emerald-100/70 text-emerald-800 hover:bg-emerald-200/70'
                                  : 'bg-rose-100/70 text-rose-800 hover:bg-rose-200/70'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  p.inStock && pendingQty > 0 ? 'bg-emerald-600' : 'bg-rose-600'
                                }`}
                              />
                              <span>{p.inStock && pendingQty > 0 ? 'متاح للطلب' : 'معلق / نفد'}</span>
                            </button>
                          </td>

                          {/* 8. Actions / Save Button */}
                          <td className="py-3 px-4 text-center">
                            {savedStockId === p.id ? (
                              <span className="text-[11px] font-bold text-emerald-600 flex items-center justify-center gap-1">
                                <Check size={14} /> تم الحفظ
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={!canManage || !hasChanges || savingStockId === p.id}
                                onClick={() => handleSaveInventory(p.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 mx-auto ${
                                  hasChanges
                                    ? 'bg-orange-600 text-white shadow-2xs hover:bg-orange-700 cursor-pointer animate-pulse'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                <Save size={13} />
                                <span>{savingStockId === p.id ? 'جارٍ…' : 'حفظ'}</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          3. تبويب الحسابات والقيود والتحصيل (APPLE WALLET + GOOGLE FINANCE)
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "accounting" && (
        <section className="space-y-6" aria-label="الحسابات والقيود المحاسبية">
          {/* History Loader Bar */}
          {onLoadHistory && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                  <Clock size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    البيانات المحملة للتقارير: <span className="font-mono font-black">{historyCount ?? orders.length}</span> طلب
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    البيانات تعرض الطلبات المسجلة بالجلسة الحالية؛ يمكنك استرجاع الفترات السابقة
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={historyBusy || (historyLoaded && !historyCursor)}
                onClick={onLoadHistory}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold shrink-0 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {historyBusy ? <span>جارٍ التحميل…</span> : historyLoaded && !historyCursor ? <span>اكتمل التحميل</span> : <span>تحميل المزيد من السجل</span>}
              </button>
            </div>
          )}

          {/* Clean Shopify/Stripe Minimalist Financial Summary */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800">الملخص المالي والتقارير</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">تقدير مبيعات الطلبات المحملة؛ المستحق الفعلي يعتمد على كشوف التسوية الرسمية</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                نسبة التعاقد: {effectiveCommissionRate}%
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-bold block">صافي المستحق التقديري</span>
                <span className="text-base font-black text-emerald-700 font-mono mt-1 block">
                  {formatEGP(accountingSummary.netPayout)}
                </span>
                <span className="text-[9px] text-slate-400">بعد خصم عمولة المنصة</span>
              </div>

              <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-bold block">إجمالي المبيعات</span>
                <span className="text-base font-black text-slate-800 font-mono mt-1 block">
                  {formatEGP(accountingSummary.grossSales)}
                </span>
                <span className="text-[9px] text-slate-400">قبل خصم العمولات</span>
              </div>

              <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-bold block">عمولة المنصة</span>
                <span className="text-base font-black text-rose-600 font-mono mt-1 block">
                  - {formatEGP(accountingSummary.platformCommission)}
                </span>
                <span className="text-[9px] text-slate-400">النسبة المعتمدة {effectiveCommissionRate}%</span>
              </div>

              <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-bold block">الطلبات المسجلة</span>
                <span className="text-base font-black text-slate-800 font-mono mt-1 block">
                  {accountingSummary.ordersCount} طلب
                </span>
                <span className="text-[9px] text-slate-400">إجمالي حركة المبيعات</span>
              </div>
            </div>
          </div>

          {/* Clean Payment Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 block">طلبات الدفع النقدي</span>
                <h4 className="text-sm font-black text-amber-700 font-mono mt-0.5">
                  {formatEGP(accountingSummary.byPaymentMethod.cash)}
                </h4>
                <span className="text-[9px] text-slate-400">مبالغ محصلة نقدياً</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Coins size={17} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 block">الدفع الإلكتروني (Geidea)</span>
                <h4 className="text-sm font-black text-purple-700 font-mono mt-0.5">
                  {formatEGP(accountingSummary.byPaymentMethod.geidea)}
                </h4>
                <span className="text-[9px] text-slate-400">بطاقات بنكية ومحافظ</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <CreditCard size={17} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 block">تسجيلات التحويل (InstaPay)</span>
                <h4 className="text-sm font-black text-blue-700 font-mono mt-0.5">
                  {formatEGP(accountingSummary.byPaymentMethod.instapay)}
                </h4>
                <span className="text-[9px] text-slate-400">سجل تحويلات</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Wallet size={17} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Selling Items (Apple Health Style Progress Bar) */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <Award className="text-amber-500" size={18} />
                  أكثر الأصناف مبيعاً
                </h4>
                <span className="text-[11px] text-slate-400 font-bold">إجمالي الحجم</span>
              </div>

              {topSellingItems.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-10">لا توجد مبيعات مكتملة بعد لتوليد الإحصائية</p>
              ) : (
                <div className="space-y-4">
                  {topSellingItems.map((item, idx) => (
                    <div key={item.productId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-slate-800">
                          {idx + 1}. {item.name}
                        </span>
                        <span className="font-mono font-bold text-slate-900">{formatEGP(item.totalRevenue)}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(8, item.percentageShare)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                        <span>{item.soldQuantity} طلب تم تسليمه</span>
                        <span>{item.percentageShare}% من المبيعات</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Double-Entry Accounting Ledger (Google Workspace / Stripe Clean Design) */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <BookOpen className="text-indigo-600" size={18} />
                  تفصيل حسابي تقديري للطلبات المحملة
                </h4>
                <span className="text-[11px] bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full">
                  حساب تقديري — غير معتمد محاسبيًا
                </span>
              </div>

              {journalEntries.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-10">لا توجد طلبات مسلّمة محملة لحساب التقدير</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="p-3">رقم القيد</th>
                        <th className="p-3">الطلب</th>
                        <th className="p-3">مدين (من حـ/)</th>
                        <th className="p-3">دائن (إلى حـ/)</th>
                        <th className="p-3">المبلغ</th>
                        <th className="p-3">البيان</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {journalEntries.slice(0, 8).map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-mono font-bold text-indigo-600">{entry.id}</td>
                          <td className="p-3 font-mono text-slate-700 font-semibold">{entry.orderNumber}</td>
                          <td className="p-3 text-emerald-700 font-bold">{entry.debitAccount}</td>
                          <td className="p-3 text-rose-700 font-bold">{entry.creditAccount}</td>
                          <td className="p-3 font-mono font-black text-slate-900">{formatEGP(entry.amount)}</td>
                          <td className="p-3 text-slate-500 text-[11px]">{entry.statement}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          4. تبويب رادار المناديب وتتبع التوصيل الحي
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "radar" && (
        <section className="space-y-4" aria-label="تتبع توصيل طلبات المتجر ورادار المناديب">
          {/* Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold shadow-2xs">
                  <Navigation size={20} />
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 font-heading">
                    غرفة عمليات ورادار المناديب وتتبع التوصيل الحي
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    متابعة دقيقة لكل طلب: المسار اللحظي، تفاصيل العميل، تواصل مباشر، وإعادة التكليف الفوري.
                  </p>
                </div>
              </div>
            </div>

            {/* View Mode & Live Refresh */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Toggle Cards vs Global Map */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setRadarViewMode('cards')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    radarViewMode === 'cards'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Package size={14} />
                  <span>بطاقات تفصيلية</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRadarViewMode('map')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    radarViewMode === 'map'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <MapPin size={14} />
                  <span>الخريطة المجمعة</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const b = document.querySelector('button[title*="تحديث"]') as HTMLButtonElement;
                  if (b) b.click();
                  else window.location.reload();
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                title="تحديث البيانات اللحظية فوراً"
              >
                <RefreshCw size={13} />
                <span>تحديث حي</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics & Live Tracking Orders */}
          {(() => {
            const isStoreOrder = (o: Order) =>
              o.storeId === userStore?.id ||
              o.storeIds?.includes(userStore?.id) ||
              o.items?.some((it: any) => it.product?.storeId === userStore?.id);

            const inTransit = orders.filter(o => isStoreOrder(o) && (o.orderStatus === 'with_courier' || o.orderStatus === 'picked_up'));
            const readyAssigned = orders.filter(o => isStoreOrder(o) && o.orderStatus === 'ready' && Boolean(o.courierId));
            const allActiveStoreOrders = [...inTransit, ...readyAssigned];

            // Apply Status Filter
            const statusFiltered = radarFilter === 'in_transit'
              ? inTransit
              : radarFilter === 'ready'
              ? readyAssigned
              : allActiveStoreOrders;

            // Apply Search Query
            const query = radarSearch.trim().toLowerCase();
            const filteredOrders = statusFiltered.filter(o => {
              if (!query) return true;
              const oNum = (o.orderNumber || '').toLowerCase();
              const cName = cleanCourierName(o.courierName, o.courierPhone).toLowerCase();
              const custName = cleanCustomerName(o.profileName, o.phone).toLowerCase();
              const dest = (o.deliveryAddress || o.ministry || '').toLowerCase();
              const itNames = (o.items || []).map(i => i.product?.name || '').join(' ').toLowerCase();
              return oNum.includes(query) || cName.includes(query) || custName.includes(query) || dest.includes(query) || itNames.includes(query);
            });

            return (
              <div className="space-y-4">
                {/* 3 Metric Summary Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div
                    onClick={() => setRadarFilter(f => f === 'in_transit' ? 'all' : 'in_transit')}
                    className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                      radarFilter === 'in_transit' ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/20' : 'border-blue-200/80 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-blue-700">في الطريق للعميل</span>
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                    </div>
                    <div className="text-2xl font-black text-blue-900 font-mono mt-1">{inTransit.length}</div>
                    <span className="text-[10px] text-slate-400">رحلات جارية بالرادار الآن</span>
                  </div>

                  <div
                    onClick={() => setRadarFilter(f => f === 'ready' ? 'all' : 'ready')}
                    className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                      radarFilter === 'ready' ? 'border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20' : 'border-emerald-200/80 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-700">جاهز ومكلّف لكابتن</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                    <div className="text-2xl font-black text-emerald-900 font-mono mt-1">{readyAssigned.length}</div>
                    <span className="text-[10px] text-slate-400">بانتظار الاستلام والانطلاق</span>
                  </div>

                  <div
                    onClick={() => setRadarFilter('all')}
                    className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs col-span-2 sm:col-span-1 ${
                      radarFilter === 'all' ? 'border-slate-800 ring-2 ring-slate-100' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">إجمالي قيد المتابعة</span>
                      <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-600">الكل</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 font-mono mt-1">{allActiveStoreOrders.length}</div>
                    <span className="text-[10px] text-slate-400">طلبات نشطة لمتجرك</span>
                  </div>
                </div>

                {/* Filter & Search Bar */}
                {allActiveStoreOrders.length > 0 && radarViewMode === 'cards' && (
                  <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                    {/* Status Tabs */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setRadarFilter('all')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          radarFilter === 'all'
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        الكل ({allActiveStoreOrders.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setRadarFilter('in_transit')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          radarFilter === 'in_transit'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60'
                        }`}
                      >
                        في الطريق ({inTransit.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setRadarFilter('ready')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          radarFilter === 'ready'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
                        }`}
                      >
                        جاهز للكابتن ({readyAssigned.length})
                      </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                      <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={radarSearch}
                        onChange={(e) => setRadarSearch(e.target.value)}
                        placeholder="بحث برقم الطلب، العميل، الكابتن، العنوان..."
                        className="w-full pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500"
                      />
                      {radarSearch && (
                        <button
                          type="button"
                          onClick={() => setRadarSearch('')}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* View 1: Global Map Mode */}
                {radarViewMode === 'map' ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs">
                    <CouriersLiveMap
                      orders={orders.filter(isStoreOrder)}
                      stores={stores}
                      couriers={couriers && couriers.length > 0 ? couriers : storeCouriers}
                      connected={connected}
                    />
                  </div>
                ) : allActiveStoreOrders.length === 0 ? (
                  /* Empty State */
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 mx-auto flex items-center justify-center shadow-2xs">
                      <Bike size={28} />
                    </div>
                    <h4 className="text-sm font-black text-slate-800">لا توجد طلبات جارية مع المناديب حالياً</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                      عندما يقوم المتجر بتجهيز الطلب وتكليف كابتن توصيل من شاشة «تحضير وتجهيز الطلبات»، ستظهر حركة الكابتن ومساره وتفاصيل العميل كاملة هنا لحظة بلحظة.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigateSection('kitchen')}
                      className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Package size={14} />
                      <span>الانتقال لشاشة تجهيز الطلبات وتكليف المناديب</span>
                    </button>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-2">
                    <p className="text-xs font-bold text-slate-600">لا توجد نتائج تطابق بحثك الحالي: «{radarSearch}»</p>
                    <button
                      type="button"
                      onClick={() => { setRadarSearch(''); setRadarFilter('all'); }}
                      className="text-xs text-orange-600 font-bold hover:underline"
                    >
                      إعادة ضبط التصفية
                    </button>
                  </div>
                ) : (
                  /* View 2: Detailed Cards Mode */
                  <div className="space-y-3">
                    {filteredOrders.map(order => (
                      <MerchantOrderTracking
                        key={order.id}
                        order={order}
                        open={trackingOrderId === order.id || (trackingOrderId === "" && filteredOrders.length <= 2)}
                        onToggle={open => setTrackingOrderId(current => open ? order.id : current === order.id ? "" : current)}
                        availableCouriers={couriers && couriers.length > 0 ? couriers : storeCouriers}
                        onAssignCourier={onAssignCourier}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          5. طاقم العمل والورديات اليومية (مطابق 100% للوحة الإدارة ومخصص للفرع)
          ════════════════════════════════════════════════════════════════════════ */}
      <section
        aria-label="طاقم العمل والورديات اليومية"
        className={`space-y-4 ${activeTab === "storeCouriers" ? "animate-in fade-in duration-200" : "hidden"}`}
      >
        <UserManagement
          stores={stores}
          fixedStoreId={userStore.id}
          mode="merchant"
          orders={orders}
        />
      </section>
      {/* Merchant Product Offer Modal */}
      {merchantOfferProduct && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            <header className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
                  <Tag size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">إدارة عرض وتخفيض الصنف</h3>
                  <p className="text-[11px] text-slate-400">تحديد سعر البيع المخفض والسعر الأصلي للظهور في عروض المتجر</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMerchantOfferProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X size={15} />
              </button>
            </header>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const orig = Number(merchantOfferOrig);
                const p = Number(merchantOfferPrice);
                if (!orig || !p || orig <= p) {
                  setMenuError("السعر قبل الخصم يجب أن يكون أكبر من سعر البيع المخفض.");
                  return;
                }
                setMerchantOfferBusy(true);
                setMenuError('');
                try {
                  await supabase.from('products').update({ price: p, original_price: orig, is_available: true }).eq('id', merchantOfferProduct.id);
                  await onUpdateProductPrice(merchantOfferProduct.id, p);
                  if (typeof onRefreshProducts === 'function') onRefreshProducts();
                  setPriceSuccessId(merchantOfferProduct.id);
                  setTimeout(() => setPriceSuccessId(null), 3000);
                  setMerchantOfferProduct(null);
                } catch (err: any) {
                  setMenuError(err?.message || "تعذر تفعيل العرض.");
                } finally {
                  setMerchantOfferBusy(false);
                }
              }}
              className="p-5 space-y-4 text-xs"
            >
              {/* Product preview */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white overflow-hidden shrink-0 border border-slate-200">
                  <MerchantProductImage src={merchantOfferProduct.imageUrl} name={merchantOfferProduct.name} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{merchantOfferProduct.name}</h4>
                  <span className="text-[10px] text-slate-500 block">{merchantOfferProduct.category}</span>
                  <span className="text-[10px] font-mono text-slate-600 block mt-0.5">السعر الأساسي: {formatEGP(merchantOfferProduct.originalPrice || merchantOfferProduct.price)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">السعر الأصلي (قبل الخصم) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={merchantOfferOrig}
                    onChange={(e) => setMerchantOfferOrig(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">سعر العرض المخفض (للزبون) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.5"
                    required
                    value={merchantOfferPrice}
                    onChange={(e) => setMerchantOfferPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-orange-300 rounded-xl font-mono text-xs font-black text-emerald-800 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Quick discount chips */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 block mb-1.5">اختيار نسبة خصم سريعة:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {[10, 15, 20, 25, 30, 50].map((pct) => {
                    const orig = Number(merchantOfferOrig) || merchantOfferProduct.price;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setMerchantOfferPrice(Math.round(orig * (1 - pct / 100)));
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-orange-100 text-slate-700 hover:text-orange-800 rounded-lg text-[11px] font-bold transition cursor-pointer"
                      >
                        خصم {pct}%
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview badge */}
              {Number(merchantOfferOrig) > Number(merchantOfferPrice) && Number(merchantOfferPrice) > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800 font-bold">
                  <span className="flex items-center gap-1.5">
                    <span>🔥</span>
                    <span>نسبة الخصم: {Math.round((1 - Number(merchantOfferPrice) / Number(merchantOfferOrig)) * 100)}%</span>
                  </span>
                  <span className="font-mono text-xs">وفرت للعميل {formatEGP(Number(merchantOfferOrig) - Number(merchantOfferPrice))}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                {Boolean(merchantOfferProduct.originalPrice && merchantOfferProduct.originalPrice > merchantOfferProduct.price) && (
                  <button
                    type="button"
                    disabled={merchantOfferBusy}
                    onClick={async () => {
                      const orig = merchantOfferProduct.originalPrice || merchantOfferProduct.price;
                      if (window.confirm(`هل ترغب في إلغاء العرض والعودة للسعر الأصلي (${orig} ج.م)؟`)) {
                        setMerchantOfferBusy(true);
                        try {
                          await supabase.from('products').update({ price: orig, original_price: null }).eq('id', merchantOfferProduct.id);
                          await onUpdateProductPrice(merchantOfferProduct.id, orig);
                          if (typeof onRefreshProducts === 'function') onRefreshProducts();
                          setPriceSuccessId(merchantOfferProduct.id);
                          setTimeout(() => setPriceSuccessId(null), 3000);
                          setMerchantOfferProduct(null);
                        } catch (err: any) {
                          setMenuError(err?.message || "تعذر إلغاء العرض.");
                        } finally {
                          setMerchantOfferBusy(false);
                        }
                      }
                    }}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold cursor-pointer transition text-xs"
                  >
                    إلغاء الخصم
                  </button>
                )}

                <div className="flex items-center gap-2 mr-auto">
                  <button
                    type="button"
                    onClick={() => setMerchantOfferProduct(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={merchantOfferBusy}
                    className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Check size={14} />
                    <span>تفعيل وحفظ العرض</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {smartImageProduct && (
        <SmartProductImageModal
          product={smartImageProduct}
          onClose={() => setSmartImageProduct(null)}
          onSelectImage={handleSelectSmartImage}
        />
      )}
        </div>
      </div>
    </div>
  );
};


function MerchantOrderTracking({
  order,
  open,
  onToggle,
  availableCouriers = [],
  onAssignCourier,
}: {
  order: Order;
  open: boolean;
  onToggle: (open: boolean) => void;
  availableCouriers?: any[];
  onAssignCourier?: (orderId: string, courierId: string, courierName?: string, courierPhone?: string) => Promise<void>;
}) {
  const [isReassigning, setIsReassigning] = useState(false);
  const [selectedCourierId, setSelectedCourierId] = useState(order.courierId || "");
  const [assignBusy, setAssignBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const isWithCourier = order.orderStatus === 'with_courier' || order.orderStatus === 'picked_up';
  const courierName = cleanCourierName(order.courierName, order.courierPhone);
  const customerName = cleanCustomerName(order.profileName, order.phone);
  const courierPhone = order.courierPhone || '';
  const customerPhone = order.phone || '';

  const cleanPhoneForWa = (p: string) => {
    let clean = p.replace(/\D/g, '');
    if (clean.startsWith('01')) clean = '2' + clean;
    return clean;
  };

  const customerWaUrl = customerPhone
    ? `https://wa.me/${cleanPhoneForWa(customerPhone)}?text=${encodeURIComponent(`السلام عليكم ${customerName}، معكم متجر سنجوب بخصوص طلبكم #${order.orderNumber}`)}`
    : '';

  const courierWaUrl = courierPhone
    ? `https://wa.me/${cleanPhoneForWa(courierPhone)}?text=${encodeURIComponent(`السلام عليكم كابتن ${courierName}، معكم متجر سنجوب بخصوص طلب #${order.orderNumber}`)}`
    : '';

  const handleReassign = async (newCourierId: string) => {
    if (!newCourierId || newCourierId === order.courierId || !onAssignCourier) return;
    const target = availableCouriers.find((c: any) => c.id === newCourierId);
    setAssignBusy(true);
    try {
      await onAssignCourier(order.id, newCourierId, target?.name || target?.full_name, target?.phone);
      setIsReassigning(false);
    } catch (e) {
      console.error(e);
    } finally {
      setAssignBusy(false);
    }
  };

  const handleCopyOrderNumber = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard?.writeText(order.orderNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // Payment badge formatting
  const renderPaymentBadge = () => {
    switch (order.paymentMethod) {
      case 'cash':
        return <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md text-[10px] font-bold">كاش عند الاستلام</span>;
      case 'instapay':
        return <span className="bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-md text-[10px] font-bold">إنستا باي</span>;
      case 'vodafone_cash':
        return <span className="bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md text-[10px] font-bold">فودافون كاش</span>;
      case 'card':
        return <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md text-[10px] font-bold">بطاقة بنكية</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-bold">دفع إلكتروني</span>;
    }
  };

  // Full destination address
  const fullDestination = [
    order.deliveryAddress || order.ministry,
    order.floorNumber ? `الدور ${order.floorNumber}` : '',
    order.roomNumber ? `مكتب/غرفة ${order.roomNumber}` : '',
  ].filter(Boolean).join(' • ') || 'العاصمة الإدارية';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all hover:border-slate-300">
      {/* ── Top Bar / Header ── */}
      <div
        onClick={() => onToggle(!open)}
        className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors"
      >
        <div className="flex items-start sm:items-center gap-3">
          {/* Status Indicator Icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
            isWithCourier ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
          }`}>
            <Bike size={20} className={isWithCourier ? 'animate-pulse' : ''} />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <strong className="text-sm font-black text-slate-900 font-mono">
                #{order.orderNumber}
              </strong>
              <button
                type="button"
                onClick={handleCopyOrderNumber}
                className="text-[10px] text-slate-500 hover:text-slate-700 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 flex items-center gap-1 cursor-pointer"
                title="نسخ رقم الطلب"
              >
                {copied ? 'تم النسخ ✓' : <Copy size={11} />}
              </button>

              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border flex items-center gap-1 ${
                isWithCourier
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isWithCourier ? 'bg-blue-500 animate-ping' : 'bg-emerald-500'}`} />
                <span>{isWithCourier ? 'في الطريق للعميل' : 'جاهز ومكلف للكابتن'}</span>
              </span>

              {renderPaymentBadge()}

              <span className="text-xs font-mono font-black text-slate-800 mr-auto sm:mr-0">
                {formatEGP(order.total)}
              </span>
            </div>

            {/* Quick Summary Line (Cleaned Names) */}
            <div className="text-xs text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
              <span>
                الكابتن: <strong className="text-slate-900 font-bold">{courierName}</strong>
              </span>
              <span>•</span>
              <span>
                العميل: <strong className="text-slate-900 font-bold">{customerName}</strong>
              </span>
              <span>•</span>
              <span className="text-slate-500 max-w-[280px] truncate" title={fullDestination}>
                📍 {fullDestination}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls & Contact Buttons */}
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0" onClick={e => e.stopPropagation()}>
          {/* Direct Courier Call */}
          {courierPhone && (
            <a
              href={`tel:${courierPhone}`}
              className="px-2.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-bold flex items-center gap-1 transition-colors"
              title="اتصال هاتفي بالكابتن"
            >
              <Phone size={13} />
              <span className="hidden sm:inline">اتصال بالكابتن</span>
            </a>
          )}

          {/* Courier WhatsApp */}
          {courierWaUrl && (
            <a
              href={courierWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1 transition-colors"
              title="محادثة واتساب مع الكابتن"
            >
              <MessageCircle size={13} />
              <span className="hidden sm:inline">واتساب</span>
            </a>
          )}

          {/* Customer Call */}
          {customerPhone && (
            <a
              href={`tel:${customerPhone}`}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors"
              title="اتصال هاتفي بالعميل"
            >
              <Phone size={13} />
              <span className="hidden sm:inline">العميل</span>
            </a>
          )}

          {/* Expand Toggle */}
          <button
            type="button"
            onClick={() => onToggle(!open)}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold transition-colors cursor-pointer"
            title={open ? "طي البطاقة" : "فتح التفاصيل والخريطة"}
          >
            {open ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* ── Expanded Deep Dossier ── */}
      {open && (
        <div className="border-t border-slate-200/80 bg-slate-50/40 p-4 space-y-4">
          {/* Dossier Grid: Customer & Courier Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 1. Customer Dossier Card */}
            <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <User size={14} className="text-blue-600" />
                  <span>بيانات العميل ووجهة التسليم</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {order.createdAt ? new Date(order.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">اسم العميل:</span>
                  <strong className="text-slate-900">{customerName}</strong>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">رقم الهاتف:</span>
                  <div className="flex items-center gap-2">
                    <span dir="ltr" className="font-mono text-slate-700">{customerPhone || 'غير متوفر'}</span>
                    {customerPhone && (
                      <a href={`tel:${customerPhone}`} className="text-blue-600 hover:underline text-[11px] font-bold">
                        اتصال
                      </a>
                    )}
                    {customerWaUrl && (
                      <a href={customerWaUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline text-[11px] font-bold">
                        واتساب
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500 shrink-0">عنوان التوصيل:</span>
                  <span className="text-slate-800 font-medium text-left text-[11px]">
                    {fullDestination}
                  </span>
                </div>

                {order.notes && (
                  <div className="p-2 bg-amber-50/80 border border-amber-200/80 rounded-lg text-[11px] text-amber-900">
                    <strong className="block text-amber-950 font-bold">ملاحظة العميل:</strong>
                    <span>{order.notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Courier Dossier Card & Reassignment */}
            <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Bike size={14} className="text-orange-600" />
                  <span>كابتن التوصيل والمسار</span>
                </span>

                {/* Inline Reassignment Toggle Button */}
                {onAssignCourier && (
                  <button
                    type="button"
                    onClick={() => setIsReassigning(!isReassigning)}
                    className="text-[10px] font-bold text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2 py-0.5 rounded border border-orange-200 transition-colors cursor-pointer"
                  >
                    {isReassigning ? 'إلغاء التغيير ✕' : 'تغيير الكابتن ↺'}
                  </button>
                )}
              </div>

              {/* Reassignment Dropdown Panel */}
              {isReassigning && onAssignCourier ? (
                <div className="p-2.5 bg-orange-50/80 border border-orange-200 rounded-xl space-y-2">
                  <label className="text-[11px] font-bold text-orange-950 block">
                    اختر كابتن متاح لإعادة تكليفه بهذا الطلب:
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={selectedCourierId}
                      onChange={(e) => setSelectedCourierId(e.target.value)}
                      className="flex-1 text-xs border border-orange-300 rounded-lg p-1.5 bg-white text-slate-800 focus:outline-none"
                    >
                      <option value="">-- اختر كابتن توصيل --</option>
                      {availableCouriers.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {cleanCourierName(c.name || c.full_name, c.phone)} {c.phone ? `(${c.phone})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={assignBusy || !selectedCourierId || selectedCourierId === order.courierId}
                      onClick={() => void handleReassign(selectedCourierId)}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      {assignBusy ? 'جارٍ…' : 'تأكيد'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">اسم الكابتن:</span>
                    <strong className="text-slate-900">{courierName}</strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">هاتف الكابتن:</span>
                    <div className="flex items-center gap-2">
                      <span dir="ltr" className="font-mono text-slate-700">{courierPhone || 'غير متوفر'}</span>
                      {courierPhone && (
                        <a href={`tel:${courierPhone}`} className="text-orange-600 hover:underline text-[11px] font-bold">
                          اتصال
                        </a>
                      )}
                      {courierWaUrl && (
                        <a href={courierWaUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline text-[11px] font-bold">
                          واتساب
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">حالة الشحنة:</span>
                    <span className="font-bold text-[11px]">
                      {isWithCourier ? '🛵 الكابتن استلم الطلب وهو في الطريق للعميل' : '📦 الطلب جاهز بالمحل بانتظار استلام الكابتن'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order Items & Invoice Breakdown */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Package size={14} className="text-slate-600" />
                <span>محتويات وأصناف الطلب ({order.items?.length || 0})</span>
              </span>
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <span>الدفع:</span>
                {renderPaymentBadge()}
              </span>
            </div>

            {/* Items List */}
            <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {(order.items || []).map((item, idx) => (
                <div key={item.id || idx} className="py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-black flex items-center justify-center font-mono">
                      {item.quantity}×
                    </span>
                    <span className="font-bold text-slate-900">{item.product?.name || 'صنف'}</span>
                    {item.notes && <span className="text-[10px] text-amber-600">({item.notes})</span>}
                  </div>
                  <span className="font-mono text-slate-700 font-bold">
                    {formatEGP((item.product?.price || 0) * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-xs font-bold">
              <div className="text-slate-500 flex items-center gap-3">
                <span>قيمة الأصناف: <strong className="text-slate-800 font-mono">{formatEGP(order.subtotal || (order.total - (order.deliveryFee || 0)))}</strong></span>
                {typeof order.deliveryFee === 'number' && (
                  <span>التوصيل: <strong className="text-slate-800 font-mono">{formatEGP(order.deliveryFee)}</strong></span>
                )}
              </div>
              <div className="text-sm font-black text-slate-900 flex items-center gap-1">
                <span>الإجمالي:</span>
                <span className="font-mono text-orange-600">{formatEGP(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Interactive Live Map */}
          <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Navigation size={14} className="text-blue-600" />
                <span>الخريطة والمسار المباشر للطلب #{order.orderNumber}</span>
              </span>
              <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>تحديث موقع الكابتن لحظي عبر GPS</span>
              </span>
            </div>

            <OrderMap
              merchant
              order={{
                id: order.id,
                orderStatus: order.orderStatus,
                coordinates: order.coordinates,
                courierId: order.courierId
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
