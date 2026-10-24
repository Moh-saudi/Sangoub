import { AdminError } from './adminRequest.ts';
import { defaultCustomerHome, homeSectionTypes, type CustomerHome, type Promotion } from '../src/types/appContent.ts';
export function validateHome(input: any): CustomerHome {
 if (!input || Object.keys(input).some(key => !['sections', 'sliderMode', 'maxSlides'].includes(key)) || !Array.isArray(input.sections) || input.sections.length !== homeSectionTypes.length) throw new AdminError(400, 'راجع أقسام الصفحة الرئيسية.');
 if (new Set(input.sections.map((section: any) => section?.type)).size !== homeSectionTypes.length || input.sections.some((section: any) => !section || Object.keys(section).some(key => !['type', 'enabled'].includes(key)) || !homeSectionTypes.includes(section.type) || typeof section.enabled !== 'boolean')) throw new AdminError(400, 'كل قسم يظهر مرة واحدة مع تحديد التفعيل.');
 if (!['automatic', 'manual'].includes(input.sliderMode) || !Number.isInteger(input.maxSlides) || input.maxSlides < 1 || input.maxSlides > 10) throw new AdminError(400, 'راجع إعدادات السلايدر.');
 return { sections: input.sections.map((section: any) => ({ type: section.type, enabled: section.enabled })), sliderMode: input.sliderMode, maxSlides: input.maxSlides };
}
export function readHome(input: any) { try { return validateHome(input); } catch { return structuredClone(defaultCustomerHome); } }
export function validatePromotion(input: any): Omit<Promotion, 'id'> {
 if (!input || Object.keys(input).some(key => !['title', 'subtitle', 'imageUrl', 'enabled', 'priority', 'targetType', 'targetId', 'startsAt', 'endsAt'].includes(key))) throw new AdminError(400, 'حقول الحملة غير صالحة.');
 const text = (key: string, max: number, required = true) => { const value = input[key]; if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new AdminError(400, 'راجع نصوص الحملة.'); return value.trim(); };
 const title = text('title', 120), subtitle = text('subtitle', 250, false), imageUrl = text('imageUrl', 2000), targetId = text('targetId', 128, false);
 let url; try { url = new URL(imageUrl); } catch { throw new AdminError(400, 'رابط الصورة غير صالح.'); }
 if (url.protocol !== 'https:' || url.username || url.password) throw new AdminError(400, 'استخدم رابط صورة HTTPS.');
 if (typeof input.enabled !== 'boolean' || !Number.isInteger(input.priority) || input.priority < 0 || input.priority > 1000 || !['product', 'store', 'offers'].includes(input.targetType) || (input.targetType !== 'offers' && !/^[\w.-]{1,128}$/.test(targetId))) throw new AdminError(400, 'راجع هدف الحملة وترتيبها.');
 const startsAt = text('startsAt', 40), endsAt = text('endsAt', 40); const start = Date.parse(startsAt), end = Date.parse(endsAt);
 if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new AdminError(400, 'موعد انتهاء الحملة يجب أن يلي بدايتها.');
 return { title, subtitle, imageUrl, enabled: input.enabled, priority: input.priority, targetType: input.targetType, targetId: input.targetType === 'offers' ? '' : targetId, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() };
}
