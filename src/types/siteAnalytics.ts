export const visitorSources = ['facebook', 'whatsapp', 'instagram', 'search', 'other', 'direct'] as const;
export type VisitorSource = typeof visitorSources[number];
export const visitorEvents = ['mascot_open', 'breakfast', 'supermarket', 'review_breakfast', 'review_supermarket', 'whatsapp_breakfast', 'whatsapp_supermarket', 'whatsapp_support'] as const;
export type VisitorEvent = typeof visitorEvents[number];
export const sourceLabels: Record<VisitorSource, string> = { facebook: 'فيسبوك', whatsapp: 'واتساب', instagram: 'إنستغرام', search: 'محركات البحث', other: 'مواقع أخرى', direct: 'مباشر / مصدر غير معروف' };
export const eventLabels: Record<VisitorEvent, string> = { mascot_open: 'فتح سنجوب', breakfast: 'اختيار الفطار', supermarket: 'اختيار السوبرماركت', review_breakfast: 'مراجعة طلب فطار', review_supermarket: 'مراجعة طلب سوبرماركت', whatsapp_breakfast: 'واتساب الفطار', whatsapp_supermarket: 'واتساب السوبرماركت', whatsapp_support: 'واتساب الدعم' };
export type VisitorDay = { day: string; visitors: number; sources: Partial<Record<VisitorSource, number>>; events: Partial<Record<VisitorEvent, number>> };
export type VisitorStatsData = { total: number; today: number; day: string; startedAt: string | null; analyticsStartedAt: string | null; days: VisitorDay[] };
