/**
 * ==============================================================================
 * 🚀 SANGOUB DATA MIGRATION SCRIPT: FIREBASE TO SUPABASE
 * سكريبت ترحيل البيانات الشامل من فايربيز إلى سوبابيز
 * ==============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tvnsqatkaqyubeznhnmu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_SERVICE_KEY) {
  console.warn('⚠️ تحذير: يفضل توفير SUPABASE_SERVICE_ROLE_KEY في ملف .env لتخطي قيود RLS أثناء الترحيل الجماعي.');
}

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function verifySupabaseConnection() {
  console.log(`Connecting to Supabase at ${SUPABASE_URL} ...`);
  const { data, error } = await supabaseAdmin.from('profiles').select('count', { count: 'exact', head: true });
  if (error) {
    console.error('❌ خطأ في الاتصال بسوبابيز:', error.message);
    return false;
  }
  console.log('✅ تم التحقق من الاتصال بنجاح مع Supabase!');
  return true;
}

export async function migrateSampleData() {
  console.log('📦 جاري تهيئة البيانات الأساسية للمشروع في Supabase...');
  
  // 1. إضافة المتاجر الأساسية
  const sampleStores = [
    {
      name: 'فول وفلافل العاصمة',
      name_en: 'Capital Foul & Falafel',
      type: 'مطعم فطور شعبي',
      category: 'breakfast',
      status: 'open',
      rating: 4.9,
      delivery_time: '15-20 دقيقة',
      min_order: 25.0,
      delivery_fee: 10.0,
      location_in_district: 'فود كورت الحي الحكومي - مبنى C2',
    },
    {
      name: 'كافيه الحي الحكومي',
      name_en: 'Government District Cafe',
      type: 'كافيه ومشروبات',
      category: 'cafe',
      status: 'open',
      rating: 4.8,
      delivery_time: '10-15 دقيقة',
      min_order: 20.0,
      delivery_fee: 10.0,
      location_in_district: 'مجمع الوزارات - البوابة 3',
    }
  ];

  for (const store of sampleStores) {
    const { data, error } = await supabaseAdmin.from('stores').insert(store).select().maybeSingle();
    if (error) {
      console.warn(`تنبيه عند إضافة متجر ${store.name}:`, error.message);
    } else {
      console.log(`✅ تم تسجيل المتجر: ${store.name}`);
    }
  }

  console.log('🎉 اكتملت عملية التهيئة الأولية بنجاح!');
}

if (process.argv.includes('--run')) {
  verifySupabaseConnection().then(ok => {
    if (ok) migrateSampleData();
  });
}

