import { searchOsm } from '../services/osmClient';
import { placeAddress } from '../services/deliveryAddress';
import { validateAccount, cairoToday } from '../validation/accounts';
import { AccountAccessDialog } from './AccountAccessDialog';
import { formatEGP } from "../utils/orderCalculations";
import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Plus, Search, RefreshCw, Users, X, ShieldCheck, ChevronLeft, ChevronRight,
  Copy, Check, MapPin, Bike, Navigation, AlertCircle, FileCheck, Stethoscope,
  Shield, Car, ExternalLink, Store as StoreIcon, UserCheck, PhoneCall, Building2,
  Calendar, Award, Eye, Edit3, Power, Trash2, Camera, Upload, User,
  Send, Sparkles, Lock, EyeOff, Clock, CheckCircle2, Wallet, DollarSign, Coins
} from 'lucide-react';
import { adminApi } from '../lib/adminApi';
import type { Store, UserRole } from '../types';
import { auth } from '../lib/firebase';

const roleNames: Record<string, string> = {
  employee: 'عميل / مستخدم المنظومة',
  restaurant: 'تاجر / طاقم تحضير',
  courier: 'كابتن / مندوب توصيل',
  admin: 'مدير المنظومة'
};

export const dutyNames: Record<string, string> = {
  manager: 'مدير الفرع المعتمد',
  cashier: 'كاشير ونقاط البيع (POS)',
  accountant: 'محاسب الفرع والورديات',
  preparer: 'شيف / محضر المطبخ'
};

export interface WorkShiftRecord {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  duty?: string;
  avatarUrl?: string;
  storeId: string;
  shiftDate: string;
  openedAt: string;
  closedAt?: string;
  status: 'open' | 'closed';
  ordersHandled: number;
  expectedGross: number;
  expectedCash: number;
  expectedElectronic: number;
  expectedInstapay: number;
  actualCashHandover?: number;
  cashVariance?: number;
  carriedOverToNextDay?: boolean;
  notes?: string;
  closedBy?: string;
}

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
  avatarUrl?: string;
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
  licenseIssueDate?: string;
  vehicleYear?: string;
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

export interface UserManagementProps {
  stores: Store[];
  fixedStoreId?: string;
  mode?: "admin" | "merchant";
  orders?: any[];
}

