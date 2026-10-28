import { AccountAccessDialog } from './AccountAccessDialog';
import { formatEGP } from "../utils/orderCalculations";
import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Plus, Search, RefreshCw, Users, X, ShieldCheck, ChevronLeft, ChevronRight,
  Copy, Check, MapPin, Bike, Navigation, AlertCircle, FileCheck, Stethoscope,
  Shield, Car, ExternalLink, Store as StoreIcon, UserCheck, PhoneCall, Building2,
  Calendar, Award, Eye, Edit3, Power, Trash2
} from 'lucide-react';
import { adminApi } from '../lib/adminApi';
import type { Store, UserRole } from '../types';
import { auth } from '../lib/firebase';

const roleNames: Record<string, string> = {
  employee: 'عميل (موظف حكومي)',
  restaurant: 'تاجر / مطبخ تحضير',
  courier: 'كابتن / مندوب توصيل',
  admin: 'مدير المنظومة'
};

const vehicleNames: Record<string, string> = {
  motorcycle: 'دراجة نارية (موتسيكل)',
  bicycle: 'دراجة هوائية (عجلة)',
  car: 'سيارة نقل / ملاكي'
};

export interface AccountRecord {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  storeId: string;
  duty?: string;
  disabled: boolean;
  emailVerified: boolean;
  ministry: string;
  floorNumber: string;
  roomNumber: string;
  providers: string[];
  lastSignInAt: string;
  createdAt: string;
  walletBalance: number;
  // Courier KYC Fields
  nickname?: string;
  nationalId?: string;
  emergencyPhone?: string;
  currentAddress?: string;
  locationAddress?: string;
  idCardAddress?: string;
  vehicleType?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  drivingLicenseNumber?: string;
  licenseExpiryDate?: string;
  drugTestStatus?: 'passed' | 'failed' | 'pending';
  drugTestDate?: string;
  criminalRecordStatus?: 'passed' | 'failed' | 'pending';
  criminalRecordDate?: string;
  hasThermalBox?: boolean;
  hasThermalBackpack?: boolean;
  courierStatus?: 'active' | 'pending' | 'suspended';
  // Merchant / GPS Fields
  coordinates?: { latitude: number; longitude: number } | null;
  coverageRadiusKm?: number;
  preferredDeliveryMethod?: 'bicycle' | 'motorcycle' | 'car' | 'auto';
}

