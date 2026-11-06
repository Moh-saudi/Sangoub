import fs from 'node:fs';
import path from 'node:path';
import { GeideaGateway } from '../integrations.ts';
import { requireAdmin, adminError, AdminError, validId } from '../adminRequest.ts';
import { readHome, validateHome, validatePromotion } from '../appContent.ts';
import { mobileCors } from '../mobileCors.ts';
import { supabaseAdminClient } from '../supabaseAdmin.ts';

const contentFilePath = path.resolve(process.cwd(), 'data/app_content.json');

function readLocalAppContent() {
  try {
    if (fs.existsSync(contentFilePath)) {
      return JSON.parse(fs.readFileSync(contentFilePath, 'utf-8'));
    }
  } catch {}
  return {
    config: {
      sections: [
        { type: 'slider', enabled: true },
        { type: 'offers', enabled: true },
        { type: 'stores', enabled: true },
        { type: 'products', enabled: true }
      ],
      sliderMode: 'manual',
      maxSlides: 5
    },
    campaigns: [],
    gallery: []
  };
}

async function readAppContent() {
  const { data, error } = await supabaseAdminClient().from('app_content').select('content').eq('id', true).maybeSingle();
  if (error) throw new AdminError(503, 'تعذر تحميل إعدادات الموقع من Supabase.');
  return data?.content || readLocalAppContent();
}