export function UserManagement({ stores, fixedStoreId, mode = "admin", orders = [] }: UserManagementProps) {
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [accessAccount, setAccessAccount] = useState<{
    email: string;
    role: string;
    fullName?: string;
    phone?: string;
    password?: string;
    storeName?: string;
  } | null>(null);

  // Form State
  const [formRole, setFormRole] = useState<UserRole>('employee');
  const [formDuty, setFormDuty] = useState<'manager' | 'cashier' | 'accountant' | 'preparer'>('manager');
  const [merchantSubTab, setMerchantSubTab] = useState<'accounts' | 'shifts'>('accounts');
  const [shifts, setShifts] = useState<WorkShiftRecord[]>(() => {
    if (!fixedStoreId) return [];
    try {
      const saved = localStorage.getItem('sangoub_shifts_' + fixedStoreId);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [reconcilingShift, setReconcilingShift] = useState<{ user: AccountRecord; stats: any } | null>(null);
  const [reconcileActualCash, setReconcileActualCash] = useState<number | string>('');
  const [reconcileCarryOver, setReconcileCarryOver] = useState(false);
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [reconcileBusy, setReconcileBusy] = useState(false);

  const SLUG_TO_UUID: Record<string, string> = {
    'store-foul-hind': '27d12743-8106-4ef0-ba3c-84abefdb75d6',
    'store-supermarket-capital': '54a6c2f6-6c29-4177-ac65-32fadddea83d',
    'store-ministry-coffee': '55508f0e-f818-452e-b946-ab803fe9d637',
    'store-karam-elsham': '27d12743-8106-4ef0-ba3c-84abefdb75d6',
    'store-taza-bakery': '55508f0e-f818-452e-b946-ab803fe9d637',
  };

  function matchStoreId(a?: string, b?: string): boolean {
    if (!a || !b) return false;
    if (a === b) return true;
    const uuidA = SLUG_TO_UUID[a] || a;
    const uuidB = SLUG_TO_UUID[b] || b;
    return uuidA === uuidB;
  }

  const baseUsers = useMemo<AccountRecord[]>(() => {
    if (!fixedStoreId) return users;
    const matched = users.filter((u) => matchStoreId(u.storeId, fixedStoreId) || (u.role === 'courier' && (!u.storeId || matchStoreId(u.storeId, fixedStoreId))));
    if (matched.length === 0) {
      const defaultStaff: AccountRecord[] = [
        {
          uid: 'staff-cashier-1',
          fullName: 'أحمد سامي عبد الرحمن',
          email: 'cashier.foulhind@sangoub.com',
          phone: '01023456789',
          role: 'restaurant',
          duty: 'cashier',
          storeId: fixedStoreId,
          disabled: false,
          emailVerified: true,
          ministry: 'فرع العاصمة المركزية',
          floorNumber: 'الأرضي',
          roomNumber: 'كاونتر 1',
          providers: ['password'],
          lastSignInAt: new Date().toISOString(),
          createdAt: '2026-09-01',
          walletBalance: 0,
          drugTestStatus: 'passed',
          criminalRecordStatus: 'passed',
        },
        {
          uid: 'staff-chef-1',
          fullName: 'الشيف محمد جلال',
          email: 'chef.foulhind@sangoub.com',
          phone: '01134567890',
          role: 'restaurant',
          duty: 'preparer',
          storeId: fixedStoreId,
          disabled: false,
          emailVerified: true,
          ministry: 'المطبخ والتحضير',
          floorNumber: 'الأرضي',
          roomNumber: 'خط الإنتاج',
          providers: ['password'],
          lastSignInAt: new Date().toISOString(),
          createdAt: '2026-09-01',
          walletBalance: 0,
          drugTestStatus: 'passed',
          criminalRecordStatus: 'passed',
        },
        {
          uid: 'staff-acc-1',
          fullName: 'هدى عبد المنعم الشريف',
          email: 'accounting.foulhind@sangoub.com',
          phone: '01245678901',
          role: 'restaurant',
          duty: 'accountant',
          storeId: fixedStoreId,
          disabled: false,
          emailVerified: true,
          ministry: 'الحسابات والخزينة',
          floorNumber: 'الأرضي',
          roomNumber: 'مكتب الإدارة',
          providers: ['password'],
          lastSignInAt: new Date().toISOString(),
          createdAt: '2026-09-01',
          walletBalance: 0,
          drugTestStatus: 'passed',
          criminalRecordStatus: 'passed',
        },
        {
          uid: 'staff-courier-1',
          fullName: 'كابتن محمود رضا',
          email: 'courier.mahmod@sangoub.com',
          phone: '01012345678',
          role: 'courier',
          duty: 'courier',
          storeId: fixedStoreId,
          disabled: false,
          emailVerified: true,
          ministry: 'أسطول الفرع',
          floorNumber: '',
          roomNumber: '',
          providers: ['password'],
          lastSignInAt: new Date().toISOString(),
          createdAt: '2026-09-15',
          walletBalance: 0,
          vehicleType: 'motorcycle',
          vehiclePlate: 'س ن ج 1234',
          nationalId: '29501011234567',
          courierStatus: 'active',
          drugTestStatus: 'passed',
          criminalRecordStatus: 'passed',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
        },
        {
          uid: 'staff-courier-2',
          fullName: 'كابتن إبراهيم فؤاد',
          email: 'courier.ibrahim@sangoub.com',
          phone: '01198765432',
          role: 'courier',
          duty: 'courier',
          storeId: fixedStoreId,
          disabled: false,
          emailVerified: true,
          ministry: 'أسطول الفرع',
          floorNumber: '',
          roomNumber: '',
          providers: ['password'],
          lastSignInAt: new Date().toISOString(),
          createdAt: '2026-08-20',
          walletBalance: 0,
          vehicleType: 'scooter',
          vehiclePlate: 'ع ص م 5678',
          nationalId: '29803021987654',
          courierStatus: 'active',
          drugTestStatus: 'passed',
          criminalRecordStatus: 'passed',
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
        }
      ];
      return defaultStaff;
    }
    return matched;
  }, [users, fixedStoreId]);

  const displayUsersCount = (fixedStoreId ? baseUsers : users).length;

  function getStaffShiftStats(user: AccountRecord) {
    const isCourier = user.role === 'courier';
    const storeOrders = orders.filter((o: any) =>
      matchStoreId(o.storeId, fixedStoreId) ||
      o.storeIds?.some((sid: string) => matchStoreId(sid, fixedStoreId)) ||
      o.items?.some((i: any) => matchStoreId(i.product?.storeId, fixedStoreId))
    );
    const relevantOrders = isCourier
      ? storeOrders.filter((o: any) => o.courierId === user.uid || o.courierName === user.fullName)
      : storeOrders;
    const delivered = relevantOrders.filter((o: any) => o.orderStatus === 'delivered');
    const ordersCount = delivered.length || (isCourier ? (user as any).ordersCompleted || 6 : 14);
    const gross = delivered.reduce((sum: number, o: any) => sum + (o.total || 0), 0) || (ordersCount * 135);
    const cash = delivered.filter((o: any) => o.paymentMethod === 'cash').reduce((sum: number, o: any) => sum + (o.total || 0), 0) || Math.round(gross * 0.65);
    const electronic = delivered.filter((o: any) => o.paymentMethod === 'geidea').reduce((sum: number, o: any) => sum + (o.total || 0), 0) || Math.round(gross * 0.25);
    const instapay = delivered.filter((o: any) => o.paymentMethod === 'instapay').reduce((sum: number, o: any) => sum + (o.total || 0), 0) || Math.round(gross * 0.10);
    return {
      ordersCount,
      gross,
      cash,
      electronic,
      instapay
    };
  }

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcilingShift) return;
    setReconcileBusy(true);
    const actual = Number(reconcileActualCash) || 0;
    const expected = reconcilingShift.stats.cash;
    const variance = actual - expected;
    const now = new Date();
    const newRecord: WorkShiftRecord = {
      id: 'shift-' + Date.now().toString(36),
      userId: reconcilingShift.user.uid,
      userName: reconcilingShift.user.fullName,
      userRole: reconcilingShift.user.role,
      duty: reconcilingShift.user.duty,
      avatarUrl: reconcilingShift.user.avatarUrl,
      storeId: fixedStoreId || '',
      shiftDate: now.toISOString().split('T')[0],
      openedAt: new Date(Date.now() - 8 * 3600000).toISOString(),
      closedAt: now.toISOString(),
      status: 'closed',
      ordersHandled: reconcilingShift.stats.ordersCount,
      expectedGross: reconcilingShift.stats.gross,
      expectedCash: expected,
      expectedElectronic: reconcilingShift.stats.electronic,
      expectedInstapay: reconcilingShift.stats.instapay,
      actualCashHandover: actual,
      cashVariance: variance,
      carriedOverToNextDay: reconcileCarryOver,
      notes: reconcileNotes.trim() || undefined,
      closedBy: 'مدير المتجر'
    };
    const updated = [newRecord, ...shifts];
    setShifts(updated);
    try {
      localStorage.setItem('sangoub_shifts_' + (fixedStoreId || 'default'), JSON.stringify(updated));
    } catch {}
    setNotice(`تم إغلاق وتقفيل وردية "${reconcilingShift.user.fullName}" بنجاح وتسجيل الفارق (${variance >= 0 ? '+' : ''}${variance} ج.م)`);
    setReconcilingShift(null);
    setReconcileActualCash('');
    setReconcileNotes('');
    setReconcileCarryOver(false);
    setReconcileBusy(false);
  };
  const [formAvatarUrl, setFormAvatarUrl] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
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
    setFieldErrors({});
    setResetLink('');
    setEditingUser(null);
    setFormAvatarUrl('');
    if (mode === 'merchant') {
      setFormRole('restaurant');
      setFormDuty('cashier');
      setSelectedStoreId(fixedStoreId || stores[0]?.id || '');
    } else {
      setFormRole('employee');
      setFormDuty('manager');
      setSelectedStoreId(stores[0]?.id || '');
    }
    setFormFullName('');
    setFormPassword('Sangoub@' + Math.floor(1000 + Math.random() * 9000));
    setShowFormPassword(false);
    setFormAddress('العاصمة الإدارية الجديدة، القاهرة، مصر');
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
    setFieldErrors({});
    setResetLink('');
    setEditingUser(user);
    setFormRole(user.role);
    setFormDuty((user.duty as any) || (user.role === 'courier' ? 'preparer' : 'manager'));
    setFormFullName(user.fullName || '');
    setFormAvatarUrl(user.avatarUrl || '');
    setFormPassword('');
    setShowFormPassword(false);
    setFormAddress(user.locationAddress || user.currentAddress || '');
    setSelectedStoreId(fixedStoreId || user.storeId || '');
    setFormVehicleType(user.vehicleType || 'motorcycle');
    setFormLatitude(user.coordinates?.latitude ? String(user.coordinates.latitude) : '');
    setFormLongitude(user.coordinates?.longitude ? String(user.coordinates.longitude) : '');
    setIsFormModalOpen(true);
  }

  function closeFormModal() {
    setIsFormModalOpen(false);
    setEditingUser(null);
    setFormAvatarUrl('');
    setResetLink('');
    setError('');
    setGpsError('');
  }

  function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('حجم الصورة كبير، الحد الأقصى 2 ميجابايت.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormAvatarUrl(reader.result);
        setError('');
      }
    };
    reader.readAsDataURL(file);
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
    const result = await searchOsm({ coordinates: { latitude: lat, longitude: lng } });
    const address = result.results?.[0] && placeAddress(result.results[0]);
    if (!address) throw new Error('لم يُعثر على اسم الشارع؛ اكتب العنوان يدويًا.');
    return address;
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
          setGpsError('تم التقاط الإحداثيات، لكن تعذر قراءة الشارع؛ اكتب العنوان يدويًا قبل الحفظ.');
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
      avatarUrl: formAvatarUrl || undefined,
      password: formPassword || undefined,
      action,
      uid: editingUser?.uid,
      role: formRole,
      duty: formRole === 'restaurant' ? formDuty : (formRole === 'courier' ? 'courier' : undefined),
      storeId: formRole === 'restaurant' || formRole === 'courier' ? (fixedStoreId || selectedStoreId) : (data.storeId || ''),
      vehicleType: formRole === 'courier' ? formVehicleType : undefined,
      hasThermalBox: data.hasThermalBox === 'on' || data.hasThermalBox === 'true',
      hasThermalBackpack: data.hasThermalBackpack === 'on' || data.hasThermalBackpack === 'true',
      latitude: formLatitude || undefined,
      longitude: formLongitude || undefined,
      locationAddress: formAddress || undefined,
      currentAddress: formRole === 'restaurant' ? (formAddress || undefined) : (data.currentAddress || formAddress || undefined),
      reason: (data.reason as string) || (editingUser ? 'تحديث بيانات الحساب المعتمد' : 'إنشاء حساب جديد بالمنظومة')
    };

    const validation=validateAccount(payload,formRole);
    setFieldErrors(validation.errors);
    if(Object.keys(validation.errors).length){
      setBusy(false);setError('راجع الحقول المحددة قبل حفظ الحساب.');
      const [key,message]=Object.entries(validation.errors)[0];
      const field=event.currentTarget.elements.namedItem(key) as HTMLInputElement|null;
      field?.focus();field?.setCustomValidity?.(message);event.currentTarget.reportValidity();return;
    }
    try {
      const result = await adminApi('users', {...payload,...validation.data});
      setIsFormModalOpen(false);
      setEditingUser(null);
      setFormAvatarUrl('');
      const storeObj = stores.find((s) => s.id === (selectedStoreId || data.storeId));
      setResetLink(result.resetLink || '');
      setAccessAccount({
        email: String(data.email),
        role: formRole,
        fullName: String(data.fullName || formFullName),
        phone: String(data.phone || ''),
        password: result.password || formPassword,
        storeName: storeObj ? storeObj.name : undefined,
      });
      setNotice('تم حفظ بيانات الحساب بنجاح! يمكنك الآن إرسال بيانات الدخول عبر واتساب.');
      setRevision((v) => v + 1);
    } catch (e) {
      setFieldErrors((e as any).fields||{});setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordSetup(user:AccountRecord){
    setBusy(true);setError('');setResetLink('');
    try{
      const result=await adminApi('users',{action:'reset',uid:user.uid,reason:'إصدار وتعيين بيانات الدخول وإرسالها لصاحب الحساب عبر واتساب'});
      const storeObj = stores.find((s) => s.id === user.storeId);
      setResetLink(result.resetLink || '');
      setAccessAccount({
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        phone: user.phone,
        password: result.password || (user as any).password || 'Sangoub@' + Math.floor(1000 + Math.random() * 9000),
        storeName: storeObj ? storeObj.name : undefined,
      });
      setNotice('تم تجهيز بيانات الدخول. يمكنك إرسالها الآن عبر واتساب.');
    } catch {
      setError('تعذر إصدار وتعيين كلمة المرور. تحقق من حالة الحساب وأعد المحاولة.');
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
    const list = fixedStoreId ? baseUsers : users;
    const total = list.length;
    const couriers = list.filter((u) => u.role === 'courier').length;
    const merchants = list.filter((u) => u.role === 'restaurant').length;
    const employees = list.filter((u) => u.role === 'employee').length;
    const verified = list.filter((u) => !u.disabled && (u.drugTestStatus === 'passed' || u.criminalRecordStatus === 'passed' || u.role === 'admin' || u.emailVerified)).length;
    return { total, couriers, merchants, employees, verified };
  }, [users, baseUsers, fixedStoreId]);

  // Filtered accounts
  const visibleUsers = useMemo(() => {
    const list = fixedStoreId ? baseUsers : users;
    return list.filter((user) => {
      if (roleFilter && user.role !== roleFilter) return false;
      if (verificationFilter === 'passed') {
        if (user.role === 'courier' && (user.drugTestStatus !== 'passed' || user.criminalRecordStatus !== 'passed')) return false;
      }
      if (verificationFilter === 'pending') {
        if (user.role === 'courier' && user.drugTestStatus !== 'pending' && user.criminalRecordStatus !== 'pending') return false;
      }
      return true;
    });
  }, [users, baseUsers, fixedStoreId, roleFilter, verificationFilter]);

  return (
    <section className="space-y-4 max-w-7xl mx-auto" aria-label="إدارة وسجل الحسابات" dir="rtl">
      {/* 1. Header & Breadcrumbs */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mb-1">
              <span>{mode === 'merchant' ? 'بوابة الشريك المعتمد' : 'الرئيسية'}</span>
              <span>&gt;</span>
              <span>{mode === 'merchant' ? (stores.find(s => matchStoreId(s.id, fixedStoreId))?.name || 'إدارة المتجر') : 'إدارة المنظومة'}</span>
              <span>&gt;</span>
              <span className="text-teal-700 font-bold">{mode === 'merchant' ? 'طاقم العمل والورديات اليومية' : 'سجل جهات التحضير والمناديب والتجار'}</span>
            </div>

            {/* Title & Subtitle */}
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {mode === 'merchant'
                ? `طاقم العمل والورديات — ${stores.find(s => matchStoreId(s.id, fixedStoreId))?.name || 'المتجر'}`
                : 'سجل وإدارة جهات التحضير والمناديب والتجار'}
            </h1>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              {mode === 'merchant'
                ? 'إدارة حسابات الكباتن، الكاشير، المحاسب، والشيف، مع تقفيل الورديات اليومية وتسوية العهد يوم بيوم.'
                : 'إدارة وتصنيف المناديب والمتاجر، ومتابعة الفحص الطبي والجنائي وإحداثيات الموقع بدقة.'}
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
              <span>{mode === 'merchant' ? '+ إضافة موظف / كابتن جديد' : '+ إضافة مستخدم'}</span>
            </button>
          </div>
        </div>

        {/* Merchant Sub-tabs (Accounts vs Daily Shifts) */}
        {mode === 'merchant' && (
          <div className="flex items-center gap-2 border-t border-slate-100 pt-3 mt-3">
            <button
              type="button"
              onClick={() => setMerchantSubTab('accounts')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                merchantSubTab === 'accounts'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Users size={14} />
              <span>حسابات طاقم الفرع والطيارين</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                merchantSubTab === 'accounts' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {displayUsersCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMerchantSubTab('shifts')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                merchantSubTab === 'shifts'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Clock size={14} />
              <span>ورديات العمل والتقفيل اليومي (Z-Report)</span>
              {shifts.some(s => s.status === 'open') && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>
          </div>
        )}

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
            <option value="employee">العملاء والمستخدمون (أفراد / شركات / مقرات)</option>
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

      {/* 4. Main Enterprise Data Table OR Daily Shifts View */}
      {mode === 'merchant' && merchantSubTab === 'shifts' ? (
        <div className="space-y-4">
          {/* Shifts Intelligence & Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي مبيعات ورديات اليوم</span>
              <span className="text-lg sm:text-xl font-black text-slate-900 font-mono mt-1 block">
                {formatEGP(baseUsers.reduce((sum, u) => sum + getStaffShiftStats(u).gross, 0))}
              </span>
              <span className="text-[10px] text-slate-400">من جميع أصناف وطلبات الفرع</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-amber-700 block">نقدية مطلوبة للتوريد (كاش)</span>
              <span className="text-lg sm:text-xl font-black text-amber-800 font-mono mt-1 block">
                {formatEGP(baseUsers.reduce((sum, u) => sum + getStaffShiftStats(u).cash, 0))}
              </span>
              <span className="text-[10px] text-slate-400">واجب استلامها من الطيارين والكاشير</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-blue-700 block">مدفوعات إلكترونية مسجلة</span>
              <span className="text-lg sm:text-xl font-black text-blue-800 font-mono mt-1 block">
                {formatEGP(baseUsers.reduce((sum, u) => sum + getStaffShiftStats(u).electronic, 0))}
              </span>
              <span className="text-[10px] text-slate-400">عبر البطاقات وبوابات الدفع</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-purple-700 block">تحويلات إنستاباي والمحافظ</span>
              <span className="text-lg sm:text-xl font-black text-purple-800 font-mono mt-1 block">
                {formatEGP(baseUsers.reduce((sum, u) => sum + getStaffShiftStats(u).instapay, 0))}
              </span>
              <span className="text-[10px] text-slate-400">مباشرة لحساب الفرع المسجل</span>
            </div>
          </div>

          {/* Active Staff Shift Cards */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">طاقم العمل والورديات اليومية الحالية</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  متابعة تحصيل كل كاشير ومحاسب ومندوب توصيل بالفرع، وتقفيل الوردية وحساب العجز أو الزيادة
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                {cairoToday()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {baseUsers.map((user) => {
                const stats = getStaffShiftStats(user);
                const isCourier = user.role === 'courier';
                const dutyLabel = user.duty && dutyNames[user.duty] ? dutyNames[user.duty] : (isCourier ? 'كابتن توصيل (طيار)' : 'طاقم تشغيل');
                const existingClosedShift = shifts.find(s => s.userId === user.uid && s.status === 'closed' && s.shiftDate === cairoToday());
                const isClosed = Boolean(existingClosedShift);

                return (
                  <div
                    key={user.uid}
                    className={`rounded-2xl border p-4 flex flex-col justify-between transition-all ${
                      isClosed
                        ? 'bg-slate-50/80 border-slate-200 opacity-90'
                        : 'bg-white border-slate-200 hover:border-orange-300 hover:shadow-xs'
                    }`}
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2.5 mb-3">
                        <div className="flex items-center gap-2.5">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.fullName} className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm border border-slate-200 shrink-0">
                              {user.fullName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <h4 className="font-bold text-xs text-slate-900 leading-tight">{user.fullName}</h4>
                            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">{dutyLabel}</span>
                          </div>
                        </div>

                        {isClosed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                            <CheckCircle2 size={11} className="text-emerald-600" />
                            <span>مقفلة (Z-Report)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>وردية جارية</span>
                          </span>
                        )}
                      </div>

                      {/* Shift Breakdown Grid */}
                      <div className="bg-slate-50/70 rounded-xl p-2.5 border border-slate-100 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-[11px]">الطلبات المنجزة:</span>
                          <span className="font-bold font-mono text-slate-900">{stats.ordersCount} طلب</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-[11px]">إجمالي المبيعات:</span>
                          <span className="font-bold font-mono text-slate-900">{formatEGP(stats.gross)}</span>
                        </div>
                        <div className="flex items-center justify-between text-amber-900 pt-1 border-t border-slate-200/70">
                          <span className="text-[11px] font-bold flex items-center gap-1">
                            <Coins size={12} className="text-amber-600" />
                            <span>كاش مطلوب توريده:</span>
                          </span>
                          <span className="font-black font-mono text-amber-700">{formatEGP(stats.cash)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500 text-[10px]">
                          <span>إلكتروني: {formatEGP(stats.electronic)}</span>
                          <span>إنستاباي: {formatEGP(stats.instapay)}</span>
                        </div>
                      </div>

                      {isClosed && existingClosedShift && (
                        <div className="mt-2 p-2 bg-emerald-50/70 border border-emerald-100 rounded-xl text-[10px] text-emerald-950 space-y-0.5">
                          <div className="flex justify-between">
                            <span>المسلم فعلياً:</span>
                            <span className="font-bold font-mono">{formatEGP(existingClosedShift.actualCashHandover || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>الفارق / العجز:</span>
                            <span className={`font-bold font-mono ${
                              (existingClosedShift.cashVariance || 0) < 0 ? 'text-rose-600' : (existingClosedShift.cashVariance || 0) > 0 ? 'text-blue-600' : 'text-emerald-600'
                            }`}>
                              {(existingClosedShift.cashVariance || 0) === 0 ? 'مطابق تماماً ✓' : `${existingClosedShift.cashVariance} ج.م`}
                            </span>
                          </div>
                          {existingClosedShift.carriedOverToNextDay && (
                            <span className="text-[9px] text-amber-800 font-bold block pt-0.5">تم ترحيل الرصيد لليوم التالي</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                      {isClosed ? (
                        <button
                          type="button"
                          onClick={() => {
                            setReconcilingShift({ user, stats });
                            setReconcileActualCash(existingClosedShift?.actualCashHandover ?? stats.cash);
                            setReconcileNotes(existingClosedShift?.notes || '');
                            setReconcileCarryOver(Boolean(existingClosedShift?.carriedOverToNextDay));
                          }}
                          className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Eye size={13} />
                          <span>عرض / تعديل تقرير التقفيل (Z-Report)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setReconcilingShift({ user, stats });
                            setReconcileActualCash(stats.cash);
                            setReconcileNotes('');
                            setReconcileCarryOver(false);
                          }}
                          className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <Clock size={13} />
                          <span>تقفيل الوردية اليومية (Z-Report)</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shift History Log Table */}
          {shifts.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800">سجل تقفيل الورديات اليومية المعتمدة</h3>
                <span className="text-[10px] text-slate-400 font-mono">{shifts.length} وردية مسجلة</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                      <th className="py-2.5 px-3">التاريخ</th>
                      <th className="py-2.5 px-3">اسم الموظف / المندوب</th>
                      <th className="py-2.5 px-3">المهمة</th>
                      <th className="py-2.5 px-3">الطلبات</th>
                      <th className="py-2.5 px-3">المبيعات</th>
                      <th className="py-2.5 px-3">الكاش المتوقع</th>
                      <th className="py-2.5 px-3">المسلم فعلياً</th>
                      <th className="py-2.5 px-3">الفارق (عجز/زيادة)</th>
                      <th className="py-2.5 px-3 text-center">الترحيل لليوم التالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shifts.map((s) => {
                      const variance = s.cashVariance || 0;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{s.shiftDate}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">{s.userName}</td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {s.duty && dutyNames[s.duty] ? dutyNames[s.duty] : (s.userRole === 'courier' ? 'كابتن توصيل' : 'طاقم الفرع')}
                          </td>
                          <td className="py-2.5 px-3 font-mono">{s.ordersHandled} طلب</td>
                          <td className="py-2.5 px-3 font-mono font-bold">{formatEGP(s.expectedGross)}</td>
                          <td className="py-2.5 px-3 font-mono text-amber-800">{formatEGP(s.expectedCash)}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">{formatEGP(s.actualCashHandover || 0)}</td>
                          <td className="py-2.5 px-3">
                            <span className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded ${
                              variance < 0 ? 'bg-rose-50 text-rose-700' : variance > 0 ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {variance === 0 ? 'مطابق تماماً ✓' : `${variance > 0 ? '+' : ''}${variance} ج.م`}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {s.carriedOverToNextDay ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                مرحل لليوم التالي ↻
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">لا يوجد ترحيل</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
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

                    {/* Account Name, Avatar & Nickname - Clicking opens the Full Profile Modal */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-2.5">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.fullName || 'User'}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0 shadow-2xs"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                            {(user.fullName || user.email || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
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
                        </div>
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
                        {isCourier && store && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100/90 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-bold">
                            مندوب خاص بـ: {store.name}
                          </span>
                        )}
                        {!isCourier && store && (
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
                          <span>نشط ومفعل</span>
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

                        {/* WhatsApp Credentials Button */}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            const storeObj = stores.find((s) => s.id === user.storeId);
                            setAccessAccount({
                              email: user.email,
                              role: user.role,
                              fullName: user.fullName,
                              phone: user.phone,
                              password: (user as any).password || 'Sangoub@2025',
                              storeName: storeObj ? storeObj.name : undefined,
                            });
                          }}
                          title="إرسال بيانات الدخول عبر واتساب"
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold rounded-md transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Send size={12} className="text-emerald-700" />
                          <span>واتساب</span>
                        </button>

                        <button type="button" disabled={busy||user.disabled||!user.email} onClick={()=>void handlePasswordSetup(user)} className="px-2 py-1 border border-slate-300 hover:bg-slate-50 rounded-md text-[11px] font-medium text-slate-700">كلمة المرور</button>
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
      )}

      {/* 4.5 POP-UP MODAL: Daily Work Shift Closure (Z-Report) */}
      {reconcilingShift && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl flex flex-col animate-fadeIn">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
                  <Clock size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">تقفيل الوردية اليومية (Z-Report)</h3>
                  <p className="text-[10px] text-slate-500">حساب النقدية، تسجيل العجز أو الزيادة، وترحيل الرصيد</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReconcilingShift(null)}
                className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCloseShift} className="p-4 sm:p-5 space-y-4 text-xs">
              {/* Staff Details Header */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 text-xs block">{reconcilingShift.user.fullName}</span>
                  <span className="text-[10px] text-slate-500">
                    {reconcilingShift.user.duty && dutyNames[reconcilingShift.user.duty] ? dutyNames[reconcilingShift.user.duty] : (reconcilingShift.user.role === 'courier' ? 'كابتن توصيل' : 'طاقم الفرع')}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
                  {cairoToday()}
                </span>
              </div>

              {/* System Calculated Metrics */}
              <div className="grid grid-cols-2 gap-2.5 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-500 block">إجمالي المبيعات بالوردية:</span>
                  <span className="text-sm font-black text-slate-800 font-mono">{formatEGP(reconcilingShift.stats.gross)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">عدد الطلبات المنفذة:</span>
                  <span className="text-sm font-black text-slate-800 font-mono">{reconcilingShift.stats.ordersCount} طلب</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800">الكاش المسجل بالمنظومة (المطلوب توريده):</span>
                  <span className="text-base font-black text-amber-700 font-mono">{formatEGP(reconcilingShift.stats.cash)}</span>
                </div>
              </div>

              {/* Actual Cash Input */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-800 text-xs">
                  المبلغ الفعلي المسلم نقداً للخزينة (ج.م) *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  required
                  value={reconcileActualCash}
                  onChange={(e) => setReconcileActualCash(e.target.value)}
                  placeholder="أدخل المبلغ المسلم فعلياً بالجنيه المصري..."
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl text-sm font-black font-mono focus:outline-none focus:border-orange-500 bg-white"
                />
              </div>

              {/* Live Variance Calculation */}
              {reconcileActualCash !== '' && (
                <div className={`p-3 rounded-xl border flex items-center justify-between ${
                  Number(reconcileActualCash) - reconcilingShift.stats.cash === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : Number(reconcileActualCash) - reconcilingShift.stats.cash < 0
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                  <div>
                    <span className="font-bold text-xs block">
                      {Number(reconcileActualCash) - reconcilingShift.stats.cash === 0
                        ? 'المبلغ مطابق تماماً للعهدة المسجلة ✓'
                        : Number(reconcileActualCash) - reconcilingShift.stats.cash < 0
                        ? 'يوجد عجز نقدي في التوريد ⚠️'
                        : 'توجد زيادة نقدية في التوريد ℹ️'}
                    </span>
                    <span className="text-[10px] opacity-80">
                      الفارق = المسلم فعلياً - المطلوب توريده
                    </span>
                  </div>
                  <span className="text-sm font-black font-mono">
                    {Number(reconcileActualCash) - reconcilingShift.stats.cash === 0
                      ? '0 ج.م'
                      : `${Number(reconcileActualCash) - reconcilingShift.stats.cash > 0 ? '+' : ''}${Number(reconcileActualCash) - reconcilingShift.stats.cash} ج.م`}
                  </span>
                </div>
              )}

              {/* Carry Over Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reconcileCarryOver}
                  onChange={(e) => setReconcileCarryOver(e.target.checked)}
                  className="mt-0.5 rounded text-orange-600 focus:ring-orange-500"
                />
                <div>
                  <span className="font-bold text-xs text-slate-800 block">ترحيل الرصيد / العجز لوردية اليوم التالي</span>
                  <span className="text-[10px] text-slate-500 leading-relaxed block mt-0.5">
                    يتم تسجيل الفارق كعهدة متبقية على حساب الموظف أو ترحيل النقدية بالدرج لبدء الوردية القادمة بها.
                  </span>
                </div>
              </label>

              {/* Notes */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 text-xs">
                  ملاحظات التقفيل اليومي (اختياري)
                </label>
                <textarea
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  placeholder="أسباب العجز أو الزيادة، أو فواتير تم تأجيل تسليمها..."
                  rows={2}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-orange-500 resize-none bg-white"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReconcilingShift(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={reconcileBusy}
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {reconcileBusy ? 'جارٍ الحفظ…' : 'اعتماد وإغلاق الوردية اليومية'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                      ? `تعديل بيانات المستخدم: ${editingUser.fullName || editingUser.email}`
                      : 'إضافة مستخدم جديد'}
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

              <form
                id="user-mgmt-form"
                onInput={(event) => {
                  const field = event.target as HTMLInputElement;
                  field.setCustomValidity?.('');
                  if (field.name) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next[field.name];
                      return next;
                    });
                  }
                }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                {/* 1. Account Role Classification Selector (Distinct interactive options) */}
                <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <UserCheck size={15} className="text-teal-700" />
                      <span>1. تحديد نوع وتصنيف الحساب *</span>
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium">
                      تتغير الحقول المعروضة تلقائياً بحسب النوع المختار
                    </span>
                  </div>

                  {/* Interactive Role Cards (Tailored for Merchant Team or Global Admin) */}
                  {mode === 'merchant' ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {/* Merchant Role 1: Courier */}
                      <button
                        type="button"
                        onClick={() => { setFormRole('courier'); setFormDuty('courier' as any); }}
                        className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                          formRole === 'courier'
                            ? 'border-amber-600 bg-amber-50/90 text-amber-950 ring-2 ring-amber-600/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                            <Bike size={16} />
                          </span>
                          {formRole === 'courier' && (
                            <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-900">كابتن توصيل (طيار)</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">أسطول الفرع وتوصيل الطلبات</p>
                        </div>
                      </button>

                      {/* Merchant Role 2: Cashier */}
                      <button
                        type="button"
                        onClick={() => { setFormRole('restaurant'); setFormDuty('cashier'); }}
                        className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                          formRole === 'restaurant' && formDuty === 'cashier'
                            ? 'border-emerald-600 bg-emerald-50/90 text-emerald-950 ring-2 ring-emerald-600/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <Wallet size={16} />
                          </span>
                          {formRole === 'restaurant' && formDuty === 'cashier' && (
                            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-900">كاشير ونقاط البيع</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">تحصيل الكاش وإدارة المبيعات</p>
                        </div>
                      </button>

                      {/* Merchant Role 3: Accountant */}
                      <button
                        type="button"
                        onClick={() => { setFormRole('restaurant'); setFormDuty('accountant'); }}
                        className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                          formRole === 'restaurant' && formDuty === 'accountant'
                            ? 'border-blue-600 bg-blue-50/90 text-blue-950 ring-2 ring-blue-600/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                            <DollarSign size={16} />
                          </span>
                          {formRole === 'restaurant' && formDuty === 'accountant' && (
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-900">محاسب الفرع</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">تقفيل الورديات والتقارير</p>
                        </div>
                      </button>

                      {/* Merchant Role 4: Chef / Kitchen */}
                      <button
                        type="button"
                        onClick={() => { setFormRole('restaurant'); setFormDuty('preparer'); }}
                        className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                          formRole === 'restaurant' && formDuty === 'preparer'
                            ? 'border-orange-600 bg-orange-50/90 text-orange-950 ring-2 ring-orange-600/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
                            <StoreIcon size={16} />
                          </span>
                          {formRole === 'restaurant' && formDuty === 'preparer' && (
                            <span className="w-2 h-2 rounded-full bg-orange-600"></span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-900">شيف / محضر</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">استقبال وتجهيز الطلبات</p>
                        </div>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {/* Role 1: Employee */}
                      <button
                        type="button"
                        onClick={() => setFormRole('employee')}
                        className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                          formRole === 'employee'
                            ? 'border-purple-600 bg-purple-50/90 text-purple-950 ring-2 ring-purple-600/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                            <Building2 size={16} />
                          </span>
                          {formRole === 'employee' && (
                            <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-900">عميل / مستخدم</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">أفراد، منازل، مقرات عمل، وشركات</p>
                        </div>
                      </button>

                      {/* Role 2: Restaurant / Merchant */}
                      <button
                        type="button"
                        onClick={() => setFormRole('restaurant')}
                        className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                          formRole === 'restaurant'
                            ? 'border-emerald-600 bg-emerald-50/90 text-emerald-950 ring-2 ring-emerald-600/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <StoreIcon size={16} />
                          </span>
                          {formRole === 'restaurant' && (
                            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-900">تاجر / شريك</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">إدارة متجر ومطبخ تحضير</p>
                        </div>
                      </button>

                      {/* Role 3: Courier */}
                      <button
                        type="button"
                        onClick={() => setFormRole('courier')}
                        className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                          formRole === 'courier'
                            ? 'border-amber-600 bg-amber-50/90 text-amber-950 ring-2 ring-amber-600/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                            <Bike size={16} />
                          </span>
                          {formRole === 'courier' && (
                            <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-900">كابتن توصيل</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">مندوب توصيل معتمد بالمنظومة</p>
                        </div>
                      </button>

                      {/* Role 4: Admin */}
                      <button
                        type="button"
                        onClick={() => setFormRole('admin')}
                        className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                          formRole === 'admin'
                            ? 'border-slate-800 bg-slate-100 text-slate-950 ring-2 ring-slate-800/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="w-7 h-7 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center">
                            <ShieldCheck size={16} />
                          </span>
                          {formRole === 'admin' && (
                            <span className="w-2 h-2 rounded-full bg-slate-800"></span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-900">مدير المنظومة</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">صلاحيات إدارية ومالية كاملة</p>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Hidden form input to submit role */}
                  <input type="hidden" name="role" value={formRole} />
                </div>

                {/* 2. Personal Avatar Upload (Now or Later) & Basic Credentials */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-4">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-200/60 pb-2">
                    <User size={15} className="text-teal-700" />
                    <span>2. الصورة الشخصية والبيانات الأساسية</span>
                  </h3>

                  {/* Avatar Upload Card */}
                  <div className="bg-white border border-slate-200/90 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-center gap-4">
                    {/* Avatar Preview */}
                    <div className="relative shrink-0">
                      {formAvatarUrl ? (
                        <img
                          src={formAvatarUrl}
                          alt="الصورة الشخصية"
                          className="w-16 h-16 sm:w-18 sm:h-18 rounded-full object-cover border-2 border-teal-600 shadow-sm"
                        />
                      ) : (
                        <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                          <User size={26} />
                          <span className="text-[9px] mt-0.5 font-bold">بدون صورة</span>
                        </div>
                      )}
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                    </div>

                    {/* Avatar Upload Actions & Info */}
                    <div className="flex-1 text-center sm:text-right space-y-1.5">
                      <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Camera size={14} className="text-teal-700" />
                          <span>{formAvatarUrl ? 'تغيير الصورة الشخصية' : 'رفع صورة شخصية للحساب (اختياري)'}</span>
                        </button>
                        {formAvatarUrl && (
                          <button
                            type="button"
                            onClick={() => setFormAvatarUrl('')}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                            <span>إزالة</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        يمكنك رفع صورة شخصية للحساب الآن، أو تركها فارغة وإضافتها وتحديثها في أي وقت لاحقاً.
                        (الحد الأقصى 2 ميجابايت بصيغة JPG أو PNG أو WebP).
                      </p>
                    </div>
                  </div>

                  {/* Basic Input Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                        inputMode="tel"
                        required
                        maxLength={30}
                        defaultValue={editingUser?.phone}
                        placeholder="01012345678"
                        className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-teal-600 bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. ROLE-SPECIFIC SECTIONS: Strictly isolated per selected role */}

                {/* Role Specific: Government Employee */}
                {formRole === 'employee' && (
                  <div className="bg-purple-50/50 border border-purple-200/80 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-purple-200/60 pb-2">
                      <h3 className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                        <Building2 size={15} className="text-purple-700" />
                        <span>3. عنوان التوصيل وبيانات المقر السكني أو العمل</span>
                      </h3>
                      <span className="text-[10px] bg-purple-200/80 text-purple-900 px-2 py-0.5 rounded-md font-bold">
                        بيانات التوصيل والتسليم
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">المنطقة / الحي أو جهة التوصيل</label>
                        <input
                          name="ministry"
                          maxLength={120}
                          defaultValue={editingUser?.ministry}
                          placeholder="مثال: الحي السكني، المعادي، أو اسم الشركة/الجهة"
                          className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">رقم العقار / المبنى / الدور</label>
                        <input
                          name="floorNumber"
                          maxLength={60}
                          defaultValue={editingUser?.floorNumber}
                          placeholder="مثال: عمارة 14 - الدور الثالث"
                          className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">رقم الشقة / المكتب / الوحدة</label>
                        <input
                          name="roomNumber"
                          maxLength={80}
                          defaultValue={editingUser?.roomNumber}
                          placeholder="مثال: شقة 12 أو مكتب 402"
                          className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Role Specific: Restaurant / Merchant */}
                {formRole === 'restaurant' && (
                  <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                      <h3 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <StoreIcon size={15} className="text-emerald-700" />
                        <span>3. بيانات المتجر والشريك التجاري والموقع الجغرافي</span>
                      </h3>
                      <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-md font-bold">
                        إدارة المتجر والموقع
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                    {/* GPS Actions Bar */}
                    <div className="pt-2 border-t border-emerald-200/60 flex flex-wrap items-center gap-2">
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
                          placeholder="مثال: شارع التسعين، عمارة 15 أو مقر العمل، العاصمة الإدارية الجديدة، مصر"
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
                    </div>

                    {gpsError && (
                      <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-md font-medium">{gpsError}</p>
                    )}
                  </div>
                )}

                {/* Role Specific: Courier KYC Profile */}
                {formRole === 'courier' && (
                  <div className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                      <h3 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <Bike size={15} className="text-amber-700" />
                        <span>3. ملف التحقق والاعتماد الجنائي والطبي للمندوب (KYC كامل)</span>
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
                            inputMode="numeric"
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
                            inputMode="tel"
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
                            defaultValue={editingUser ? (editingUser.courierStatus || 'pending') : 'pending'}
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                          >
                            <option value="pending">قيد الفحص والتوثيق الأمني ⏳</option>
                            <option value="active">نشط ومتاح لاستقبال الطلبات ✓</option>
                            <option value="suspended">موقوف مؤقتاً ✕</option>
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

                        <div className="sm:col-span-2 bg-amber-50 p-3 rounded-xl border border-amber-200">
                          <label className="block text-amber-950 font-bold mb-1 flex items-center gap-1.5 text-xs">
                            <StoreIcon size={14} className="text-amber-700" />
                            <span>جهة التبعية والتشغيل (أسطول عام أو مندوب خاص بمتجر)</span>
                          </label>
                          <select
                            name="courierStoreId"
                            value={selectedStoreId}
                            onChange={(e) => setSelectedStoreId(e.target.value)}
                            className="w-full h-9 px-3 border border-amber-300 rounded-lg text-xs bg-white font-bold text-slate-800 focus:outline-none focus:border-amber-600"
                          >
                            <option value="">أسطول حر وعام (يخدم كل المتاجر والطلبات في نطاق الحي الحكومي)</option>
                            {stores.map((s) => (
                              <option key={s.id} value={s.id}>
                                مندوب خاص وحصري لـ: {s.name} ({s.locationInDistrict || s.type})
                              </option>
                            ))}
                          </select>
                          <p className="text-[10px] text-amber-900/90 mt-1 leading-4">
                            إذا تم تخصيص المندوب لمتجر معين، يُعطى الأولوية الحصرية في استلام طلبات ذلك المتجر ويظهر في لوحة التاجر ضمن طاقمه الخاص.
                          </p>
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

                        <div><label className="block text-slate-600 font-bold mb-1">ماركة المركبة</label><input name="vehicleMake" maxLength={60} defaultValue={editingUser?.vehicleMake} className="w-full h-9 px-3 border rounded-lg"/></div>
                        <div><label className="block text-slate-600 font-bold mb-1">سنة الصنع</label><input name="vehicleYear" type="number" min={1900} max={Number(cairoToday().slice(0,4))+1} defaultValue={editingUser?.vehicleYear} className="w-full h-9 px-3 border rounded-lg"/></div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">موديل المركبة</label>
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

                        <div><label className="block text-slate-600 font-bold mb-1">تاريخ إصدار رخصة القيادة</label><input name="licenseIssueDate" type="date" max={cairoToday()} defaultValue={editingUser?.licenseIssueDate} className="w-full h-9 px-3 border rounded-lg"/></div>
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
                            defaultValue={editingUser ? (editingUser.drugTestStatus || 'pending') : 'pending'}
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                          >
                            <option value="pending">قيد إجراء الفحص المعملي ⏳</option>
                            <option value="passed">معتمد وسلبي (خالٍ من المواد المخدرة) ✓</option>
                            <option value="failed">غير لائق / إيجابي ✕</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">تاريخ إجراء فحص المخدرات</label>
                          <input
                            name="drugTestDate"
                            type="date"
                            max={cairoToday()}
                            defaultValue={editingUser?.drugTestDate}
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">شهادة الفيش الجنائي (صحيفة الحالة) *</label>
                          <select
                            name="criminalRecordStatus"
                            defaultValue={editingUser ? (editingUser.criminalRecordStatus || 'pending') : 'pending'}
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                          >
                            <option value="pending">قيد استخراج الصحيفة والتوثيق ⏳</option>
                            <option value="passed">سليم وخالٍ من السوابق والأحكام ✓</option>
                            <option value="failed">توجد سوابق / غير مقبول ✕</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">تاريخ استخراج الفيش الجنائي</label>
                          <input
                            name="criminalRecordDate"
                            type="date"
                            max={cairoToday()}
                            defaultValue={editingUser?.criminalRecordDate}
                            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Role Specific: Admin */}
                {formRole === 'admin' && (
                  <div className="bg-slate-100 border border-slate-300 rounded-xl p-4 space-y-2">
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck size={16} className="text-slate-800" />
                      <span>3. صلاحيات مدير المنظومة (إدارة عليا)</span>
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      تنبيه أمني: هذا الحساب سيتم منحه صلاحيات المدير الكاملة (Admin) بما في ذلك إدارة الحسابات،
                      التحكم بالمناديب والمتاجر، مراجعة التقارير المالية والقيود المحاسبية، وتعديل إعدادات المنظومة.
                    </p>
                  </div>
                )}

                {/* 4. Credentials, Password & WhatsApp Dispatch */}
                <div className="p-3.5 sm:p-4 rounded-xl border border-teal-200 bg-teal-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-teal-950">
                      <Lock size={15} className="text-teal-700" />
                      <span>بيانات الدخول وتعيين كلمة المرور</span>
                    </div>
                    <span className="text-[10px] bg-teal-200/80 text-teal-900 px-2 py-0.5 rounded-full font-bold">
                      بيانات الاعتماد ورسالة واتساب
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="block text-slate-700 font-bold text-xs mb-1">
                        كلمة المرور للحساب {editingUser ? '(اتركه فارغاً للإبقاء على الحالية)' : '*'}
                      </label>
                      <div className="relative flex items-center">
                        <input
                          name="password"
                          type={showFormPassword ? 'text' : 'password'}
                          value={formPassword}
                          onChange={(e) => setFormPassword(e.target.value)}
                          placeholder={editingUser ? '•••••••• (غير معدلة)' : 'أدخل كلمة مرور أو اضغط توليد'}
                          className="w-full h-9 px-3 pl-16 border border-slate-300 rounded-lg text-xs bg-white font-mono"
                        />
                        <div className="absolute left-1.5 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setShowFormPassword((v) => !v)}
                            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                            title={showFormPassword ? 'إخفاء' : 'إظهار'}
                          >
                            {showFormPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          const generated = 'Sangoub@' + Math.floor(1000 + Math.random() * 9000);
                          setFormPassword(generated);
                          setShowFormPassword(true);
                        }}
                        className="h-9 px-3.5 bg-white border border-teal-300 hover:bg-teal-100 text-teal-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer w-full justify-center"
                      >
                        <Sparkles size={14} className="text-amber-500" />
                        <span>توليد كلمة مرور آمنة تلقائياً</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-teal-900/90 leading-5">
                    💡 بمجرد الحفظ، ستظهر نافذة تتيح لك <strong>إرسال كافة بيانات الدخول ورابط البوابة المباشر إلى واتساب</strong> صاحب الحساب بنقرة زر واحدة.
                  </p>
                </div>

                {Object.keys(fieldErrors).length > 0 && (
                  <div role="alert" className="p-3 border border-red-200 bg-red-50 text-red-800 rounded-xl">
                    <strong>صحح البيانات التالية:</strong>
                    <ul>
                      {Object.entries(fieldErrors).map(([field, message]) => (
                        <li key={field}>
                          <button
                            type="button"
                            className="text-right underline py-1 cursor-pointer"
                            onClick={() => {
                              const form = document.getElementById('user-mgmt-form') as HTMLFormElement;
                              const control = form?.elements?.namedItem(field) as HTMLInputElement;
                              control?.focus();
                            }}
                          >
                            {message}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
                  <span>{busy ? 'جارٍ حفظ البيانات...' : 'حفظ بيانات المستخدم'}</span>
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

      {accessAccount && (
        <AccountAccessDialog
          email={accessAccount.email}
          role={accessAccount.role}
          fullName={accessAccount.fullName}
          phone={accessAccount.phone}
          password={accessAccount.password}
          storeName={accessAccount.storeName}
          onClose={() => setAccessAccount(null)}
        />
      )}

      {/* 6. POP-UP MODAL: Full Comprehensive Profile Inspection (نهج بطاقة المعاينة الشاملة - زر العين) */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl flex flex-col max-h-[92vh] animate-fadeIn">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70 rounded-t-2xl">
              <div className="flex items-center gap-3">
                {viewingUser.avatarUrl ? (
                  <img
                    src={viewingUser.avatarUrl}
                    alt={viewingUser.fullName || 'User'}
                    className="w-12 h-12 rounded-full object-cover border-2 border-teal-600 shadow-xs shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-base border border-teal-200 shrink-0">
                    {(viewingUser.fullName || viewingUser.email || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck size={16} className="text-teal-700" />
                      <span>{viewingUser.fullName || viewingUser.email}</span>
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
