import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { validateAccount } from '../../src/validation/accounts.ts';
import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin, AdminError, adminError, validId } from '../adminRequest.ts';
import { auditRecord, auditSafe, auditChangedFields } from '../audit.ts';
import { mobileCors } from '../mobileCors.ts';

const roles = ['employee', 'restaurant', 'courier', 'admin'];
function text(value: any, max: number, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new AdminError(400, 'راجع البيانات المطلوبة وطول النصوص.');
  }
  return value.trim();
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tvnsqatkaqyubeznhnmu.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_9ORqYV9HK0AbacKtYSRZiA_K7hcJ4yI';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ACCOUNTS_FILE = path.resolve(process.cwd(), 'src/data/systemAccounts.json');

function loadSystemAccounts(): any[] {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const content = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Failed to read system accounts file:', err);
  }
  return [];
}

function saveSystemAccounts(accounts: any[]) {
  try {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save system accounts file:', err);
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (mobileCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let context: Awaited<ReturnType<typeof requireAdmin>> | undefined;
  let journalStarted = false;

  try {
    const { auth, db, actor } = (context = await requireAdmin(req));
    const input = req.body || {};

    if (input.action === 'list') {
      if (input.pageToken !== undefined && (typeof input.pageToken !== 'string' || input.pageToken.length > 4096)) {
        throw new AdminError(400, 'مؤشر الصفحة غير صالح.');
      }
      const search = typeof input.search === 'string' ? input.search.trim().toLowerCase() : '';
      if (search.length > 160) throw new AdminError(400, 'نص البحث طويل.');

      const systemAccounts = loadSystemAccounts();
      const accountsMap = new Map<string, any>();
      for (const acc of systemAccounts) {
        accountsMap.set(acc.uid, acc);
      }

      // Check Supabase profiles and merge
      try {
        const { data: supaProfiles } = await supabase.from('profiles').select('*');
        if (supaProfiles && supaProfiles.length) {
          for (const p of supaProfiles) {
            const mapped = {
              uid: p.id,
              email: p.email || '',
              fullName: p.full_name || '',
              avatarUrl: p.avatar_url || '',
              phone: p.phone || '',
              role: p.role || 'employee',
              storeId: p.store_id || '',
              duty: 'manager',
              disabled: false,
              emailVerified: true,
              providers: ['email'],
              createdAt: p.created_at || new Date().toISOString(),
              lastSignInAt: p.updated_at || '',
              ministry: p.ministry || '',
              floorNumber: p.floor_number || '',
              roomNumber: p.room_number || '',
              walletBalance: Number(p.wallet_balance) || 0,
              nickname: p.nickname || '',
              nationalId: p.national_id || '',
              emergencyPhone: p.emergency_phone || '',
              currentAddress: p.current_address || p.location_address || '',
              locationAddress: p.location_address || p.current_address || '',
              idCardAddress: p.id_card_address || '',
              vehicleType: p.vehicle_type || '',
              vehicleMake: p.vehicle_make || '',
              vehicleModel: p.vehicle_model || '',
              vehiclePlate: p.vehicle_plate || '',
              drivingLicenseNumber: p.driving_license_number || '',
              licenseExpiryDate: p.license_expiry_date || '',
              licenseIssueDate: p.license_issue_date || '',
              vehicleYear: p.vehicle_year || '',
              drugTestStatus: p.drug_test_status || 'passed',
              drugTestDate: p.drug_test_date || '',
              criminalRecordStatus: p.criminal_record_status || 'passed',
              criminalRecordDate: p.criminal_record_date || '',
              hasThermalBox: Boolean(p.has_thermal_box),
              hasThermalBackpack: Boolean(p.has_thermal_backpack),
              courierStatus: p.courier_status || 'active',
              coordinates: p.coordinates || null,
              coverageRadiusKm: p.coverage_radius_km || 5,
              preferredDeliveryMethod: 'auto',
            };
            accountsMap.set(p.id, { ...(accountsMap.get(p.id) || {}), ...mapped });
          }
        }
      } catch (e) {
        console.warn('Supabase profiles list error:', e);
      }

      // Ensure logged in admin is in list
      const adminEmail = actor.email || 'meskllcqa@gmail.com';
      const adminUid = actor.uid || '07492416-8a8e-434b-9094-391abb21272e';
      if (!accountsMap.has(adminUid)) {
        accountsMap.set(adminUid, {
          uid: adminUid,
          email: adminEmail,
          fullName: 'مدير المنظومة (المشرف العام)',
          avatarUrl: '',
          phone: '01222334455',
          role: 'admin',
          storeId: '',
          duty: 'manager',
          disabled: false,
          emailVerified: true,
          providers: ['google'],
          createdAt: new Date().toISOString(),
          lastSignInAt: new Date().toISOString(),
          ministry: 'الإدارة المركزية - الحي الحكومي',
          floorNumber: 'الدور الثاني',
          roomNumber: 'غرفة التحكم والعمليات المركزية',
          walletBalance: 10000,
          nickname: 'المشرف العام',
          nationalId: '28501010100001',
          emergencyPhone: '01222334455',
          currentAddress: 'مبنى القيادة والتحكم، الحي الحكومي، العاصمة الإدارية الجديدة',
          locationAddress: 'مبنى القيادة والتحكم، الحي الحكومي، العاصمة الإدارية الجديدة',
          idCardAddress: 'العاصمة الإدارية الجديدة',
          vehicleType: '',
          vehicleMake: '',
          vehicleModel: '',
          vehiclePlate: '',
          drivingLicenseNumber: '',
          licenseExpiryDate: '',
          licenseIssueDate: '',
          vehicleYear: '',
          drugTestStatus: 'passed',
          drugTestDate: '2024-01-01',
          criminalRecordStatus: 'passed',
          criminalRecordDate: '2024-01-01',
          hasThermalBox: false,
          hasThermalBackpack: false,
          courierStatus: 'active',
          coordinates: { latitude: 30.0118, longitude: 31.748 },
          coverageRadiusKm: 15,
          preferredDeliveryMethod: 'auto',
        });
      }

      let users = Array.from(accountsMap.values());
      if (search) {
        users = users.filter(
          (u: any) =>
            (u.fullName && u.fullName.toLowerCase().includes(search)) ||
            (u.email && u.email.toLowerCase().includes(search)) ||
            (u.phone && u.phone.includes(search)) ||
            (u.nationalId && u.nationalId.includes(search)) ||
            (u.nickname && u.nickname.toLowerCase().includes(search)) ||
            (u.vehiclePlate && u.vehiclePlate.includes(search))
        );
      }

      return res.status(200).json({ users, nextPageToken: null });
    }

    if (!['create', 'update', 'role', 'disable', 'enable', 'revoke', 'reset', 'delete'].includes(input.action)) {
      throw new AdminError(400, 'عملية غير معروفة.');
    }

    const defaultReason = input.action === 'create' ? 'إنشاء حساب جديد بالمنظومة' : 'تحديث بيانات الحساب';
    const reason = text(input.reason || defaultReason, 500, false);

    let uid = input.uid;
    const requestedRole = ['create', 'role', 'update'].includes(input.action) ? input.role : undefined;
    const serializesMembership =
      ['create', 'role', 'disable', 'delete'].includes(input.action) || (input.action === 'update' && requestedRole !== undefined);
    let assignmentChanged = input.action === 'create' || input.action === 'role';

    let userPassword = typeof input.password === 'string' && input.password.trim()
      ? input.password.trim()
      : 'Sangoub@' + Math.floor(1000 + Math.random() * 9000);

    if ((input.action === 'create' || input.action === 'role' || requestedRole !== undefined) && !roles.includes(requestedRole)) {
      throw new AdminError(400, 'اختر دورًا صحيحًا.');
    }

    const duty = input.duty || 'preparer';
    if (requestedRole === 'restaurant' && !['manager', 'preparer', 'cashier', 'accountant'].includes(duty)) {
      throw new AdminError(400, 'اختر مهمة فريق المتجر.');
    }
    if (requestedRole === 'restaurant') {
      validId(input.storeId);
    }
    if (requestedRole === 'courier' && input.storeId) {
      validId(input.storeId);
    }

    let fullName = '',
      email = '',
      profilePatch: any = {};

    if (input.action === 'create' || input.action === 'update') {
      fullName = text(input.fullName, 120, true);
      email = text(input.email, 160, true);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AdminError(400, 'البريد غير صالح.');

      profilePatch = {
        fullName,
        email,
        avatarUrl: typeof input.avatarUrl === 'string' ? input.avatarUrl.slice(0, 100000) : '',
        phone: text(input.phone || '', 30),
        ministry: text(input.ministry || '', 120),
        floorNumber: text(input.floorNumber || '', 60),
        roomNumber: text(input.roomNumber || '', 80),
        nickname: text(input.nickname || '', 80),
        nationalId: text(input.nationalId || '', 20),
        emergencyPhone: text(input.emergencyPhone || '', 30),
        currentAddress: text(input.currentAddress || input.locationAddress || '', 250),
        locationAddress: text(input.locationAddress || input.currentAddress || '', 250),
        idCardAddress: text(input.idCardAddress || '', 200),
        vehicleType: text(input.vehicleType || '', 40),
        vehicleMake: text(input.vehicleMake || '', 60),
        vehicleModel: text(input.vehicleModel || '', 60),
        vehiclePlate: text(input.vehiclePlate || '', 30),
        drivingLicenseNumber: text(input.drivingLicenseNumber || '', 60),
        licenseExpiryDate: text(input.licenseExpiryDate || '', 30),
        licenseIssueDate: text(input.licenseIssueDate || '', 30),
        vehicleYear: text(input.vehicleYear || '', 4),
        drugTestStatus: input.drugTestStatus ?? 'passed',
        drugTestDate: text(input.drugTestDate || '', 30),
        criminalRecordStatus: input.criminalRecordStatus ?? 'passed',
        criminalRecordDate: text(input.criminalRecordDate || '', 30),
        hasThermalBox: input.hasThermalBox === true || input.hasThermalBox === 'true' || input.hasThermalBox === 'on',
        hasThermalBackpack: input.hasThermalBackpack === true || input.hasThermalBackpack === 'true' || input.hasThermalBackpack === 'on',
        courierStatus: input.courierStatus ?? 'active',
        coverageRadiusKm: Number(input.coverageRadiusKm) || 5,
        preferredDeliveryMethod: ['bicycle', 'motorcycle', 'car', 'auto'].includes(input.preferredDeliveryMethod)
          ? input.preferredDeliveryMethod
          : 'auto',
      };

      if (input.latitude !== undefined && input.longitude !== undefined && input.latitude !== '' && input.longitude !== '') {
        const lat = Number(input.latitude);
        const lng = Number(input.longitude);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          profilePatch.coordinates = { latitude: lat, longitude: lng };
        }
      }
    }

    if (input.action === 'create') uid = 'ct_' + randomBytes(16).toString('hex');
    else validId(uid);

    if (uid === actor.uid && ['role', 'disable', 'delete', 'revoke'].includes(input.action)) {
      throw new AdminError(409, 'لا يمكنك تغيير صلاحيتك أو تعطيل حسابك من الجلسة الحالية. استخدم مديرًا آخر.');
    }
    if (input.action === 'delete' && input.confirmation !== uid) {
      throw new AdminError(400, 'أدخل UID لتأكيد حذف الحساب.');
    }

    const log = db.collection('auditLogs').doc();
    const lock = db.doc('adminUserLocks/' + uid);
    let target = input.action === 'create' ? null : await auth.getUser(uid);
    let protectAccess =
      ['create', 'role', 'disable', 'delete', 'revoke'].includes(input.action) ||
      (input.action === 'update' && email !== target?.email);
    let authBefore = target
      ? {
          uid: target.uid,
          email: target.email || '',
          displayName: target.displayName || '',
          disabled: target.disabled,
          emailVerified: target.emailVerified,
        }
      : null;

    const before = await db.runTransaction(async (tx) => {
      const [own, existingLock, profile, admin, staff, admins, control, access] = await Promise.all([
        tx.get(db.doc('admins/' + actor.uid)),
        tx.get(lock),
        tx.get(db.doc('users/' + uid)),
        tx.get(db.doc('admins/' + uid)),
        tx.get(db.doc('staff/' + uid)),
        tx.get(db.collection('admins')),
        tx.get(db.doc('adminControl/membership')),
        tx.get(db.doc('accountAccess/' + uid)),
      ]);

      if (input.action !== 'create') {
        target = await auth.getUser(uid);
        authBefore = {
          uid: target.uid,
          email: target.email || '',
          displayName: target.displayName || '',
          disabled: target.disabled,
          emailVerified: target.emailVerified,
        };
        protectAccess =
          ['role', 'disable', 'delete', 'revoke'].includes(input.action) || (input.action === 'update' && email !== target.email);
      }

      const currentRole = admin.exists ? 'admin' : staff.data()?.role || 'employee';
      if (input.action === 'update' && requestedRole !== undefined)
        assignmentChanged =
          requestedRole !== currentRole ||
          (requestedRole === 'restaurant' && (input.storeId !== staff.data()?.storeId || duty !== (staff.data()?.duty || 'manager'))) ||
          (requestedRole === 'courier' && profilePatch.courierStatus !== (staff.data()?.courierStatus || 'active'));
      if (assignmentChanged && uid === actor.uid) throw new AdminError(409, 'لا يمكنك تعديل صلاحياتك من الجلسة الحالية.');
      if (assignmentChanged) protectAccess = true;

      if (['create', 'update', 'role'].includes(input.action)) {
        const effectiveRole = requestedRole || currentRole;
        const candidate = { ...(profile.data() || {}), ...profilePatch };
        const validation = validateAccount(candidate, effectiveRole);
        if (Object.keys(validation.errors).length)
          throw Object.assign(new AdminError(400, Object.values(validation.errors)[0]), { fields: validation.errors });
        if (input.action !== 'role') for (const key of Object.keys(profilePatch)) profilePatch[key] = validation.data[key];
      }

      const previous = {
        auth: authBefore,
        profile: profile.data() || null,
        role: admin.exists ? 'admin' : staff.data()?.role || 'employee',
        staff: staff.data() || null,
        access: access.data() || null,
      };

      return previous;
    });

    journalStarted = true;

    if (input.action === 'create') {
      const newAccount = {
        uid,
        fullName,
        email,
        password: userPassword,
        phone: profilePatch.phone || '',
        role: requestedRole || 'employee',
        storeId: input.storeId || '',
        duty,
        disabled: false,
        emailVerified: true,
        providers: ['email'],
        createdAt: new Date().toISOString(),
        lastSignInAt: '',
        walletBalance: 0,
        ...profilePatch,
      };
      const accounts = loadSystemAccounts();
      const existingIdx = accounts.findIndex((a: any) => a.uid === uid || a.email === email);
      if (existingIdx >= 0) {
        accounts[existingIdx] = { ...accounts[existingIdx], ...newAccount };
      } else {
        accounts.push(newAccount);
      }
      saveSystemAccounts(accounts);
    }

    if (input.action === 'update') {
      const accounts = loadSystemAccounts();
      const existingIdx = accounts.findIndex((a: any) => a.uid === uid);
      if (existingIdx >= 0) {
        if (input.password && String(input.password).trim()) {
          userPassword = String(input.password).trim();
        } else {
          userPassword = accounts[existingIdx].password || userPassword;
        }
        accounts[existingIdx] = {
          ...accounts[existingIdx],
          ...profilePatch,
          ...(input.password && String(input.password).trim() ? { password: userPassword } : {}),
          ...(requestedRole ? { role: requestedRole } : {}),
          ...(input.storeId !== undefined ? { storeId: input.storeId } : {}),
          ...(duty ? { duty } : {}),
        };
        saveSystemAccounts(accounts);
      }
    }

    if (input.action === 'disable' || input.action === 'enable') {
      const accounts = loadSystemAccounts();
      const existingIdx = accounts.findIndex((a: any) => a.uid === uid);
      if (existingIdx >= 0) {
        accounts[existingIdx].disabled = input.action === 'disable';
        saveSystemAccounts(accounts);
      }
    }

    if (input.action === 'delete') {
      const accounts = loadSystemAccounts();
      const filtered = accounts.filter((a: any) => a.uid !== uid);
      saveSystemAccounts(filtered);
    }

    if (input.action === 'reset') {
      const accounts = loadSystemAccounts();
      const existing = accounts.find((a: any) => a.uid === uid);
      userPassword = 'Sangoub@' + Math.floor(1000 + Math.random() * 9000);
      if (existing) {
        existing.password = userPassword;
        saveSystemAccounts(accounts);
      }
    }

    return res.status(200).json({ ok: true, uid, password: userPassword });
  } catch (error) {
    return adminError(res, error);
  }
}
