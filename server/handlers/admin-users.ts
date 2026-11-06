import { requireAdmin, AdminError, adminError } from '../adminRequest.ts';
import { mobileCors } from '../mobileCors.ts';
import { supabaseAdminClient } from '../supabaseAdmin.ts';
import { validateAccount } from '../../src/validation/accounts.ts';

const roleDefinitions: Record<string, { role: string; duty?: string }> = {
  'super admin': { role: 'admin' },
  'store owner': { role: 'restaurant', duty: 'manager' },
  'store manager': { role: 'restaurant', duty: 'manager' },
  'store accountant': { role: 'restaurant', duty: 'accountant' },
  'kitchen & prep staff': { role: 'restaurant', duty: 'kitchen' },
  'fleet courier': { role: 'courier' },
  'store in-house courier': { role: 'courier' },
  customer: { role: 'employee' },
};

function accountRole(value: unknown): string | undefined {
  return typeof value === 'string' && ['admin', 'restaurant', 'courier', 'employee'].includes(value)
    ? value
    : undefined;
}

function matchesRequestedRole(name: string, role: string, duty: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (role === 'admin') return normalized === 'super admin';
  if (role === 'courier') return normalized === 'fleet courier';
  if (role === 'employee') return normalized === 'customer';
  if (role !== 'restaurant') return false;
  if (duty === 'accountant') return normalized === 'store accountant';
  if (duty === 'kitchen' || duty === 'preparer') return normalized === 'kitchen & prep staff';
  return normalized === 'store owner' || normalized === 'store manager';
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (mobileCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { actor } = await requireAdmin(req);
    const input = req.body || {};
    const client = supabaseAdminClient();

    if (input.action === 'create' || input.action === 'update') {
      const isCreate = input.action === 'create';
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      const fullName = typeof input.fullName === 'string' ? input.fullName.trim().slice(0, 120) : '';
      const role = accountRole(input.role);
      const duty = typeof input.duty === 'string' ? input.duty : 'manager';
      const storeId = typeof input.storeId === 'string' ? input.storeId.trim() : '';
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new AdminError(400, 'البريد الإلكتروني غير صالح.');
      if (!fullName) throw new AdminError(400, 'اسم المستخدم مطلوب.');
      if (!role) throw new AdminError(400, 'الدور المحدد غير صالح.');
      const validation = validateAccount({ ...input, email, fullName }, role);
      if (Object.keys(validation.errors).length) {
        const first = Object.values(validation.errors)[0];
        throw Object.assign(new AdminError(400, first), { fields: validation.errors });
      }
      if (role === 'admin' && actor.uid !== input.uid && input.allowAdmin !== true) {
        throw new AdminError(403, 'لا يمكن إنشاء مدير آخر من هذا النموذج.');
      }
      if ((role === 'restaurant' || role === 'courier') && !storeId) throw new AdminError(400, 'حدد المتجر المرتبط بالحساب.');
      if (!isCreate && (typeof input.uid !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.uid) || input.uid === actor.uid && role !== 'admin')) throw new AdminError(400, 'معرّف الحساب غير صالح.');

      const { data: roleRows, error: roleError } = await client.from('roles').select('id,name_en,name_ar');
      if (roleError) throw new AdminError(503, 'تعذر قراءة أدوار Supabase.');
      const roleRow = (roleRows || []).find((row: any) => matchesRequestedRole(String(row.name_en || row.name_ar || ''), role, duty));
      if (!roleRow) throw new AdminError(400, 'الدور غير مهيأ في جدول roles على Supabase.');

      const profile: Record<string, any> = {
        full_name: fullName,
        email,
        role,
        phone: validation.data.phone,
        avatar_url: typeof input.avatarUrl === 'string' ? input.avatarUrl.slice(0, 2000) : null,
        ministry: typeof input.ministry === 'string' ? input.ministry.trim().slice(0, 120) : null,
        floor_number: typeof input.floorNumber === 'string' ? input.floorNumber.trim().slice(0, 30) : null,
        room_number: typeof input.roomNumber === 'string' ? input.roomNumber.trim().slice(0, 30) : null,
        vehicle_type: role === 'courier' && typeof input.vehicleType === 'string' ? input.vehicleType.slice(0, 40) : null,
        vehicle_make: role === 'courier' && typeof input.vehicleMake === 'string' ? input.vehicleMake.slice(0, 80) : null,
        vehicle_model: role === 'courier' && typeof input.vehicleModel === 'string' ? input.vehicleModel.slice(0, 80) : null,
        vehicle_plate: role === 'courier' && typeof input.vehiclePlate === 'string' ? input.vehiclePlate.slice(0, 40) : null,
        has_thermal_box: role === 'courier' && input.hasThermalBox === true,
        has_thermal_backpack: role === 'courier' && input.hasThermalBackpack === true,
        courier_status: role === 'courier' ? validation.data.courierStatus : null,
        updated_at: new Date().toISOString(),
      };

      let uid = input.uid as string | undefined;
      if (isCreate) {
        const { data, error } = await client.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } });
        if (error) throw error;
        if (!data.user) throw new AdminError(503, 'تعذر إنشاء حساب Supabase.');
        uid = data.user.id;
      } else {
        const { error } = await client.auth.admin.updateUserById(uid!, { email, user_metadata: { full_name: fullName } });
        if (error) throw error;
      }
      profile.id = uid;
      const { error: profileError } = await client.from('profiles').upsert(profile, { onConflict: 'id' });
      if (profileError) {
        if (isCreate && uid) await client.auth.admin.deleteUser(uid).catch(() => undefined);
        throw new AdminError(503, 'تعذر حفظ ملف الحساب في Supabase.');
      }
      if (role === 'courier') {
        const courierVerification = {
          user_id: uid,
          national_id: validation.data.nationalId,
          emergency_phone: validation.data.emergencyPhone,
          current_address: validation.data.currentAddress,
          id_card_address: validation.data.idCardAddress,
          driving_license_number: validation.data.drivingLicenseNumber || null,
          license_issue_date: validation.data.licenseIssueDate || null,
          license_expiry_date: validation.data.licenseExpiryDate || null,
          vehicle_year: validation.data.vehicleYear || null,
          drug_test_status: validation.data.drugTestStatus,
          drug_test_date: validation.data.drugTestDate || null,
          criminal_record_status: validation.data.criminalRecordStatus,
          criminal_record_date: validation.data.criminalRecordDate || null,
          updated_at: new Date().toISOString(),
        };
        const { error } = await client.from('courier_verification').upsert(courierVerification, { onConflict: 'user_id' });
        if (error) throw new AdminError(503, 'تعذر حفظ ملف التحقق الخاص بالمندوب في Supabase.');
      } else if (!isCreate) {
        const { error } = await client.from('courier_verification').delete().eq('user_id', uid!);
        if (error && error.code !== 'PGRST205') throw new AdminError(503, 'تعذر إزالة بيانات التحقق غير المستخدمة.');
      }

      const { data: oldAssignments, error: oldAssignmentError } = await client.from('user_roles').select('id,role_id').eq('user_id', uid!);
      if (oldAssignmentError) throw new AdminError(503, 'تعذر قراءة صلاحيات الحساب الحالية.');
      const sameRole = (oldAssignments || []).find((item: any) => item.role_id === roleRow.id);
      if (sameRole) {
        const { error } = await client.from('user_roles').update({ store_id: storeId || null, assigned_by: actor.uid }).eq('id', sameRole.id);
        if (error) throw new AdminError(503, 'تعذر تحديث ارتباط الدور بالمتجر.');
        const obsoleteIds = (oldAssignments || []).map((item: any) => item.id).filter((id: string) => id && id !== sameRole.id);
        if (obsoleteIds.length) {
          const { error: cleanupError } = await client.from('user_roles').delete().in('id', obsoleteIds);
          if (cleanupError) throw new AdminError(503, 'تم تحديث الدور مع تعذر حذف التعيينات القديمة؛ راجع صلاحيات الحساب.');
        }
      } else {
        const { data: inserted, error: assignmentError } = await client.from('user_roles')
          .insert({ user_id: uid, role_id: roleRow.id, store_id: storeId || null, assigned_by: actor.uid })
          .select('id').single();
        if (assignmentError) {
          if (isCreate && uid) await client.auth.admin.deleteUser(uid).catch(() => undefined);
          throw new AdminError(503, 'تعذر ربط الدور بحساب Supabase.');
        }
        const oldIds = (oldAssignments || []).map((item: any) => item.id).filter(Boolean);
        if (oldIds.length) {
          const { error } = await client.from('user_roles').delete().in('id', oldIds);
          if (error) {
            await client.from('user_roles').delete().eq('id', inserted.id);
            if (isCreate && uid) await client.auth.admin.deleteUser(uid).catch(() => undefined);
            throw new AdminError(503, 'لم تكتمل عملية استبدال صلاحيات الحساب؛ أُبقيت الصلاحيات السابقة.');
          }
        }
      }
      return res.status(200).json({ ok: true, uid });
    }

    if (['disable', 'enable'].includes(input.action)) {
      if (typeof input.uid !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.uid) || input.uid === actor.uid) throw new AdminError(400, 'لا يمكن إيقاف حساب المدير الحالي.');
      const { error } = await client.auth.admin.updateUserById(input.uid, {
        ban_duration: input.action === 'disable' ? '876000h' : 'none',
      });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (input.action === 'delete') {
      if (typeof input.uid !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.uid) || input.uid !== input.confirmation || input.uid === actor.uid) throw new AdminError(400, 'تأكيد حذف الحساب غير صالح.');
      const { count, error: ordersError } = await client.from('orders').select('id', { count: 'exact', head: true }).or(`customer_id.eq.${input.uid},courier_id.eq.${input.uid}`);
      if (ordersError) throw new AdminError(503, 'تعذر التحقق من ارتباطات الحساب.');
      if ((count || 0) > 0) throw new AdminError(409, 'لا يمكن حذف حساب مرتبط بطلبات؛ عطّله بدلًا من ذلك.');
      const { error } = await client.auth.admin.deleteUser(input.uid);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (input.action !== 'list') throw new AdminError(400, 'عملية إدارة الحساب غير معروفة.');
    if (input.pageToken !== undefined && (typeof input.pageToken !== 'string' || input.pageToken.length > 4096)) {
      throw new AdminError(400, 'مؤشر الصفحة غير صالح.');
    }
    const search = typeof input.search === 'string' ? input.search.trim().toLowerCase() : '';
    if (search.length > 160) throw new AdminError(400, 'نص البحث طويل.');

    const [authResult, profileResult, assignmentResult, verificationResult] = await Promise.all([
      client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      client.from('profiles').select('*'),
      client.from('user_roles').select('user_id,store_id,roles(name_en,name_ar)'),
      client.from('courier_verification').select('*'),
    ]);
    if (authResult.error || profileResult.error || assignmentResult.error || (verificationResult.error && verificationResult.error.code !== 'PGRST205')) {
      throw new AdminError(503, 'تعذر تحميل حسابات Supabase وصلاحياتها.');
    }

    const profiles = new Map((profileResult.data || []).map((profile: any) => [profile.id, profile]));
    const verifications = new Map((verificationResult.data || []).map((item: any) => [item.user_id, item]));
    const assignments = new Map<string, Array<{ role: string; duty?: string; storeId?: string }>>();
    for (const item of assignmentResult.data || []) {
      const relation = Array.isArray(item.roles) ? item.roles[0] : item.roles;
      const definition = roleDefinitions[String(relation?.name_en || relation?.name_ar || '').trim().toLowerCase()];
      if (!definition) continue;
      const rows = assignments.get(item.user_id) || [];
      rows.push({ ...definition, ...(item.store_id ? { storeId: item.store_id } : {}) });
      assignments.set(item.user_id, rows);
    }

    const users = authResult.data.users.map((user: any) => {
      const profile: any = profiles.get(user.id) || {};
      const verification: any = verifications.get(user.id) || {};
      const userAssignments = assignments.get(user.id) || [];
      const role = ['admin', 'restaurant', 'courier', 'employee'].find(candidate => userAssignments.some(item => item.role === candidate)) || 'employee';
      const assignment = userAssignments.find(item => item.role === role);
      const row = {
        uid: user.id,
        id: user.id,
        email: user.email || '',
        fullName: profile.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '',
        avatarUrl: profile.avatar_url || user.user_metadata?.avatar_url || '',
        phone: profile.phone || user.phone || '',
        role,
        storeId: assignment?.storeId || '',
        duty: assignment?.duty || '',
        disabled: Boolean(user.banned_until && new Date(user.banned_until).getTime() > Date.now()),
        emailVerified: Boolean(user.email_confirmed_at || user.phone_confirmed_at),
        providers: Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : [],
        createdAt: user.created_at || '',
        lastSignInAt: user.last_sign_in_at || '',
        ministry: profile.ministry || '',
        floorNumber: profile.floor_number || '',
        roomNumber: profile.room_number || '',
        walletBalance: Number(profile.wallet_balance) || 0,
        vehicleType: profile.vehicle_type || '',
        vehicleMake: profile.vehicle_make || '',
        vehicleModel: profile.vehicle_model || '',
        vehiclePlate: profile.vehicle_plate || '',
        hasThermalBox: Boolean(profile.has_thermal_box),
        hasThermalBackpack: Boolean(profile.has_thermal_backpack),
        courierStatus: profile.courier_status || '',
        nationalId: verification.national_id || '',
        emergencyPhone: verification.emergency_phone || '',
        currentAddress: verification.current_address || '',
        idCardAddress: verification.id_card_address || '',
        drivingLicenseNumber: verification.driving_license_number || '',
        licenseExpiryDate: verification.license_expiry_date || '',
        licenseIssueDate: verification.license_issue_date || '',
        vehicleYear: verification.vehicle_year || '',
        drugTestStatus: verification.drug_test_status || 'pending',
        drugTestDate: verification.drug_test_date || '',
        criminalRecordStatus: verification.criminal_record_status || 'pending',
        criminalRecordDate: verification.criminal_record_date || '',
      };
      return row;
    }).filter((user: any) => !search || [user.fullName, user.email, user.phone, user.vehiclePlate].some(value => String(value || '').toLowerCase().includes(search)));

    if (!users.some((user: any) => user.uid === actor.uid)) {
      users.unshift({ uid: actor.uid, id: actor.uid, email: actor.email, fullName: actor.name, avatarUrl: '', phone: actor.phone_number, role: 'admin', storeId: '', duty: '', disabled: false, emailVerified: actor.email_verified, providers: [], createdAt: '', lastSignInAt: '', ministry: '', floorNumber: '', roomNumber: '', walletBalance: 0, vehicleType: '', vehicleMake: '', vehicleModel: '', vehiclePlate: '', hasThermalBox: false, hasThermalBackpack: false, courierStatus: '', nationalId: '', emergencyPhone: '', currentAddress: '', idCardAddress: '', drivingLicenseNumber: '', licenseExpiryDate: '', licenseIssueDate: '', vehicleYear: '', drugTestStatus: 'pending', drugTestDate: '', criminalRecordStatus: 'pending', criminalRecordDate: '' });
    }

    return res.status(200).json({ users, nextPageToken: null });
  } catch (error) {
    return adminError(res, error);
  }
}

