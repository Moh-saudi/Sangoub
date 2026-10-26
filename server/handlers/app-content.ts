import {GeideaGateway} from '../integrations.ts';
import { FieldValue } from 'firebase-admin/firestore';
import { adminServices } from '../firebaseAdmin.ts';
import { requireAdmin, adminError, AdminError, validId } from '../adminRequest.ts';
import { auditInTransaction, auditSafe } from '../audit.ts';
import { readHome, validateHome, validatePromotion } from '../appContent.ts';
import { hasProductOffer, productDiscountPercent } from '../../src/utils/productOffers.ts';
import { rolloutReady } from '../operations.ts';
import { mobileCors } from '../mobileCors.ts';

export default async function handler(req: any, res: any) {
 res.setHeader('Cache-Control', 'no-store');
 // Public GET can be consumed by the native app; authenticated writes retain scoped CORS.
 if (req.method === 'GET') res.setHeader('Access-Control-Allow-Origin', '*');
 else if (mobileCors(req, res)) return;
 try {
  if (req.method === 'GET') {
   if(req.query?.view==='checkout') {res.setHeader('Cache-Control','no-store');return res.status(200).json({geideaAvailable:GeideaGateway.isConfigured(),currency:'EGP'});}
   const { db } = adminServices();
   const config = readHome((await db.doc('appConfig/customerHome').get()).data()?.config);
   const slides: any[] = [];
   if (config.sliderMode === 'automatic') {
    const [products, stores] = await Promise.all([db.collection('products').where('inStock', '==', true).limit(500).get(), db.collection('stores').where('status', '==', 'open').get()]);
    const open = new Set(stores.docs.map(store => store.id));
    const offers = products.docs.map(doc => ({ ...doc.data(), id: doc.id } as any)).filter(product => !product.archived && hasProductOffer(product) && open.has(product.storeId) && product.imageUrl?.startsWith('https://')).sort((a, b) => productDiscountPercent(b) - productDiscountPercent(a) || a.id.localeCompare(b.id));
    for (const product of offers.slice(0, config.maxSlides)) slides.push({ id: 'product-' + product.id, title: product.name, subtitle: `خصم ${productDiscountPercent(product)}٪`, imageUrl: product.imageUrl, targetType: 'product', targetId: product.id });
   } else {
    const campaigns = await db.collection('promotions').where('enabled', '==', true).limit(100).get(); const now = Date.now();
    const eligible = campaigns.docs.flatMap(doc => { try { const campaign = validatePromotion(Object.fromEntries(Object.entries(doc.data()).filter(([key]) => !['createdAt', 'updatedAt', 'id'].includes(key)))); return campaign.enabled && Date.parse(campaign.startsAt) <= now && now < Date.parse(campaign.endsAt) ? [{ ...campaign, id: doc.id }] : []; } catch { return []; } }).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
    for (const campaign of eligible) {
     if (slides.length >= config.maxSlides) break;
     if (campaign.targetType === 'product') {
      const product = (await db.doc('products/' + campaign.targetId).get()).data() as any;
      if (!product || product.archived || !product.inStock || !hasProductOffer(product) || typeof product.storeId !== 'string' || !product.storeId) continue;
      if ((await db.doc('stores/' + product.storeId).get()).data()?.status !== 'open') continue;
     } else if (campaign.targetType === 'store' && (await db.doc('stores/' + campaign.targetId).get()).data()?.status !== 'open') continue;
     slides.push({ id: campaign.id, title: campaign.title, subtitle: campaign.subtitle, imageUrl: campaign.imageUrl, targetType: campaign.targetType, targetId: campaign.targetId });
    }
   }
   res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=30');
   return res.status(200).json({ schemaVersion: 1, config, slides, generatedAt: new Date().toISOString() });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { db, actor } = await requireAdmin(req); const input = req.body || {};
  if (input.action === 'admin') {
   const [home, campaigns, operations] = await Promise.all([db.doc('appConfig/customerHome').get(), db.collection('promotions').limit(100).get(), db.doc('appConfig/operations').get()]);
   return res.status(200).json({ config: readHome(home.data()?.config), campaigns: campaigns.docs.map(doc => ({ ...auditSafe(doc.data()), id: doc.id })), operationsEnabled: operations.data()?.enabled === true, operationsReady: rolloutReady() });
  }
  if (!['save-home', 'save-campaign', 'delete-campaign', 'save-operations'].includes(input.action)) throw new AdminError(400, 'عملية غير صالحة.');
  const config = input.action === 'save-home' ? validateHome(input.config) : null;
  const campaign = input.action === 'save-campaign' ? validatePromotion(input.campaign) : null;
  if (['save-campaign', 'delete-campaign'].includes(input.action)) validId(input.id);
  if (input.action === 'save-operations' && (typeof input.enabled !== 'boolean' || (input.enabled && !rolloutReady()))) throw new AdminError(409, 'يلزم إكمال تحديث تطبيق التشغيل وقواعد الوصول قبل التفعيل.');
  const path = config ? 'appConfig/customerHome' : input.action === 'save-operations' ? 'appConfig/operations' : 'promotions/' + input.id;
  await db.runTransaction(async tx => {
   const ref = db.doc(path); const [own, before, access] = await Promise.all([tx.get(db.doc('admins/' + actor.uid)), tx.get(ref), tx.get(db.doc('accountAccess/'+actor.uid))]);
   const control=access.data();if(control?.disabled||control?.operationLocked||actor.auth_time<=(control?.revokedBefore||0))throw new AdminError(403,'انتهت صلاحية الجلسة.');
   if (!own.exists) throw new AdminError(403, 'انتهت صلاحية الإدارة.');
   if (campaign) {
    if (!before.exists && (await tx.get(db.collection('promotions').limit(100))).size >= 100) throw new AdminError(409, 'الحد الأقصى 100 حملة؛ احذف الحملات القديمة أولًا.');
    if (campaign.targetType !== 'offers' && !(await tx.get(db.doc((campaign.targetType === 'product' ? 'products/' : 'stores/') + campaign.targetId))).exists) throw new AdminError(400, 'هدف الحملة غير موجود.');
   }
   const after = config ? { config } : input.action === 'save-operations' ? { enabled: input.enabled } : campaign;
   if (input.action === 'delete-campaign') tx.delete(ref); else tx.set(ref, { ...after, updatedAt: FieldValue.serverTimestamp() });
   auditInTransaction(db, tx, actor, input.action, config || input.action === 'save-operations' ? 'appConfig' : 'promotions', ref.id, before.data() || null, input.action === 'delete-campaign' ? null : after);
  });
  return res.status(200).json({ ok: true });
 } catch (error) { return adminError(res, error); }
}
