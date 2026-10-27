import { formatEGP } from "../utils/orderCalculations";
import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Plus, Search, RefreshCw, Users, X, ShieldCheck, ChevronLeft, ChevronRight,
  Copy, Check, MapPin, Bike, Navigation, AlertCircle, FileCheck, Stethoscope,
  Shield, Car, ExternalLink, Store as StoreIcon, UserCheck, PhoneCall, Building2,
  Calendar, Award
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

  // Form & View State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AccountRecord | null>(null);
  const [viewingUser, setViewingUser] = useState<AccountRecord | null>(null);
  const [deleteConfirmationUser, setDeleteConfirmationUser] = useState<AccountRecord | null>(null);
  const [resetLink, setResetLink] = useState('');

  // Active form field state
  const [formRole, setFormRole] = useState<UserRole>('courier');
  const [formVehicleType, setFormVehicleType] = useState('motorcycle');
  const [formLatitude, setFormLatitude] = useState('');
  const [formLongitude, setFormLongitude] = useState('');
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

  // Open Form for Create or Edit
  function openCreateForm() {
    setError('');
    setNotice('');
    setGpsError('');
    setResetLink('');
    setEditingUser(null);
    setFormRole('courier');
    setFormVehicleType('motorcycle');
    setFormLatitude('30.013056');
    setFormLongitude('31.705278');
    setIsFormOpen(true);
  }

  function openEditForm(user: AccountRecord) {
    setError('');
    setNotice('');
    setGpsError('');
    setResetLink('');
    setEditingUser(user);
    setFormRole(user.role);
    setFormVehicleType(user.vehicleType || 'motorcycle');
    setFormLatitude(user.coordinates?.latitude ? String(user.coordinates.latitude) : '');
    setFormLongitude(user.coordinates?.longitude ? String(user.coordinates.longitude) : '');
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingUser(null);
    setResetLink('');
    setError('');
    setGpsError('');
  }

  // High Precision GPS Geolocation Handler
  function handleDetectGps() {
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsError('المتصفح أو الجهاز لا يدعم التحديد الجغرافي.');
      return;
    }
    setGpsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setFormLatitude(String(lat));
        setFormLongitude(String(lng));
        setGpsDetecting(false);
        setNotice(`تم التقاط إحداثيات الموقع بدقة متناهية: (${lat}, ${lng}) بنجاح.`);
      },
      (err) => {
        setGpsDetecting(false);
        setGpsError(`تعذر التقاط الموقع عبر GPS (${err.message}). يمكنك إدخال الإحداثيات يدوياً.`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
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
      action,
      uid: editingUser?.uid,
      role: formRole,
      vehicleType: formRole === 'courier' ? formVehicleType : undefined,
      hasThermalBox: data.hasThermalBox === 'on' || data.hasThermalBox === 'true',
      hasThermalBackpack: data.hasThermalBackpack === 'on' || data.hasThermalBackpack === 'true',
      latitude: formLatitude || undefined,
      longitude: formLongitude || undefined
    };

    try {
      const result = await adminApi('users', payload);
      if (result.resetLink) {
        setResetLink(result.resetLink);
        setNotice('تم قيد الحساب بنجاح، ونسخ رابط تعيين كلمة المرور متاح الآن.');
      } else {
        setIsFormOpen(false);
        setEditingUser(null);
        setNotice(editingUser ? 'تم تحديث بيانات القيد بنجاح.' : 'تم إضافة وقيد السجل الجديد بنجاح.');
      }
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
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
      {/* 1. Header & Breadcrumbs (Image 3 & 4 Style) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1.5">
              <span>الرئيسية</span>
              <span>&gt;</span>
              <span>إدارة المنظومة</span>
              <span>&gt;</span>
              <span className="text-teal-700 font-bold">سجل وإدارة المناديب والتجار والكوادر التشغيلية</span>
            </div>

            {/* Title & Subtitle */}
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              سجل وإدارة جهات التحضير والمناديب والتجار
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              إدارة وتصنيف المناديب والمتاجر والعملاء، وتحديد التبعية التشغيلية والفحص الطبي والجنائي والتجهيزات الميدانية (صندوق حراري، فيش جنائي، فحص مخدرات، لوكيشن GPS) بدقة متناهية.
            </p>
          </div>

          {/* Action Button: Toggle Create Form */}
          <div className="shrink-0 flex items-center gap-2">
            {!isFormOpen ? (
              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Plus size={16} />
                <span>إضافة قيد معتمد جديد</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={closeForm}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer border border-slate-300"
              >
                <X size={16} />
                <span>إلغاء الإضافة</span>
              </button>
            )}
          </div>
        </div>

        {/* Success / Alert Banner (Image 3 Style) */}
        {notice && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200/80 text-emerald-800 rounded-xl text-xs font-medium flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <Check size={16} className="text-emerald-600 shrink-0" />
              <span>{notice}</span>
            </div>
            <button type="button" onClick={() => setNotice('')} className="text-emerald-600 hover:text-emerald-800 text-xs font-bold cursor-pointer">
              إغلاق
            </button>
          </div>
        )}

        {/* Global Error Notice */}
        {error && !isFormOpen && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* 2. Structured Inline Form (Image 4 Style - When isFormOpen is true) */}
      {isFormOpen && (
        <div className="bg-white rounded-2xl border border-teal-200 shadow-sm p-5 animate-fadeIn">
          <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                <FileCheck size={18} className="text-teal-700" />
                <span>{editingUser ? `تعديل بيانات القيد المعتمد: ${editingUser.fullName || editingUser.email}` : 'إضافة قيد معتمد جديد (مندوب / تاجر / عميل)'}</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                تظهر هذه البيانات للمنظومة لضمان أعلى معايير السلامة والأمان وسرعة التوصيل وحساب المسافات الجغرافية الدقيقة.
              </p>
            </div>
            <button type="button" onClick={closeForm} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Section A: Basic Account Credentials */}
            <div>
              <h3 className="text-xs font-bold text-slate-700 mb-2.5 flex items-center gap-1.5">
                <UserCheck size={14} className="text-teal-700" />
                <span>1. البيانات الأساسية ونوع الحساب</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">اسم الحساب / الاسم بالكامل *</label>
                  <input
                    name="fullName"
                    required
                    maxLength={120}
                    defaultValue={editingUser?.fullName}
                    placeholder="مثال: أحمد محمود علي أو مطعم البرنس"
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">نوع وتصنيف الحساب *</label>
                  <select
                    name="role"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-white"
                  >
                    <option value="courier">كابتن / مندوب توصيل معتمد</option>
                    <option value="restaurant">تاجر / مطبخ تحضير شريك</option>
                    <option value="employee">عميل (موظف بالحي الحكومي)</option>
                    <option value="admin">مدير المنظومة (صلاحيات كاملة)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">البريد الإلكتروني المعتمد *</label>
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={160}
                    dir="ltr"
                    defaultValue={editingUser?.email}
                    placeholder="courier@sangoub.com"
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">رقم الهاتف الأساسي (واتساب) *</label>
                  <input
                    name="phone"
                    required
                    maxLength={30}
                    defaultValue={editingUser?.phone}
                    placeholder="01012345678"
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Section B: Courier Full KYC Profile (When role is courier) */}
            {formRole === 'courier' && (
              <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                  <h3 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Bike size={15} className="text-amber-700" />
                    <span>2. ملف التحقق والاعتماد الجنائي والطبي للمندوب (KYC كامل)</span>
                  </h3>
                  <span className="text-[10px] bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-md font-bold">
                    معايير السلامة والأمان
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">اسم الشهرة (المتداول)</label>
                    <input
                      name="nickname"
                      maxLength={80}
                      defaultValue={editingUser?.nickname}
                      placeholder="مثال: كابتن النسر / أبو يوسف"
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">الرقم القومي (14 رقم بالكامل) *</label>
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
                    <label className="block text-slate-700 font-bold mb-1">هاتف الطوارئ (قريب / مرجع) *</label>
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
                    <label className="block text-slate-700 font-bold mb-1">حالة الاعتماد التشغيلي</label>
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

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">العنوان الحالي الفعلي *</label>
                    <input
                      name="currentAddress"
                      required
                      maxLength={200}
                      defaultValue={editingUser?.currentAddress}
                      placeholder="الشارع والمنطقة الحالية"
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">العنوان المسجل ببطاقة الرقم القومي *</label>
                    <input
                      name="idCardAddress"
                      required
                      maxLength={200}
                      defaultValue={editingUser?.idCardAddress}
                      placeholder="العنوان المدون بالبطاقة"
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">وسيلة التوصيل المعتمدة *</label>
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
                    <label className="block text-slate-700 font-bold mb-1">الماركة والموديل وسنة الصنع</label>
                    <input
                      name="vehicleModel"
                      maxLength={60}
                      defaultValue={editingUser?.vehicleModel}
                      placeholder="مثال: دايون 4 موديل 2024 / بجاج"
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">رقم لوحة المركبة (أرقام وحروف)</label>
                    <input
                      name="vehiclePlate"
                      maxLength={30}
                      defaultValue={editingUser?.vehiclePlate}
                      placeholder="مثال: س ع ق 1 9 4"
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">رقم رخصة القيادة</label>
                    <input
                      name="drivingLicenseNumber"
                      maxLength={60}
                      defaultValue={editingUser?.drivingLicenseNumber}
                      placeholder="رقم الرخصة المسجل بالمرور"
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">تاريخ انتهاء رخصة القيادة</label>
                    <input
                      name="licenseExpiryDate"
                      type="date"
                      defaultValue={editingUser?.licenseExpiryDate}
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">فحص تحليل المخدرات *</label>
                    <select
                      name="drugTestStatus"
                      defaultValue={editingUser?.drugTestStatus || 'passed'}
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                    >
                      <option value="passed">معتمد وسلبي (خالٍ من المواد المخدرة) ✓</option>
                      <option value="pending">قيد إجراء الفحص المعملي ⏳</option>
                      <option value="failed">غير لائق / إيجابي ✕</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">تاريخ إجراء فحص المخدرات</label>
                    <input
                      name="drugTestDate"
                      type="date"
                      defaultValue={editingUser?.drugTestDate}
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">شهادة الفيش الجنائي (صحيفة الحالة) *</label>
                    <select
                      name="criminalRecordStatus"
                      defaultValue={editingUser?.criminalRecordStatus || 'passed'}
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                    >
                      <option value="passed">سليم وخالٍ من السوابق والأحكام ✓</option>
                      <option value="pending">قيد استخراج الصحيفة ⏳</option>
                      <option value="failed">توجد سوابق / غير مقبول ✕</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">تاريخ استخراج الفيش الجنائي</label>
                    <input
                      name="criminalRecordDate"
                      type="date"
                      defaultValue={editingUser?.criminalRecordDate}
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                </div>

                {/* Equipment Checkboxes */}
                <div className="pt-2 border-t border-amber-200/50 flex flex-wrap items-center gap-6 text-xs text-slate-800">
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
            )}

            {/* Section C: Merchant & High-Precision Location (When role is restaurant) */}
            {formRole === 'restaurant' && (
              <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                  <h3 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <MapPin size={15} className="text-emerald-700" />
                    <span>2. بيانات المتجر والموقع الجغرافي الدقيق (GPS High-Precision)</span>
                  </h3>
                  <span className="text-[10px] bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded-md font-bold">
                    دقة 6 أرقام عشرية لحساب المسافات
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">المتجر التابع له الحساب *</label>
                    <select
                      name="storeId"
                      required
                      defaultValue={editingUser?.storeId || ''}
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                    >
                      <option value="" disabled>اختر المتجر أو الفرع</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.locationInDistrict || s.type})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">المهمة التشغيلية بالمتجر</label>
                    <select
                      name="duty"
                      defaultValue={editingUser?.duty || 'manager'}
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                    >
                      <option value="manager">مسؤول ومدير المتجر</option>
                      <option value="preparer">شيف / مسؤول جمع وتحضير الطلبات</option>
                    </select>
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

                  {/* High Precision GPS Coordinates */}
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

                  <div className="sm:col-span-2 flex items-end gap-2">
                    <button
                      type="button"
                      onClick={handleDetectGps}
                      disabled={gpsDetecting}
                      className="h-9 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MapPin size={15} />
                      <span>{gpsDetecting ? 'جارٍ قراءة GPS بدقة عالية...' : '📍 جلب اللوكيشن الفعلي عبر GPS الآن'}</span>
                    </button>

                    {formLatitude && formLongitude && (
                      <a
                        href={`https://maps.google.com/?q=${formLatitude},${formLongitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="h-9 px-3 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <ExternalLink size={14} />
                        <span>معاينة على الخريطة</span>
                      </a>
                    )}
                  </div>
                </div>

                {gpsError && (
                  <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-md font-medium">{gpsError}</p>
                )}

                {/* Smart Dispatching Algorithm Note */}
                <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200 text-[11px] text-emerald-900 flex items-start gap-2">
                  <Navigation size={15} className="text-emerald-700 shrink-0 mt-0.5" />
                  <p>
                    <strong>خوارزمية الإسناد الذكي:</strong> يتم احتساب المسافة الدقيقة بصيغة Haversine بين المتجر والمندوب والعميل لحظياً. للمسافات الأقل من 2 كم ترشح الدراجات الهوائية، ومن 2 إلى 8 كم ترشح الموتسيكلات المزودة بصندوق حراري عازل للحفاظ على معايير سخونة الوجبات.
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
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

            {/* Form Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Check size={16} />
                  <span>{busy ? 'جارٍ حفظ وقيد السجل...' : 'حفظ وقيد السجل المعتمَد'}</span>
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={busy}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  إلغاء الأمر
                </button>
              </div>

              {resetLink && (
                <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 text-xs text-emerald-800">
                  <span>تم إنشاء رابط كلمة المرور:</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(resetLink, 'reset-link')}
                    className="font-bold underline text-emerald-900 hover:text-emerald-950"
                  >
                    {copiedUid === 'reset-link' ? 'نُسخ الرابط ✓' : 'نسخ الرابط لصاحب الحساب'}
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
      )}

      {/* 3. KPI Summary Row (Image 3 Style: 5 Distinct Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Users */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-bold text-slate-500">إجمالي الحسابات</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{kpiData.total}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0">
            <Building2 size={20} />
          </div>
        </div>

        {/* Card 2: Couriers */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-bold text-slate-500">مناديب التوصيل</p>
            <p className="text-xl font-black text-amber-700 mt-0.5">{kpiData.couriers}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Bike size={20} />
          </div>
        </div>

        {/* Card 3: Merchants */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-bold text-slate-500">المتاجر والشركاء (GPS)</p>
            <p className="text-xl font-black text-emerald-700 mt-0.5">{kpiData.merchants}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <StoreIcon size={20} />
          </div>
        </div>

        {/* Card 4: Employees */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-bold text-slate-500">عملاء الحي الحكومي</p>
            <p className="text-xl font-black text-purple-700 mt-0.5">{kpiData.employees}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
        </div>

        {/* Card 5: Verified & Active */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-bold text-slate-500">مفعلة وموثقة بالسجل</p>
            <p className="text-xl font-black text-teal-700 mt-0.5">{kpiData.verified}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
        </div>
      </div>

      {/* 4. Search & Filter Bar (Image 3 Style) */}
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

      {/* 5. Main Enterprise Data Table (Image 3 Style) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                <th className="py-3 px-3.5 text-center w-10">#</th>
                <th className="py-3 px-3.5">اسم الحساب / الشهرة</th>
                <th className="py-3 px-3.5">النوع والتصنيف</th>
                <th className="py-3 px-3.5">التوثيق الجنائي والفحص الطبي</th>
                <th className="py-3 px-3.5">الوسيلة والتجهيزات / اللوكيشن</th>
                <th className="py-3 px-3.5 text-center">الحالة</th>
                <th className="py-3 px-3.5 text-center w-48">التحكم والإجراءات</th>
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

                    {/* Account Name & Nickname */}
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingUser(user)}
                          className="hover:text-teal-700 hover:underline cursor-pointer text-right"
                        >
                          {user.fullName || 'بدون اسم محدد'}
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
                          <p className="text-[10px] text-slate-400">
                            نطاق: {user.coverageRadiusKm || 8} كم · توصيل ذكي
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

                    {/* Action Buttons (Image 3 Style: Outline تعديل, Text إيقاف, Red حذف) */}
                    <td className="py-3 px-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5 justify-center">
                        <button
                          type="button"
                          onClick={() => openEditForm(user)}
                          className="px-2.5 py-1 border border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-md transition-colors cursor-pointer"
                        >
                          تعديل
                        </button>

                        <button
                          type="button"
                          disabled={user.uid === auth.currentUser?.uid || busy}
                          onClick={() => handleToggleStatus(user)}
                          className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                            user.disabled
                              ? 'text-emerald-700 hover:bg-emerald-50'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                          }`}
                        >
                          {user.disabled ? 'تفعيل' : 'إيقاف'}
                        </button>

                        <button
                          type="button"
                          disabled={user.uid === auth.currentUser?.uid || busy}
                          onClick={() => setDeleteConfirmationUser(user)}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-[11px] font-bold rounded-md transition-colors cursor-pointer"
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

      {/* 6. Modal for Viewing Full Record Details */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 p-5 shadow-2xl animate-fadeIn space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-teal-700" />
                  <span>الملف التعريفي والتوثيقي الكامل: {viewingUser.fullName || viewingUser.email}</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">UID: {viewingUser.uid}</p>
              </div>
              <button type="button" onClick={() => setViewingUser(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 font-bold block mb-0.5">الاسم والشهرة</span>
                <span className="font-black text-slate-800">{viewingUser.fullName || '—'} {viewingUser.nickname ? `(شهرة: ${viewingUser.nickname})` : ''}</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 font-bold block mb-0.5">الدور والتصنيف</span>
                <span className="font-black text-slate-800">{roleNames[viewingUser.role] || viewingUser.role}</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 font-bold block mb-0.5">الهاتف وهاتف الطوارئ</span>
                <span className="font-bold text-slate-800">هاتف: {viewingUser.phone || '—'} · طوارئ: {viewingUser.emergencyPhone || '—'}</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 font-bold block mb-0.5">الرقم القومي</span>
                <span className="font-mono font-bold text-slate-800 tracking-wider">{viewingUser.nationalId || '—'}</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 font-bold block mb-0.5">العنوان الحالي</span>
                <span className="font-medium text-slate-800">{viewingUser.currentAddress || '—'}</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 font-bold block mb-0.5">العنوان بالبطاقة</span>
                <span className="font-medium text-slate-800">{viewingUser.idCardAddress || '—'}</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 font-bold block mb-0.5">المركبة وتجهيزاتها</span>
                <span className="font-bold text-slate-800">
                  {vehicleNames[viewingUser.vehicleType || ''] || viewingUser.vehicleType || '—'}
                  {viewingUser.vehicleModel ? ` (${viewingUser.vehicleModel})` : ''}
                  {viewingUser.vehiclePlate ? ` - لوحة [${viewingUser.vehiclePlate}]` : ''}
                </span>
                <div className="text-[11px] text-teal-700 mt-1">
                  {viewingUser.hasThermalBox ? 'مزود بصندوق حراري عازل ✓' : ''}
                  {viewingUser.hasThermalBackpack ? 'مزود بشنطة ظهر حرارية ✓' : ''}
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 font-bold block mb-0.5">رخصة القيادة وتاريخ انتهائها</span>
                <span className="font-bold text-slate-800">
                  رقم: {viewingUser.drivingLicenseNumber || '—'} · انتهاء: {viewingUser.licenseExpiryDate || '—'}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 font-bold block mb-0.5">فحص المخدرات</span>
                <span className="font-bold text-slate-800">
                  {viewingUser.drugTestStatus === 'passed' ? 'سلبي معتمد ✓' : viewingUser.drugTestStatus === 'failed' ? 'إيجابي ✕' : 'قيد الفحص'}
                  {viewingUser.drugTestDate ? ` (تاريخ: ${viewingUser.drugTestDate})` : ''}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 font-bold block mb-0.5">صحيفة الحالة الجنائية (الفيش)</span>
                <span className="font-bold text-slate-800">
                  {viewingUser.criminalRecordStatus === 'passed' ? 'سليم وخالٍ من السوابق ✓' : 'غير متوفر / قيد الاستخراج'}
                  {viewingUser.criminalRecordDate ? ` (تاريخ: ${viewingUser.criminalRecordDate})` : ''}
                </span>
              </div>

              {viewingUser.coordinates && (
                <div className="sm:col-span-2 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                  <span className="text-emerald-800 font-bold block mb-0.5">الإحداثيات الجغرافية الدقيقة (GPS)</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-emerald-900 font-bold">
                      Lat: {viewingUser.coordinates.latitude} · Lng: {viewingUser.coordinates.longitude}
                    </span>
                    <a
                      href={`https://maps.google.com/?q=${viewingUser.coordinates.latitude},${viewingUser.coordinates.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-emerald-700 underline flex items-center gap-1"
                    >
                      <ExternalLink size={12} />
                      <span>فتح خرائط جوجل</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingUser(null)}
                className="px-5 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal for Delete Confirmation */}
      {deleteConfirmationUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
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
