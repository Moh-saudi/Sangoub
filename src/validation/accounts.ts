export type AccountErrors = Record<string, string>;
export function latinDigits(value: unknown) {
  return String(value ?? '').replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776));
}
export function egyptMobile(value: unknown) {
  let v = latinDigits(value).replace(/[\s()-]/g, '');
  if (v.startsWith('+20')) v = '0' + v.slice(3);else if (v.startsWith('0020')) v = '0' + v.slice(4);else if (v.startsWith('20')) v = '0' + v.slice(2);
  return /^01[0125]\d{8}$/.test(v) ? v : null;
}
export function cairoToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  return ['year', 'month', 'day'].map(k => parts.find(p => p.type === k)!.value).join('-');
}
export function realDate(value: unknown): string | null {
  const s = latinDigits(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (y < 1900 || y > 2199) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? s : null;
}
export function nationalIdBirth(value: unknown, today = cairoToday()): string | null {
  const id = latinDigits(value).trim();
  if (!/^[23]\d{13}$/.test(id)) return null;
  const governorates = ['01', '02', '03', '04', '11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '23', '24', '25', '26', '27', '28', '29', '31', '32', '33', '34', '35', '88'];
  const birth = realDate(`${id[0] === '2' ? '19' : '20'}${id.slice(1, 3)}-${id.slice(3, 5)}-${id.slice(5, 7)}`);
  return birth && birth <= today && governorates.includes(id.slice(7, 9)) ? birth : null;
}
export function validateAccount(input: Record<string, any>, role: string, today = cairoToday()) {
  const data = {
      ...input
    },
    errors: AccountErrors = {};
  const add = (key: string, message: string) => {
    errors[key] = message;
  };
  const txt = (key: string) => String(data[key] ?? '').trim();
  data.fullName = txt('fullName').replace(/\s+/g, ' ');
  data.email = txt('email').toLowerCase();
  if ((data.fullName.match(/\p{L}/gu) || []).length < 2 || data.fullName.length > 120 || !/^[\p{L}\p{M}\p{N}\s.'’&-]+$/u.test(data.fullName)) add('fullName', 'اكتب اسمًا حقيقيًا يحتوي حروفًا، وليس أرقامًا أو رموزًا فقط.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 160) add('email', 'اكتب بريدًا إلكترونيًا صحيحًا يستطيع صاحب الحساب الوصول إليه.');
  const mobile = egyptMobile(data.phone);
  if (!mobile) add('phone', 'أدخل رقم موبايل مصري: 11 رقمًا يبدأ بـ010 أو011 أو012 أو015، أو بصيغة +20.');else data.phone = mobile;
  if (role !== 'courier') return {
    data,
    errors
  };
  data.nationalId = latinDigits(data.nationalId).trim();
  data.drivingLicenseNumber = latinDigits(data.drivingLicenseNumber).trim();
  data.vehiclePlate = latinDigits(data.vehiclePlate).trim();
  const birth = nationalIdBirth(data.nationalId, today);
  if (!birth) add('nationalId', 'الرقم القومي يجب أن يكون 14 رقمًا ببداية وتاريخ ميلاد وكود محافظة صحيحين.');
  const emergency = egyptMobile(data.emergencyPhone);
  if (!emergency) add('emergencyPhone', 'أدخل رقم موبايل مصري صحيح لهاتف الطوارئ.');else {
    data.emergencyPhone = emergency;
    if (emergency === mobile) add('emergencyPhone', 'هاتف الطوارئ يجب أن يختلف عن رقم المندوب.');
  }
  for (const key of ['currentAddress', 'idCardAddress']) if (txt(key).length < 8 || txt(key).length > 250 || !/[\p{L}]/u.test(txt(key))) add(key, 'اكتب عنوانًا تفصيليًا يضم المنطقة والشارع والمبنى.');
  if (!['active', 'pending', 'suspended'].includes(data.courierStatus)) add('courierStatus', 'اختر حالة اعتماد صحيحة.');
  if (!['motorcycle', 'bicycle', 'car'].includes(data.vehicleType)) add('vehicleType', 'اختر وسيلة توصيل صحيحة.');
  for (const key of ['licenseIssueDate', 'licenseExpiryDate', 'drugTestDate', 'criminalRecordDate']) {
    data[key] = latinDigits(data[key]).trim();
    if (data[key] && !realDate(data[key])) add(key, 'أدخل تاريخًا حقيقيًا بصيغة يوم/شهر/سنة من منتقي التاريخ.');
  }
  if (data.licenseIssueDate > today) add('licenseIssueDate', 'تاريخ إصدار الرخصة لا يمكن أن يكون في المستقبل.');
  if (birth && data.licenseIssueDate && data.licenseIssueDate <= birth) add('licenseIssueDate', 'إصدار الرخصة يجب أن يكون بعد تاريخ الميلاد.');
  if (data.licenseIssueDate && data.licenseExpiryDate && data.licenseExpiryDate <= data.licenseIssueDate) add('licenseExpiryDate', 'انتهاء الرخصة يجب أن يكون بعد تاريخ إصدارها.');
  for (const [status, date] of [['drugTestStatus', 'drugTestDate'], ['criminalRecordStatus', 'criminalRecordDate']]) {
    if (!['passed', 'pending', 'failed'].includes(data[status])) add(status, 'اختر نتيجة فحص صحيحة.');
    if (['passed', 'failed'].includes(data[status]) && !data[date]) add(date, 'تاريخ الفحص أو استخراج الصحيفة مطلوب عند تسجيل النتيجة.');
    if (data[date] > today) add(date, 'هذا تاريخ إجراء فعلي ولا يمكن أن يكون في المستقبل.');
    if (birth && data[date] && data[date] < birth) add(date, 'تاريخ المستند لا يمكن أن يسبق تاريخ الميلاد.');
  }
  const year = latinDigits(data.vehicleYear).trim();
  data.vehicleYear = year;
  if (year && (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > Number(today.slice(0, 4)) + 1)) add('vehicleYear', 'أدخل سنة صنع حقيقية، بحد أقصى موديل السنة القادمة.');
  if (data.vehiclePlate) {
    const compact = data.vehiclePlate.replace(/[\s-]/g, '');
    const letters = (compact.match(/[A-Za-z\u0621-\u064A]/g) || []).length,
      digits = (compact.match(/\d/g) || []).length;
    if (!/^[A-Za-z\u0621-\u064A\d]+$/.test(compact) || !(letters >= 2 && letters <= 3 && digits >= 1 && digits <= 4 || letters === 0 && digits >= 3 && digits <= 6)) add('vehiclePlate', 'أدخل لوحة مصرية بصيغة حروف وأرقام صحيحة، أو لوحة رقمية قديمة.');
  }
  if (data.drivingLicenseNumber && !/^[\p{L}\d\s/-]{5,30}$/u.test(data.drivingLicenseNumber)) add('drivingLicenseNumber', 'أدخل رقم الرخصة كما في المستند، من 5 إلى30 حرفًا أو رقمًا.');
  if (data.courierStatus === 'active') {
    if (data.drugTestStatus !== 'passed') add('drugTestStatus', 'لا يمكن اعتماد مندوب نشط قبل تسجيل تحليل سلبي مع تاريخه.');
    if (data.criminalRecordStatus !== 'passed') add('criminalRecordStatus', 'لا يمكن اعتماد مندوب نشط قبل تسجيل صحيفة جنائية سليمة مع تاريخها.');
    if (['motorcycle', 'car'].includes(data.vehicleType)) {
      for (const key of ['vehicleMake', 'vehicleModel', 'vehicleYear', 'vehiclePlate', 'drivingLicenseNumber', 'licenseIssueDate', 'licenseExpiryDate']) if (!txt(key)) add(key, 'هذا الحقل مطلوب لاعتماد وسيلة توصيل بمحرك.');
      if (data.licenseExpiryDate && data.licenseExpiryDate < today) add('licenseExpiryDate', 'الرخصة منتهية؛ حدّثها أو اختر قيد الفحص/موقوف بدل نشط.');
    }
  }
  return {
    data,
    errors
  };
}
/** Legacy records without an approval marker are not silently migrated or suspended. */
export function courierApprovalError(staff: any, profile: any, today = cairoToday()): string | null {
  if (!staff?.courierStatus) return ['pending', 'suspended'].includes(profile?.courierStatus) ? 'ملف المندوب قيد الفحص أو موقوف؛ استكمل الاعتماد من الإدارة.' : null;
  if (staff.courierStatus !== 'active') return 'ملف المندوب قيد الفحص أو موقوف؛ استكمل الاعتماد من الإدارة.';
  const {
    errors
  } = validateAccount({
    ...profile,
    courierStatus: 'active'
  }, 'courier', today);
  return Object.keys(errors).length ? 'اعتماد المندوب يحتاج تحديثًا: ' + Object.values(errors)[0] : null;
}
