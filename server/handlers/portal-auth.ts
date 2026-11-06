import { mobileCors } from '../mobileCors.ts';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (mobileCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(410).json({
    error: 'تم إيقاف تسجيل الدخول القديم. استخدم حساب Supabase المعتمد.',
  });
}

