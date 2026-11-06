import { supabaseAdminClient } from './supabaseAdmin.ts';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tvnsqatkaqyubeznhnmu.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_9ORqYV9HK0AbacKtYSRZiA_K7hcJ4yI';

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

function tokenIssuedAt(token: string): number {
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return Number.isFinite(claims.iat) ? claims.iat : 0;
  } catch {
    return 0;
  }
}

export interface SupabaseIdentity {
  actor: {
    uid: string;
    email: string;
    email_verified: boolean;
    phone_number: string;
    auth_time: number;
    name: string;
    role: string;
    store_id?: string;
  };
  profile: Record<string, any> | null;
  roleAssignments: Array<{ role: string; duty?: string; storeId?: string; name: string }>;
}

export async function supabaseIdentity(token: string): Promise<SupabaseIdentity | null> {
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  });
  if (authResponse.status === 401 || authResponse.status === 403) return null;
  if (!authResponse.ok) throw new Error('تعذر التحقق من حساب Supabase.');

  const user = await authResponse.json();
  if (typeof user?.id !== 'string') return null;

  const query = new URLSearchParams({ id: `eq.${user.id}`, select: '*' });
  const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!profileResponse.ok) throw new Error('تعذر قراءة ملف حساب Supabase.');
  const profiles = await profileResponse.json();
  const profile = Array.isArray(profiles) ? profiles[0] || null : null;
  const { data: assignments, error: assignmentError } = await supabaseAdminClient()
    .from('user_roles')
    .select('store_id,roles(name_en,name_ar)')
    .eq('user_id', user.id);
  if (assignmentError) throw new Error('تعذر قراءة صلاحيات حساب Supabase.');

  const roleAssignments = (assignments || []).flatMap((assignment: any) => {
    const roleRow = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;
    const name = String(roleRow?.name_en || roleRow?.name_ar || '').trim();
    const definition = roleDefinitions[name.toLowerCase()];
    return definition ? [{ ...definition, name, ...(assignment.store_id ? { storeId: assignment.store_id } : {}) }] : [];
  });
  let courierVerification: Record<string, any> = {};
  if (roleAssignments.some((assignment: any) => assignment.role === 'courier')) {
    const { data, error } = await supabaseAdminClient().from('courier_verification').select('*').eq('user_id', user.id).maybeSingle();
    if (error && error.code !== 'PGRST205') throw new Error('تعذر قراءة اعتماد المندوب من Supabase.');
    if (data) courierVerification = {
      nationalId: data.national_id,
      emergencyPhone: data.emergency_phone,
      currentAddress: data.current_address,
      idCardAddress: data.id_card_address,
      drivingLicenseNumber: data.driving_license_number,
      licenseIssueDate: data.license_issue_date,
      licenseExpiryDate: data.license_expiry_date,
      vehicleYear: data.vehicle_year,
      drugTestStatus: data.drug_test_status,
      drugTestDate: data.drug_test_date,
      criminalRecordStatus: data.criminal_record_status,
      criminalRecordDate: data.criminal_record_date,
    };
  }
  const ranked = ['admin', 'restaurant', 'courier', 'employee'];
  const role = ranked.find(candidate => roleAssignments.some((assignment: any) => assignment.role === candidate)) || 'employee';
  const activeAssignment = roleAssignments.find((assignment: any) => assignment.role === role);

  return {
    actor: {
      uid: user.id,
      email: typeof user.email === 'string' ? user.email : '',
      email_verified: Boolean(user.email_confirmed_at),
      phone_number: typeof user.phone === 'string' && user.phone_confirmed_at ? user.phone : '',
      auth_time: tokenIssuedAt(token),
      name: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '',
      role,
      ...(activeAssignment?.storeId ? { store_id: activeAssignment.storeId } : {}),
    },
    profile: profile ? { ...profile, ...courierVerification } : profile,
    roleAssignments,
  };
}