async function saveAppContent(data: any) {
  const { error } = await supabaseAdminClient().from('app_content').upsert({ id: true, content: data, updated_at: new Date().toISOString() });
  if (error) throw new AdminError(503, 'تعذر حفظ إعدادات الموقع في Supabase.');
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') res.setHeader('Access-Control-Allow-Origin', '*');
  else if (mobileCors(req, res)) return;

  try {
    if (req.method === 'GET') {
      if (req.query?.view === 'checkout') {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ geideaAvailable: GeideaGateway.isConfigured(), currency: 'EGP' });
      }

      const local = await readAppContent();
      const config = readHome(local.config);
      const slides: any[] = [];
      const now = Date.now();

      const activeCampaigns = (local.campaigns || []).filter((c: any) => {
        if (!c.enabled) return false;
        const start = Date.parse(c.startsAt || '2000-01-01');
        const end = Date.parse(c.endsAt || '2099-01-01');
        return !isNaN(start) && !isNaN(end) ? (start <= now && now <= end) : true;
      }).sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0));

      for (const c of activeCampaigns.slice(0, config.maxSlides || 5)) {
        const isCleanGraphic = Boolean(c.hideOverlay || (!c.title && !c.subtitle));
        slides.push({
          id: c.id,
          title: c.title,
          subtitle: c.subtitle,
          imageUrl: c.imageUrl,
          targetType: c.targetType || 'offers',
          targetId: c.targetId || '',
          hideOverlay: isCleanGraphic,
          btnText: c.btnText !== undefined ? c.btnText : (isCleanGraphic ? '' : undefined)
        });
      }

      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=30');
      return res.status(200).json({
        schemaVersion: 1,
        config,
        slides,
        martBanner: local.martBanner || {
          enabled: true,
          title: 'سنجوب ماركت وكل طلبات البيت لحد بابك',
          badge: 'سنجوب بقالة ⚡',
          areaText: 'العاصمة وكافة المناطق',
          btnText: 'تسوق الآن',
          targetCategory: 'سوبرماركت',
          bgGradient: 'from-[#FF5900] via-[#FF6A1A] to-[#FF4500]'
        },
        disabledStoreTypes: local.disabledStoreTypes || ['REST', 'CAFE', 'PHARM'],
        disabledCategories: local.disabledCategories || ['CAT-PHARMACY', 'pharmacy', 'صيدلية', 'ادوية'],
        categoryOverrides: local.categoryOverrides || {},
        generatedAt: new Date().toISOString()
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    await requireAdmin(req);
    const input = req.body || {};
    const local = await readAppContent();

    if (input.action === 'admin') {
      return res.status(200).json({
        config: readHome(local.config),
        campaigns: local.campaigns || [],
        gallery: local.gallery || [],
        martBanner: local.martBanner || {
          enabled: true,
          title: 'سنجوب ماركت وكل طلبات البيت لحد بابك',
          badge: 'سنجوب بقالة ⚡',
          areaText: 'العاصمة وكافة المناطق',
          btnText: 'تسوق الآن',
          targetCategory: 'سوبرماركت',
          bgGradient: 'from-[#FF5900] via-[#FF6A1A] to-[#FF4500]'
        },
        disabledStoreTypes: local.disabledStoreTypes || ['REST', 'CAFE', 'PHARM'],
        disabledCategories: local.disabledCategories || ['CAT-PHARMACY', 'pharmacy', 'صيدلية', 'ادوية'],
        categoryOverrides: local.categoryOverrides || {},
        operationsEnabled: true,
        operationsReady: true
      });
    }

    if (!['save-home', 'save-campaign', 'delete-campaign', 'toggle-campaign', 'save-gallery', 'add-to-gallery', 'delete-from-gallery', 'save-operations', 'save-mart-banner', 'save-category-config'].includes(input.action)) {
      throw new AdminError(400, 'عملية غير صالحة.');
    }

    if (input.action === 'save-mart-banner') {
      local.martBanner = { ...(local.martBanner || {}), ...input.martBanner };
      await saveAppContent(local);
      return res.status(200).json({ ok: true, martBanner: local.martBanner });
    }

    if (input.action === 'save-category-config') {
      if (input.disabledStoreTypes) local.disabledStoreTypes = input.disabledStoreTypes;
      if (input.disabledCategories) local.disabledCategories = input.disabledCategories;
      if (input.categoryOverrides) local.categoryOverrides = input.categoryOverrides;
      await saveAppContent(local);
      return res.status(200).json({ ok: true });
    }

    if (input.action === 'save-home') {
      local.config = validateHome(input.config);
      await saveAppContent(local);
      return res.status(200).json({ ok: true });
    }

    if (input.action === 'toggle-campaign') {
      validId(input.id);
      const campaign = (local.campaigns || []).find((c: any) => c.id === input.id);
      if (campaign) {
        campaign.enabled = !campaign.enabled;
        await saveAppContent(local);
      }
      return res.status(200).json({ ok: true });
    }

    if (input.action === 'save-campaign') {
      validId(input.id);
      const campaign = validatePromotion(input.campaign);
      const existingIdx = (local.campaigns || []).findIndex((c: any) => c.id === input.id);
      if (existingIdx >= 0) {
        local.campaigns[existingIdx] = { ...campaign, id: input.id };
      } else {
        if ((local.campaigns || []).length >= 100) {
          throw new AdminError(409, 'الحد الأقصى 100 حملة؛ احذف الحملات القديمة أولًا.');
        }
        local.campaigns = local.campaigns || [];
        local.campaigns.push({ ...campaign, id: input.id });
      }

      // Also ensure the campaign image is preserved in gallery for future reuse!
      if (campaign.imageUrl) {
        local.gallery = local.gallery || [];
        if (!local.gallery.some((g: any) => g.url === campaign.imageUrl)) {
          local.gallery.unshift({
            id: `gal-${Date.now()}`,
            title: campaign.title || 'صورة حملة',
            url: campaign.imageUrl,
            addedAt: new Date().toISOString()
          });
        }
      }

      await saveAppContent(local);
      return res.status(200).json({ ok: true });
    }

    if (input.action === 'delete-campaign') {
      validId(input.id);
      local.campaigns = (local.campaigns || []).filter((c: any) => c.id !== input.id);
      await saveAppContent(local);
      return res.status(200).json({ ok: true });
    }

    if (input.action === 'add-to-gallery') {
      if (!input.item || !input.item.url) throw new AdminError(400, 'رابط الصورة مطلوب.');
      local.gallery = local.gallery || [];
      local.gallery.unshift({
        id: input.item.id || `gal-${Date.now()}`,
        title: input.item.title || 'صورة سلايدر',
        url: input.item.url,
        addedAt: new Date().toISOString()
      });
      await saveAppContent(local);
      return res.status(200).json({ ok: true });
    }

    if (input.action === 'delete-from-gallery') {
      validId(input.id);
      local.gallery = (local.gallery || []).filter((g: any) => g.id !== input.id);
      await saveAppContent(local);
      return res.status(200).json({ ok: true });
    }

    if (input.action === 'save-operations') {
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return adminError(res, error);
  }
}