export function UserManagement({ stores }: { stores: Store[] }) {
  const [users, setUsers] = useState<AccountRecord[]>([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [page, setPage] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  // Pop-up Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AccountRecord | null>(null);
  const [viewingUser, setViewingUser] = useState<AccountRecord | null>(null);
  const [deleteConfirmationUser, setDeleteConfirmationUser] = useState<AccountRecord | null>(null);
  const [resetLink, setResetLink] = useState('');
  const [accessAccount,setAccessAccount]=useState<{email:string;role:string}|null>(null);

  // Form State
  const [formRole, setFormRole] = useState<UserRole>('courier');
  const [formFullName, setFormFullName] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [formVehicleType, setFormVehicleType] = useState('motorcycle');
  const [formLatitude, setFormLatitude] = useState('');
  const [formLongitude, setFormLongitude] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [gpsError, setGpsError] = useState('');

  const request = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut Ctrl+K to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch accounts from API
  useEffect(() => {
    const id = ++request.current;
    setLoading(true);
    setError('');
    adminApi('users', { action: 'list', pageToken: cursors[page] || undefined, search })
      .then((result) => {
        if (id === request.current) {
          setUsers(result.users);
          setNext(result.nextPageToken);
        }
      })
      .catch((e) => {
        if (id === request.current) {
          setUsers([]);
          setError(e.message);
        }
      })
      .finally(() => {
        if (id === request.current) setLoading(false);
      });
    return () => {
      request.current++;
    };
  }, [page, search, revision]);

  // Open Form Modal for Create
  function openCreateForm() {
    setError('');
    setNotice('');
    setGpsError('');
    setResetLink('');
    setEditingUser(null);
    setFormRole('courier');
    setFormFullName('');
    setFormAddress('الحي الحكومي، العاصمة الإدارية الجديدة، القاهرة، مصر');
    setSelectedStoreId(stores[0]?.id || '');
    setFormVehicleType('motorcycle');
    setFormLatitude('30.011799');
    setFormLongitude('31.74804');
    setIsFormModalOpen(true);
  }

  // Open Form Modal for Edit
  function openEditForm(user: AccountRecord) {
    setError('');
    setNotice('');
    setGpsError('');
    setResetLink('');
    setEditingUser(user);
    setFormRole(user.role);
    setFormFullName(user.fullName || '');
    setFormAddress(user.locationAddress || user.currentAddress || '');
    setSelectedStoreId(user.storeId || stores[0]?.id || '');
    setFormVehicleType(user.vehicleType || 'motorcycle');
    setFormLatitude(user.coordinates?.latitude ? String(user.coordinates.latitude) : '');
    setFormLongitude(user.coordinates?.longitude ? String(user.coordinates.longitude) : '');
    setIsFormModalOpen(true);
  }

  function closeFormModal() {
    setIsFormModalOpen(false);
    setEditingUser(null);
    setResetLink('');
    setError('');
    setGpsError('');
  }

  // Handle Store Selection Change for Merchants
  function handleStoreChange(storeId: string) {
    setSelectedStoreId(storeId);
    const store = stores.find((s) => s.id === storeId);
    if (store) {
      if (!formFullName || formFullName === 'مطعم' || formFullName.trim() === '') {
        setFormFullName(store.name);
      }
      if (store.locationInDistrict || store.preciseAddress) {
        setFormAddress(store.preciseAddress || store.locationInDistrict || '');
      }
      if (store.coordinates) {
        setFormLatitude(String(store.coordinates.latitude));
        setFormLongitude(String(store.coordinates.longitude));
      }
    }
  }

  // Reverse geocoding helper to extract detailed street, district and city in Arabic
  async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ar`,
        {
          headers: {
            'Accept-Language': 'ar',
            'User-Agent': 'SangoubDelivery/2.0'
          },
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          const addr = data.address || {};
          const parts = [
            addr.office || addr.amenity || addr.building || addr.shop || data.name,
            addr.road || addr.street,
            addr.neighbourhood || addr.suburb || addr.quarter,
            addr.city || addr.town || addr.municipality || 'العاصمة الإدارية الجديدة',
            addr.state || addr.governorate || 'القاهرة',
            'مصر'
          ].filter(Boolean);

          const uniqueParts: string[] = [];
          for (const p of parts) {
            const trimmed = String(p).trim();
            if (trimmed && !uniqueParts.some((up) => up.includes(trimmed) || trimmed.includes(up))) {
              uniqueParts.push(trimmed);
            }
          }
          if (uniqueParts.length > 0) {
            return uniqueParts.join('، ');
          }
          return String(data.display_name).trim();
        }
      }
    } catch {
      // Graceful fallback
    }
    return `مقر معتمد، الحي الحكومي، العاصمة الإدارية الجديدة (إحداثيات: ${lat.toFixed(5)}, ${lng.toFixed(5)})`;
  }

  // High Precision GPS Geolocation Handler + Automatic Detailed Arabic Address Resolution
  function handleDetectGps() {
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsError('المتصفح أو الجهاز لا يدعم التحديد الجغرافي.');
      return;
    }
    setGpsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setFormLatitude(String(lat));
        setFormLongitude(String(lng));
        setGpsDetecting(false);

        // Auto-fetch detailed Arabic address from coordinates
        setGeocoding(true);
        try {
          const detailedAddr = await reverseGeocode(lat, lng);
          setFormAddress(detailedAddr);
          setNotice(`تم التقاط الموقع وكتابة العنوان بالتفصيل: ${detailedAddr}`);
        } catch {
          setNotice(`تم التقاط إحداثيات الموقع: (${lat}, ${lng}) بنجاح.`);
        } finally {
          setGeocoding(false);
        }
      },
      (err) => {
        setGpsDetecting(false);
        setGpsError(`تعذر التقاط الموقع عبر GPS (${err.message}). يمكنك إدخال الإحداثيات والعنوان يدوياً.`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // Manual Trigger to resolve detailed address from entered coordinates
  async function handleManualReverseGeocode() {
    const lat = Number(formLatitude);
    const lng = Number(formLongitude);
    if (!lat || !lng || Number.isNaN(lat) || Number.isNaN(lng)) {
      setGpsError('يرجى إدخال خط العرض وخط الطول بصيغة رقمية صحيحة أولاً.');
      return;
    }
    setGeocoding(true);
    setGpsError('');
    try {
      const detailedAddr = await reverseGeocode(lat, lng);
      setFormAddress(detailedAddr);
      setNotice(`تم استخراج وتحديث العنوان بالتفصيل: ${detailedAddr}`);
    } catch {
      setGpsError('تعذر استخراج العنوان تلقائياً، يمكنك كتابته يدوياً.');
    } finally {
      setGeocoding(false);
    }
  }

  // Submit Handler for Create / Update
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData.entries());
    setBusy(true);
    setError('');
    setNotice('');

    const action = editingUser ? 'update' : 'create';
    const payload: Record<string, any> = {
      ...data,
      fullName: formFullName || data.fullName,
      action,
      uid: editingUser?.uid,
      role: formRole,
      storeId: formRole === 'restaurant' ? selectedStoreId : (data.storeId || ''),
      vehicleType: formRole === 'courier' ? formVehicleType : undefined,
      hasThermalBox: data.hasThermalBox === 'on' || data.hasThermalBox === 'true',
      hasThermalBackpack: data.hasThermalBackpack === 'on' || data.hasThermalBackpack === 'true',
      latitude: formLatitude || undefined,
      longitude: formLongitude || undefined,
      locationAddress: formAddress || undefined,
      currentAddress: formRole === 'restaurant' ? (formAddress || undefined) : (data.currentAddress || formAddress || undefined)
    };

    try {
      const result = await adminApi('users', payload);
      setIsFormModalOpen(false);
      setEditingUser(null);
      if (result.resetLink) {
        setResetLink(result.resetLink);
        setAccessAccount({email:String(data.email),role:formRole});
        setNotice('حُفظ الحساب. سلّم رابط تعيين كلمة المرور لصاحبه؛ لم يُرسل بريد تلقائيًا.');
      } else {
        setNotice('تم تحديث بيانات الحساب وصلاحياته بنجاح.');
      }
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordSetup(user:AccountRecord){
    setBusy(true);setError('');setResetLink('');
    try{const result=await adminApi('users',{action:'reset',uid:user.uid,reason:'إصدار رابط تعيين كلمة المرور لصاحب الحساب بناء على طلب الإدارة'});setResetLink(result.resetLink);setAccessAccount({email:user.email,role:user.role});}
    catch{setError('تعذر إصدار رابط تعيين كلمة المرور. تحقق من حالة الحساب وأعد المحاولة.');}
    finally{setBusy(false);}
  }

  // Quick Action Handlers
  async function handleToggleStatus(user: AccountRecord) {
    const action = user.disabled ? 'enable' : 'disable';
    const reason = user.disabled ? 'إعادة تفعيل الحساب للتشغيل الميداني' : 'إيقاف مؤقت للحساب لمراجعة السجلات';
    setBusy(true);
    setError('');
    try {
      await adminApi('users', { action, uid: user.uid, reason });
      setNotice(`تم ${user.disabled ? 'تفعيل' : 'تعطيل'} حساب (${user.fullName || user.email}) بنجاح.`);
      setRevision((v) => v + 1);
      if (viewingUser && viewingUser.uid === user.uid) {
        setViewingUser({ ...viewingUser, disabled: !viewingUser.disabled });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteConfirm(user: AccountRecord) {
    setBusy(true);
    setError('');
    try {
      await adminApi('users', { action: 'delete', uid: user.uid, confirmation: user.uid, reason: 'حذف معتمد من واجهة إدارة السجلات' });
      setDeleteConfirmationUser(null);
      if (viewingUser?.uid === user.uid) setViewingUser(null);
      setNotice(`تم حذف حساب (${user.fullName || user.uid}) نهائياً من المنظومة.`);
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedUid(id);
      setTimeout(() => setCopiedUid(null), 2500);
    });
  }

  // Calculations for KPI Cards
  const kpiData = useMemo(() => {
    const total = users.length;
    const couriers = users.filter((u) => u.role === 'courier').length;
    const merchants = users.filter((u) => u.role === 'restaurant').length;
    const employees = users.filter((u) => u.role === 'employee').length;
    const verified = users.filter((u) => !u.disabled && (u.drugTestStatus === 'passed' || u.criminalRecordStatus === 'passed' || u.role === 'admin' || u.emailVerified)).length;
    return { total, couriers, merchants, employees, verified };
  }, [users]);

  // Filtered accounts
  const visibleUsers = useMemo(() => {
    return users.filter((user) => {
      if (roleFilter && user.role !== roleFilter) return false;
      if (verificationFilter === 'passed') {
        if (user.role === 'courier' && (user.drugTestStatus !== 'passed' || user.criminalRecordStatus !== 'passed')) return false;
      }
      if (verificationFilter === 'pending') {
        if (user.role === 'courier' && user.drugTestStatus !== 'pending' && user.criminalRecordStatus !== 'pending') return false;
      }
      return true;
    });
  }, [users, roleFilter, verificationFilter]);

  return (
    <section className="space-y-4 max-w-7xl mx-auto" aria-label="إدارة وسجل الحسابات" dir="rtl">
      {/* 1. Header & Breadcrumbs (Image 3 Egyptian Cabinet Style: Compact & Crisp) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mb-1">
              <span>الرئيسية</span>
              <span>&gt;</span>
              <span>إدارة المنظومة</span>
              <span>&gt;</span>
              <span className="text-teal-700 font-bold">سجل جهات التحضير والمناديب والتجار</span>
            </div>

            {/* Title & Subtitle */}
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              سجل وإدارة جهات التحضير والمناديب والتجار
            </h1>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              إدارة وتصنيف المناديب والمتاجر، ومتابعة الفحص الطبي والجنائي وإحداثيات الموقع بدقة.
            </p>
          </div>

          {/* Action Button */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={15} />
              <span>+ إضافة قيد معتمد جديد</span>
            </button>
          </div>
        </div>

        {/* Success / Alert Banner (Exact Image 3 Style) */}
        {notice && (
          <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200/90 text-emerald-800 rounded-lg text-xs font-medium flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <Check size={15} className="text-emerald-600 shrink-0" />
              <span>{notice}</span>
            </div>
            <button type="button" onClick={() => setNotice('')} className="text-emerald-600 hover:text-emerald-800 text-xs font-bold cursor-pointer">
              إغلاق
            </button>
          </div>
        )}

        {/* Global Error Notice */}
        {error && !isFormModalOpen && (
          <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* 2. KPI Summary Row (Exact Image 3 Proportions & Icons) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Users */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-bold text-slate-500">إجمالي الحسابات</p>
            <p className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">{kpiData.total}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <Building2 size={17} />
          </div>
        </div>

        {/* Card 2: Couriers */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-bold text-slate-500">مناديب التوصيل</p>
            <p className="text-lg sm:text-xl font-black text-amber-700 mt-0.5">{kpiData.couriers}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Bike size={17} />
          </div>
        </div>

        {/* Card 3: Merchants */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-bold text-slate-500">المتاجر والشركاء</p>
            <p className="text-lg sm:text-xl font-black text-blue-700 mt-0.5">{kpiData.merchants}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <StoreIcon size={17} />
          </div>
        </div>

        {/* Card 4: Employees */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-bold text-slate-500">عملاء المنظومة</p>
            <p className="text-lg sm:text-xl font-black text-purple-700 mt-0.5">{kpiData.employees}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Users size={17} />
          </div>
        </div>

        {/* Card 5: Verified & Active */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-bold text-slate-500">مفعلة ومعتمدة</p>
            <p className="text-lg sm:text-xl font-black text-emerald-700 mt-0.5">{kpiData.verified}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Check size={17} />
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar (Image 3 Style) */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setCursors([null]);
            setSearch(query.trim());
            setRevision((v) => v + 1);
          }}
          className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-lg"
        >
          <div className="relative flex-1">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث سريع: بالاسم، الرقم القومي، الهاتف، أو اسم المتجر..."
              className="w-full h-9 pr-9 pl-14 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-teal-600 bg-slate-50/50"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded font-mono">
              Ctrl+K
            </span>
          </div>
          <button type="submit" disabled={loading} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer">
            بحث
          </button>
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 px-3 border border-slate-200 rounded-lg text-xs bg-white font-medium"
          >
            <option value="">جميع الأنواع (مناديب، تجار، عملاء، إدارة)</option>
            <option value="courier">مناديب التوصيل (الكباتن)</option>
            <option value="restaurant">المتاجر والشركاء</option>
            <option value="employee">عملاء الحي الحكومي</option>
            <option value="admin">مديرو المنظومة</option>
          </select>

          {/* Verification Filter */}
          <select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
            className="h-9 px-3 border border-slate-200 rounded-lg text-xs bg-white font-medium"
          >
            <option value="">جميع حالات التوثيق</option>
            <option value="passed">معتمد ومفحوص طبياً وجنائياً ✓</option>
            <option value="pending">قيد الفحص والمراجعة ⏳</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setSearch('');
              setQuery('');
              setRoleFilter('');
              setVerificationFilter('');
              setPage(0);
              setCursors([null]);
              setRevision((v) => v + 1);
            }}
            disabled={loading}
            title="تحديث البيانات"
            className="h-9 px-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg flex items-center justify-center cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Records Count Badge */}
          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg whitespace-nowrap">
            معروض {visibleUsers.length} من إجمالي {users.length}
          </span>
        </div>
      </div>

      {/* 4. Main Enterprise Data Table (Image 3 Style with Eye Preview Approach) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                <th className="py-2.5 px-3 text-center w-10">#</th>
                <th className="py-2.5 px-3">اسم الحساب / الشهرة</th>
                <th className="py-2.5 px-3">النوع والتصنيف</th>
                <th className="py-2.5 px-3">الفحص الطبي والجنائي</th>
                <th className="py-2.5 px-3">الوسيلة / اللوكيشن</th>
                <th className="py-2.5 px-3 text-center">الحالة</th>
                <th className="py-2.5 px-3 text-center w-48">التحكم والإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleUsers.map((user, index) => {
                const isCourier = user.role === 'courier';
                const isMerchant = user.role === 'restaurant';
                const store = stores.find((s) => s.id === user.storeId);

                return (
                  <tr key={user.uid} className="hover:bg-slate-50/70 transition-colors">
                    {/* Index */}
                    <td className="py-3 px-3.5 text-center font-bold text-slate-400 text-[11px]">
                      {page * 50 + index + 1}
                    </td>

                    {/* Account Name & Nickname - Clicking opens the Full Profile Modal */}
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingUser(user)}
                          title="انقر لفتح واستعراض كامل بيانات الحساب"
                          className="hover:text-teal-700 hover:underline cursor-pointer text-right flex items-center gap-1.5 group"
                        >
                          <Eye size={13} className="text-teal-600 opacity-70 group-hover:opacity-100 shrink-0" />
                          <span>{user.fullName || 'بدون اسم محدد'}</span>
                        </button>
                        {user.nickname && (
                          <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-normal">
                            «{user.nickname}»
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span dir="ltr">{user.phone || user.email || '—'}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(user.uid, user.uid)}
                          title={`UID: ${user.uid}`}
                          className="hover:text-slate-600 text-[10px] flex items-center gap-0.5 cursor-pointer"
                        >
                          {copiedUid === user.uid ? (
                            <span className="text-emerald-600 font-bold">تم النسخ ✓</span>
                          ) : (
                            <>
                              <Copy size={10} />
                              <span>UID</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Role & Duty */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            user.role === 'courier'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : user.role === 'restaurant'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : user.role === 'admin'
                              ? 'bg-slate-100 text-slate-800 border-slate-300'
                              : 'bg-purple-50 text-purple-800 border-purple-200'
                          }`}
                        >
                          {roleNames[user.role] || user.role}
                        </span>
                        {store && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            · {store.name}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Drug & Criminal Clearances (KYC) */}
                    <td className="py-3 px-3.5">
                      {isCourier ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span
                              className={`px-1.5 py-0.5 rounded border font-bold ${
                                user.drugTestStatus === 'passed'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : user.drugTestStatus === 'failed'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              مخدرات: {user.drugTestStatus === 'passed' ? 'سلبي معتمد ✓' : user.drugTestStatus === 'failed' ? 'إيجابي ✕' : 'قيد الفحص ⏳'}
                            </span>

                            <span
                              className={`px-1.5 py-0.5 rounded border font-bold ${
                                user.criminalRecordStatus === 'passed'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : user.criminalRecordStatus === 'failed'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              فيش: {user.criminalRecordStatus === 'passed' ? 'سليم ✓' : user.criminalRecordStatus === 'failed' ? 'سوابق ✕' : 'قيد الاستخراج'}
                            </span>
                          </div>
                          {user.nationalId && (
                            <p className="text-[10px] text-slate-400 font-mono tracking-wider">
                              ق: {user.nationalId}
                            </p>
                          )}
                        </div>
                      ) : isMerchant ? (
                        <div className="text-[11px] text-slate-600 font-medium">
                          {user.duty === 'manager' ? 'مسؤول المتجر المعتمد' : 'شيف / مسؤول تحضير'}
                          <p className="text-[10px] text-slate-400">{user.emailVerified ? 'البريد موثق ✓' : 'في انتظار التوثيق'}</p>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500">
                          {user.ministry ? `${user.ministry}` : '—'}
                          {user.floorNumber && <span className="text-[10px] text-slate-400"> (دور {user.floorNumber})</span>}
                        </div>
                      )}
                    </td>

                    {/* Vehicle / Thermal Equipment OR GPS Location */}
                    <td className="py-3 px-3.5">
                      {isCourier ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                            {user.vehicleType === 'bicycle' ? <Bike size={13} className="text-teal-600" /> : <Car size={13} className="text-amber-600" />}
                            <span>{vehicleNames[user.vehicleType || 'motorcycle'] || user.vehicleType || 'موتسيكل'}</span>
                            {user.vehiclePlate && (
                              <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1 py-0.2 rounded">
                                {user.vehiclePlate}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            {user.hasThermalBox && (
                              <span className="text-emerald-700 font-bold">صندوق حراري ✓</span>
                            )}
                            {user.hasThermalBackpack && (
                              <span className="text-teal-700 font-bold">شنطة حرارية ✓</span>
                            )}
                          </div>
                        </div>
                      ) : user.coordinates ? (
                        <div className="space-y-0.5">
                          <a
                            href={`https://maps.google.com/?q=${user.coordinates.latitude},${user.coordinates.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-800 hover:text-emerald-950 font-bold underline"
                          >
                            <MapPin size={12} className="text-emerald-600" />
                            <span>
                              {user.coordinates.latitude.toFixed(4)}, {user.coordinates.longitude.toFixed(4)}
                            </span>
                          </a>
                          <p className="text-[10px] text-slate-500 max-w-[200px] truncate" title={user.locationAddress || user.currentAddress || ''}>
                            {user.locationAddress || user.currentAddress || `نطاق: ${user.coverageRadiusKm || 8} كم · توصيل ذكي`}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Status Pill (Image 3 Style: Green Pill with Checkmark) */}
                    <td className="py-3 px-3.5 text-center">
                      {!user.disabled ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span>نشطة ومتاحة للقيد</span>
                          <Check size={12} />
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <span>معطل</span>
                          <X size={12} />
                        </span>
                      )}
                    </td>

                    {/* Action Buttons: Prominent Eye Button + Edit + Status Toggle + Delete */}
                    <td className="py-3 px-3.5 text-center">
                      <div className="inline-flex items-center gap-1 justify-center">
                        {/* Eye Button for Full Profile Inspection (النهج المعتمد) */}
                        <button
                          type="button"
                          onClick={() => setViewingUser(user)}
                          title="معاينة الملف والبيانات الكاملة"
                          className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[11px] font-bold rounded-md transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Eye size={13} />
                          <span>معاينة</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => openEditForm(user)}
                          className="px-2 py-1 border border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-md transition-colors cursor-pointer"
                        >
                          تعديل
                        </button>

                        <button type="button" disabled={busy||user.disabled||!user.email} onClick={()=>void handlePasswordSetup(user)} className="px-2 py-1 border rounded-md text-xs">تعيين كلمة المرور</button>
                        {/* Toggle Status */}
                        <button
                          type="button"
                          disabled={user.uid === auth.currentUser?.uid || busy}
                          onClick={() => handleToggleStatus(user)}
                          className={`px-1.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                            user.disabled
                              ? 'text-emerald-700 hover:bg-emerald-50'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                          }`}
                        >
                          {user.disabled ? 'تفعيل' : 'إيقاف'}
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          disabled={user.uid === auth.currentUser?.uid || busy}
                          onClick={() => setDeleteConfirmationUser(user)}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-md transition-colors cursor-pointer"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {!loading && !visibleUsers.length && (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Users size={32} className="mx-auto text-slate-300" />
            <p className="font-bold text-sm text-slate-600">لا توجد حسابات أو قيود مطابقة لمعايير البحث</p>
            <p className="text-xs">جرّب مسح نص البحث أو تغيير نوع التصفية المختار.</p>
          </div>
        )}

        {/* Pagination (Image 3 Bottom Controls) */}
        <div className="border-t border-slate-200 p-3 bg-slate-50/50 flex items-center justify-between text-xs text-slate-600">
          <button
            type="button"
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => p - 1)}
            className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 bg-white rounded-lg font-bold hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
          >
            <ChevronRight size={15} />
            <span>الصفحة السابقة</span>
          </button>

          <span className="font-bold text-slate-700">صفحة {page + 1}</span>

          <button
            type="button"
            disabled={!next || loading}
            onClick={() => {
              setCursors((c) => [...c.slice(0, page + 1), next]);
              setPage((p) => p + 1);
            }}
            className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 bg-white rounded-lg font-bold hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
          >
            <span>الصفحة التالية</span>
            <ChevronLeft size={15} />
          </button>
        </div>
      </div>

      {/* 5. POP-UP MODAL: Structured Multi-Section Form (Image 4 & User Request) */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl flex flex-col max-h-[92vh] animate-fadeIn">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/60 rounded-t-2xl">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <FileCheck size={16} className="text-teal-700" />
                  <span>
                    {editingUser
                      ? `تعديل القيد: ${editingUser.fullName || editingUser.email}`
                      : 'إضافة قيد جديد'}
                  </span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  أدخل بيانات الحساب والتحقق المطلوب لإضافته للمنظومة.
                </p>
              </div>
              <button
                type="button"
                onClick={closeFormModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2 font-bold">
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              <form id="user-mgmt-form" onSubmit={handleSubmit} className="space-y-4">
                {/* Section A: Basic Account Credentials */}
                <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-200/60 pb-2">
                    <UserCheck size={15} className="text-teal-700" />
                    <span>1. البيانات الأساسية ونوع الحساب</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">اسم الحساب / الاسم بالكامل *</label>
                      <input
                        name="fullName"
                        required
                        maxLength={120}
                        value={formFullName}
                        onChange={(e) => setFormFullName(e.target.value)}
                        placeholder="مثال: أحمد محمود علي أو مطعم البرنس"
                        className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-teal-600 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">نوع وتصنيف الحساب *</label>
                      <select
                        name="role"
                        value={formRole}
                        onChange={(e) => setFormRole(e.target.value as UserRole)}
                        className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-teal-600 bg-white font-bold"
                      >
                        <option value="courier">كابتن / مندوب توصيل معتمد</option>
                        <option value="restaurant">تاجر / مطبخ تحضير شريك</option>
                        <option value="employee">عميل (موظف بالحي الحكومي)</option>
                        <option value="admin">مدير المنظومة (صلاحيات كاملة)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">البريد الإلكتروني المعتمد *</label>
                      <input
                        name="email"
                        type="email"
                        required
                        maxLength={160}
                        dir="ltr"
                        defaultValue={editingUser?.email}
                        placeholder="user@sangoub.com"
                        className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-teal-600 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">رقم الهاتف الأساسي (واتساب) *</label>
                      <input
                        name="phone"
                        required
                        maxLength={30}
                        defaultValue={editingUser?.phone}
                        placeholder="01012345678"
                        className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-teal-600 bg-white"
                      />
                    </div>
                  </div>

                  {/* PROMINENT STORE SELECTOR: Shown right in Section 1 when role is Merchant / Restaurant */}
                  {formRole === 'restaurant' && (
                    <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-emerald-50/70 p-3 rounded-lg border border-emerald-200">
                      <div>
                        <label className="block text-emerald-950 font-bold mb-1 flex items-center gap-1">
                          <StoreIcon size={14} className="text-emerald-700" />
                          <span>اختيار المتجر / التاجر التابع له الحساب *</span>
                        </label>
                        <select
                          name="storeId"
                          required
                          value={selectedStoreId}
                          onChange={(e) => handleStoreChange(e.target.value)}
                          className="w-full h-9 px-3 border border-emerald-300 rounded-lg text-xs bg-white font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                        >
                          <option value="" disabled>-- اختر المتجر أو التاجر المعتمد --</option>
                          {stores.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.locationInDistrict || s.type})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-emerald-950 font-bold mb-1">المهمة التشغيلية بالمتجر</label>
                        <select
                          name="duty"
                          defaultValue={editingUser?.duty || 'manager'}
                          className="w-full h-9 px-3 border border-emerald-300 rounded-lg text-xs bg-white font-medium"
                        >
                          <option value="manager">مسؤول ومدير المتجر</option>
                          <option value="preparer">شيف / مسؤول جمع وتحضير الطلبات</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section B: Courier Full KYC Profile (Structured in 3 Clear Groups) */}
                {formRole === 'courier' && (
                  <div className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                      <h3 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <Bike size={15} className="text-amber-700" />
                        <span>2. ملف التحقق والاعتماد الجنائي والطبي للمندوب (KYC كامل)</span>
                      </h3>
                      <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md font-bold">
                        معايير السلامة والأمان
                      </span>
                    </div>

                    {/* Group 1: Personal & Contact */}
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-bold text-slate-700">أ. بيانات الهوية والتواصل:</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">اسم الشهرة (المتداول)</label>
                          <input
                            name="nickname"
                            maxLength={80}
                            defaultValue={editingUser?.nickname}
                            placeholder="مثال: كابتن النسر"
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">الرقم القومي (14 رقماً) *</label>
                          <input
                            name="nationalId"
                            required
                            maxLength={14}
                            pattern="[0-9]{14}"
                            defaultValue={editingUser?.nationalId}
                            placeholder="29801011234567"
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white tracking-widest font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">هاتف الطوارئ (قريب / مرجع) *</label>
                          <input
                            name="emergencyPhone"
                            required
                            maxLength={30}
                            defaultValue={editingUser?.emergencyPhone}
                            placeholder="01298765432"
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">حالة الاعتماد التشغيلي</label>
                          <select
                            name="courierStatus"
                            defaultValue={editingUser?.courierStatus || 'active'}
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                          >
                            <option value="active">نشط ومتاح لاستقبال الطلبات</option>
                            <option value="pending">قيد الفحص والتوثيق الأمني</option>
                            <option value="suspended">موقوف مؤقتاً</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-slate-600 font-bold mb-1">العنوان الحالي الفعلي *</label>
                          <input
                            name="currentAddress"
                            required
                            maxLength={200}
                            defaultValue={editingUser?.currentAddress}
                            placeholder="الشارع والمنطقة السكنية الحالية"
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-slate-600 font-bold mb-1">العنوان المسجل ببطاقة الرقم القومي *</label>
                          <input
                            name="idCardAddress"
                            required
                            maxLength={200}
                            defaultValue={editingUser?.idCardAddress}
                            placeholder="العنوان الرسمي المدون بالبطاقة"
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Group 2: Vehicle & Equipment */}
                    <div className="space-y-2 pt-2 border-t border-amber-200/60">
                      <h4 className="text-[11px] font-bold text-slate-700">ب. المركبة ورخصة القيادة:</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">وسيلة التوصيل المعتمدة *</label>
                          <select
                            name="vehicleType"
                            value={formVehicleType}
                            onChange={(e) => setFormVehicleType(e.target.value)}
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                          >
                            <option value="motorcycle">دراجة نارية (موتسيكل)</option>
                            <option value="bicycle">دراجة هوائية (عجلة)</option>
                            <option value="car">سيارة نقل / ملاكي</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">الماركة والموديل وسنة الصنع</label>
                          <input
                            name="vehicleModel"
                            maxLength={60}
                            defaultValue={editingUser?.vehicleModel}
                            placeholder="مثال: دايون 4 موديل 2024"
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">رقم لوحة المركبة</label>
                          <input
                            name="vehiclePlate"
                            maxLength={30}
                            defaultValue={editingUser?.vehiclePlate}
                            placeholder="مثال: س ع ق 1 9 4"
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">رقم رخصة القيادة</label>
                          <input
                            name="drivingLicenseNumber"
                            maxLength={60}
                            defaultValue={editingUser?.drivingLicenseNumber}
                            placeholder="رقم الرخصة بالمرور"
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">تاريخ انتهاء رخصة القيادة</label>
                          <input
                            name="licenseExpiryDate"
                            type="date"
                            defaultValue={editingUser?.licenseExpiryDate}
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                          />
                        </div>
                      </div>

                      {/* Equipment Checkboxes */}
                      <div className="pt-2 flex flex-wrap items-center gap-6 text-slate-800">
                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                          <input
                            type="checkbox"
                            name="hasThermalBox"
                            defaultChecked={editingUser?.hasThermalBox ?? true}
                            className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                          />
                          <span>هل الموتسيكل مجهز بصندوق عازل حراري لحفظ سخونة وجودة الأطعمة؟</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                          <input
                            type="checkbox"
                            name="hasThermalBackpack"
                            defaultChecked={editingUser?.hasThermalBackpack ?? false}
                            className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                          />
                          <span>هل العجلة / الدراجة مجهزة بشنطة ظهر حرارية عازلة؟</span>
                        </label>
                      </div>
                    </div>

                    {/* Group 3: Medical & Criminal KYC */}
                    <div className="space-y-2 pt-2 border-t border-amber-200/60">
                      <h4 className="text-[11px] font-bold text-slate-700">ج. الفحص الجنائي والطبي (KYC):</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">فحص تحليل المخدرات *</label>
                          <select
                            name="drugTestStatus"
                            defaultValue={editingUser?.drugTestStatus || 'passed'}
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                          >
                            <option value="passed">معتمد وسلبي (خالٍ من المواد المخدرة) ✓</option>
                            <option value="pending">قيد إجراء الفحص المعملي ⏳</option>
                            <option value="failed">غير لائق / إيجابي ✕</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">تاريخ إجراء فحص المخدرات</label>
                          <input
                            name="drugTestDate"
                            type="date"
                            defaultValue={editingUser?.drugTestDate}
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">شهادة الفيش الجنائي (صحيفة الحالة) *</label>
                          <select
                            name="criminalRecordStatus"
                            defaultValue={editingUser?.criminalRecordStatus || 'passed'}
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                          >
                            <option value="passed">سليم وخالٍ من السوابق والأحكام ✓</option>
                            <option value="pending">قيد استخراج الصحيفة ⏳</option>
                            <option value="failed">توجد سوابق / غير مقبول ✕</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">تاريخ استخراج الفيش الجنائي</label>
                          <input
                            name="criminalRecordDate"
                            type="date"
                            defaultValue={editingUser?.criminalRecordDate}
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section C: Merchant & High-Precision Location (Clean & Balanced) */}
                {formRole === 'restaurant' && (
                  <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-xl p-4 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                      <h3 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <MapPin size={15} className="text-emerald-700" />
                        <span>2. بيانات الموقع الجغرافي الدقيق للتاجر (GPS High-Precision)</span>
                      </h3>
                      <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-md font-bold">
                        دقة 6 أرقام عشرية لحساب المسافات
                      </span>
                    </div>

                    {/* GPS Actions Bar */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDetectGps}
                        disabled={gpsDetecting || geocoding}
                        className="h-9 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <MapPin size={15} />
                        <span>{gpsDetecting ? 'جارٍ قراءة GPS بدقة...' : geocoding ? 'جارٍ استخراج العنوان التفصيلي...' : '📍 جلب اللوكيشن الفعلي عبر GPS الآن'}</span>
                      </button>

                      {formLatitude && formLongitude && (
                        <a
                          href={`https://maps.google.com/?q=${formLatitude},${formLongitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="h-9 px-3.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors"
                        >
                          <ExternalLink size={14} />
                          <span>معاينة على الخريطة</span>
                        </a>
                      )}
                    </div>

                    {/* Coordinates & Coverage */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">خط العرض (Latitude) بدقة 6 خانات *</label>
                        <input
                          name="latitude"
                          value={formLatitude}
                          onChange={(e) => setFormLatitude(e.target.value)}
                          placeholder="30.013056"
                          required
                          className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white font-mono dir-ltr"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">خط الطول (Longitude) بدقة 6 خانات *</label>
                        <input
                          name="longitude"
                          value={formLongitude}
                          onChange={(e) => setFormLongitude(e.target.value)}
                          placeholder="31.705278"
                          required
                          className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white font-mono dir-ltr"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">نصف قطر التغطية (كم)</label>
                        <input
                          name="coverageRadiusKm"
                          type="number"
                          step="0.5"
                          min="1"
                          max="50"
                          defaultValue={editingUser?.coverageRadiusKm || 8}
                          className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">طريقة التوصيل الموصى بها</label>
                        <select
                          name="preferredDeliveryMethod"
                          defaultValue={editingUser?.preferredDeliveryMethod || 'auto'}
                          className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                        >
                          <option value="auto">تلقائي حسب المسافة المحسوبة للعميل</option>
                          <option value="bicycle">دراجة هوائية (للمسافات &lt; 2 كم)</option>
                          <option value="motorcycle">دراجة نارية بصندوق عازل (2-8 كم)</option>
                          <option value="car">سيارة نقل للطلبات الكبيرة (&gt; 8 كم)</option>
                        </select>
                      </div>
                    </div>

                    {/* Detailed Physical Address (Auto Geocoded) */}
                    <div className="bg-white/95 p-3 rounded-xl border border-emerald-300/80 shadow-2xs space-y-1.5">
                      <label className="block text-slate-800 font-bold flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <MapPin size={14} className="text-emerald-700" />
                          <span>العنوان التفصيلي للمقر / المتجر (يُكتب تلقائياً عند جلب اللوكيشن ويُسجل بقاعدة البيانات) *</span>
                        </span>
                        {geocoding && (
                          <span className="text-[10px] text-teal-700 font-bold animate-pulse flex items-center gap-1">
                            <RefreshCw size={11} className="animate-spin" />
                            <span>جارٍ استخراج العنوان من الخرائط...</span>
                          </span>
                        )}
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          name="locationAddress"
                          value={formAddress}
                          onChange={(e) => setFormAddress(e.target.value)}
                          placeholder="مثال: مبنى وزارة الصحة والسكان، ميدان 4، الحي الحكومي، العاصمة الإدارية الجديدة، مصر"
                          required
                          className="flex-1 h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white font-medium focus:border-emerald-600 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleManualReverseGeocode}
                          disabled={geocoding || !formLatitude || !formLongitude}
                          title="إعادة استخراج العنوان من الإحداثيات الحالية"
                          className="h-9 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer shrink-0"
                        >
                          <RefreshCw size={12} className={geocoding ? 'animate-spin' : ''} />
                          <span>استخراج من الإحداثيات</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Check size={12} className="text-emerald-600 shrink-0" />
                        <span>يُسجل هذا العنوان التفصيلي في قاعدة بيانات المتجر وحساب التاجر لحساب المسافة وتوجيه المندوب والعميل بدقة.</span>
                      </p>
                    </div>

                    {gpsError && (
                      <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-md font-medium">{gpsError}</p>
                    )}

                    {/* Concise Haversine Dispatch Note */}
                    <div className="bg-white/80 p-2 rounded-lg border border-emerald-200 text-[11px] text-emerald-900 flex items-center gap-2">
                      <Navigation size={14} className="text-emerald-700 shrink-0" />
                      <p>
                        <strong>خوارزمية الإسناد الذكي:</strong> احتساب المسافة الدقيقة بصيغة Haversine بين المتجر والمندوب والعميل لحظياً لتحديد وسيلة التوصيل الأنسب.
                      </p>
                    </div>
                  </div>
                )}

                {/* Section D: Government Employee (When role is employee) */}
                {formRole === 'employee' && (
                  <div className="bg-purple-50/50 border border-purple-200/80 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                      <Building2 size={15} className="text-purple-700" />
                      <span>2. بيانات موظف الوزارة ومقر العمل</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">الوزارة أو الهيئة الحكومية</label>
                        <input
                          name="ministry"
                          maxLength={120}
                          defaultValue={editingUser?.ministry}
                          placeholder="مثال: وزارة الاتصالات وتكنولوجيا المعلومات"
                          className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">رقم الدور بالمبنى</label>
                        <input
                          name="floorNumber"
                          maxLength={60}
                          defaultValue={editingUser?.floorNumber}
                          placeholder="مثال: الدور الرابع"
                          className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">رقم المكتب</label>
                        <input
                          name="roomNumber"
                          maxLength={80}
                          defaultValue={editingUser?.roomNumber}
                          placeholder="مثال: مكتب 402"
                          className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-xl border bg-orange-50 text-xs leading-6"><strong>بيانات الدخول</strong><p>{editingUser?'تعديل البيانات لا يغيّر كلمة المرور الحالية. لإعادة تعيينها استخدم زر «تعيين كلمة المرور» في قائمة الحسابات. تغيير البريد يتطلب تأكيده مجددًا.':'سيُنشأ الحساب بكلمة مرور عشوائية غير معروضة، ثم تحصل على رابط خاص ليختار صاحب الحساب كلمته قبل الدخول.'}</p></div>
                {/* Section E: Audit Reason & Notes */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <label className="block text-slate-700 font-bold text-xs mb-1">
                    سبب العملية وملاحظات التدقيق الأمني *
                  </label>
                  <textarea
                    name="reason"
                    required
                    minLength={5}
                    maxLength={500}
                    rows={2}
                    placeholder="اكتب سبب قيد أو تعديل الحساب (مثال: قيد كابتن جديد مستوفٍ لشروط الفيش والمخدرات والصندوق الحراري)"
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-teal-600"
                  />
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200/80 bg-slate-50/70 rounded-b-2xl flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  form="user-mgmt-form"
                  disabled={busy}
                  className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Check size={16} />
                  <span>{busy ? 'جارٍ حفظ وقيد السجل...' : 'حفظ وقيد السجل المعتمَد'}</span>
                </button>
                <button
                  type="button"
                  onClick={closeFormModal}
                  disabled={busy}
                  className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  إلغاء الأمر
                </button>
              </div>


            </div>
          </div>
        </div>
      )}

      {accessAccount&&resetLink&&<AccountAccessDialog email={accessAccount.email} role={accessAccount.role} link={resetLink} onClose={()=>{setAccessAccount(null);setResetLink('')}}/>}

      {/* 6. POP-UP MODAL: Full Comprehensive Profile Inspection (نهج بطاقة المعاينة الشاملة - زر العين) */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl flex flex-col max-h-[92vh] animate-fadeIn">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70 rounded-t-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-teal-700" />
                    <span>بيانات الحساب: {viewingUser.fullName || viewingUser.email}</span>
                  </h3>
                  {!viewingUser.disabled ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      نشط ومتاح ✓
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      معطل
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">UID: {viewingUser.uid}</p>
              </div>

              <button
                type="button"
                onClick={() => setViewingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Section 1: Personal & Identity */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <UserCheck size={14} className="text-teal-700" />
                  <span>البيانات الشخصية والهوية</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-400 font-bold block mb-0.5 text-[10px]">الاسم الكامل والشهرة</span>
                    <span className="font-black text-slate-800">
                      {viewingUser.fullName || '—'} {viewingUser.nickname ? `(شهرة: ${viewingUser.nickname})` : ''}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-400 font-bold block mb-0.5 text-[10px]">الدور والتصنيف</span>
                    <span className="font-black text-slate-800">{roleNames[viewingUser.role] || viewingUser.role}</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-400 font-bold block mb-0.5 text-[10px]">الرقم القومي (14 رقماً)</span>
                    <span className="font-mono font-bold text-slate-800 tracking-wider">
                      {viewingUser.nationalId || '—'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-400 font-bold block mb-0.5 text-[10px]">أرقام التواصل</span>
                    <span className="font-bold text-slate-800">
                      هاتف: {viewingUser.phone || '—'} · طوارئ: {viewingUser.emergencyPhone || '—'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-400 font-bold block mb-0.5 text-[10px]">العنوان الحالي الفعلي</span>
                    <span className="font-medium text-slate-800">{viewingUser.currentAddress || '—'}</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-400 font-bold block mb-0.5 text-[10px]">العنوان المسجل بالبطاقة</span>
                    <span className="font-medium text-slate-800">{viewingUser.idCardAddress || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Safety & Clearances (KYC) */}
              {viewingUser.role === 'courier' && (
                <div>
                  <h4 className="text-xs font-bold text-amber-900 mb-2 flex items-center gap-1.5">
                    <Shield size={14} className="text-amber-700" />
                    <span>التوثيق والسلامة والفحص الطبي والجنائي</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-200">
                      <span className="text-amber-800 font-bold block mb-0.5 text-[10px]">تحليل المخدرات</span>
                      <span className="font-bold text-slate-800">
                        {viewingUser.drugTestStatus === 'passed' ? 'سلبي معتمد (سليم وخالٍ من المخدرات) ✓' : viewingUser.drugTestStatus === 'failed' ? 'إيجابي ✕' : 'قيد الفحص'}
                        {viewingUser.drugTestDate ? ` — تاريخ: ${viewingUser.drugTestDate}` : ''}
                      </span>
                    </div>

                    <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-200">
                      <span className="text-amber-800 font-bold block mb-0.5 text-[10px]">صحيفة الحالة الجنائية (الفيش)</span>
                      <span className="font-bold text-slate-800">
                        {viewingUser.criminalRecordStatus === 'passed' ? 'سليم وخالٍ من السوابق والأحكام ✓' : 'غير متوفر / قيد الاستخراج'}
                        {viewingUser.criminalRecordDate ? ` — تاريخ: ${viewingUser.criminalRecordDate}` : ''}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-bold block mb-0.5 text-[10px]">رخصة القيادة وتاريخ انتهائها</span>
                      <span className="font-bold text-slate-800">
                        رقم: {viewingUser.drivingLicenseNumber || '—'} · انتهاء: {viewingUser.licenseExpiryDate || '—'}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-bold block mb-0.5 text-[10px]">المركبة وتجهيزات الحفظ الحراري</span>
                      <span className="font-bold text-slate-800 block">
                        {vehicleNames[viewingUser.vehicleType || ''] || viewingUser.vehicleType || '—'}
                        {viewingUser.vehicleModel ? ` (${viewingUser.vehicleModel})` : ''}
                        {viewingUser.vehiclePlate ? ` - لوحة [${viewingUser.vehiclePlate}]` : ''}
                      </span>
                      <div className="flex items-center gap-3 text-[11px] text-teal-800 font-bold mt-1">
                        {viewingUser.hasThermalBox && <span>صندوق حراري عازل ✓</span>}
                        {viewingUser.hasThermalBackpack && <span>شنطة ظهر حرارية ✓</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 3: Merchant & GPS Location */}
              {viewingUser.coordinates && (
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 space-y-2">
                  <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <MapPin size={14} className="text-emerald-700" />
                    <span>الموقع الجغرافي الدقيق (GPS High-Precision)</span>
                  </h4>

                  {(viewingUser.locationAddress || viewingUser.currentAddress) && (
                    <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-200 text-xs text-emerald-950">
                      <span className="font-bold text-emerald-900 block mb-0.5 text-[11px]">العنوان التفصيلي المسجل بقاعدة البيانات:</span>
                      <span className="font-medium text-slate-800 leading-relaxed">
                        {viewingUser.locationAddress || viewingUser.currentAddress}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="font-mono text-emerald-900 font-bold text-xs">
                      خط العرض: {viewingUser.coordinates.latitude} · خط الطول: {viewingUser.coordinates.longitude}
                    </span>
                    <a
                      href={`https://maps.google.com/?q=${viewingUser.coordinates.latitude},${viewingUser.coordinates.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-md font-bold text-xs flex items-center gap-1 transition-colors self-start"
                    >
                      <ExternalLink size={12} />
                      <span>فتح خرائط جوجل مباشرة</span>
                    </a>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    نطاق التغطية: {viewingUser.coverageRadiusKm || 8} كم · طريقة التوصيل الموصى بها: {viewingUser.preferredDeliveryMethod === 'bicycle' ? 'دراجة هوائية' : viewingUser.preferredDeliveryMethod === 'motorcycle' ? 'دراجة نارية بصندوق عازل' : 'تلقائي حسب المسافة'}
                  </p>
                </div>
              )}

              {/* Section 4: System & Metadata */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-[11px] text-slate-500">
                <div className="flex items-center justify-between">
                  <span>البريد الإلكتروني: <strong className="text-slate-700" dir="ltr">{viewingUser.email}</strong> ({viewingUser.emailVerified ? 'موثق ✓' : 'غير موثق'})</span>
                  <span>الرصيد المالي المسجل: <strong className="text-slate-800 font-mono">{formatEGP(viewingUser.walletBalance)}</strong></span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span>تاريخ الإنشاء: {new Date(viewingUser.createdAt).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}</span>
                  <span>آخر تسجيل دخول: {viewingUser.lastSignInAt ? new Date(viewingUser.lastSignInAt).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }) : 'لم يسجل الدخول بعد'}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer with Actions */}
            <div className="p-4 border-t border-slate-200/80 bg-slate-50/70 rounded-b-2xl flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const u = viewingUser;
                    setViewingUser(null);
                    openEditForm(u);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit3 size={14} />
                  <span>تعديل هذا السجل</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleStatus(viewingUser)}
                  className={`px-3 py-2 border rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    viewingUser.disabled
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {viewingUser.disabled ? 'تفعيل الحساب' : 'إيقاف الحساب مؤقتاً'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setViewingUser(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal for Delete Confirmation */}
      {deleteConfirmationUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 p-5 shadow-2xl animate-fadeIn space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertCircle size={22} />
              <h3 className="text-base font-black">تأكيد حذف الحساب نهائياً</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              هل أنت متأكد من حذف حساب (<strong>{deleteConfirmationUser.fullName || deleteConfirmationUser.email}</strong>)؟ سيتم إلغاء صلاحياته وحذف حسابه من Firebase Authentication نهائياً.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmationUser(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConfirm(deleteConfirmationUser)}
                disabled={busy}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                {busy ? 'جارٍ الحذف...' : 'نعم، حذف الحساب'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
