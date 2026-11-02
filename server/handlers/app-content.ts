import fs from 'node:fs';
import path from 'node:path';
import { GeideaGateway } from '../integrations.ts';
import { requireAdmin, adminError, AdminError, validId } from '../adminRequest.ts';
import { readHome, validateHome, validatePromotion } from '../appContent.ts';
import { mobileCors } from '../mobileCors.ts';

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
    campaigns: []
  };
}

function writeLocalAppContent(data: any) {
  try {
    fs.mkdirSync(path.dirname(contentFilePath), { recursive: true });
    fs.writeFileSync(contentFilePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing app_content.json:', err);
  }
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

      const local = readLocalAppContent();
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
        slides.push({
          id: c.id,
          title: c.title,
          subtitle: c.subtitle,
          imageUrl: c.imageUrl,
          targetType: c.targetType || 'offers',
          targetId: c.targetId || '',
        });
      }

      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=30');
      return res.status(200).json({ schemaVersion: 1, config, slides, generatedAt: new Date().toISOString() });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    await requireAdmin(req);
    const input = req.body || {};
    const local = readLocalAppContent();

    if (input.action === 'admin') {
      return res.status(200).json({
        config: readHome(local.config),
        campaigns: local.campaigns || [],
        operationsEnabled: true,
        operationsReady: true
      });
    }

    if (!['save-home', 'save-campaign', 'delete-campaign', 'save-operations'].includes(input.action)) {
      throw new AdminError(400, 'عملية غير صالحة.');
    }

    if (input.action === 'save-home') {
      local.config = validateHome(input.config);
      writeLocalAppContent(local);
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
      writeLocalAppContent(local);
      return res.status(200).json({ ok: true });
    }

    if (input.action === 'delete-campaign') {
      validId(input.id);
      local.campaigns = (local.campaigns || []).filter((c: any) => c.id !== input.id);
      writeLocalAppContent(local);
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
