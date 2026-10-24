export default async function handler(req: any, res: any) {
 try { return (await import('../server/handlers/visitors.ts')).default(req, res); }
 catch { return res.status(503).json({ error: 'إحصائيات الزيارات غير متاحة حاليًا.' }); }
}
