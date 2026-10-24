// Public presentation reads and authenticated administrative writes share one endpoint.
export default async function handler(req: any, res: any) {
 try { return (await import('../server/handlers/app-content.ts')).default(req, res); }
 catch { return res.status(503).json({ error: 'محتوى التطبيق غير متاح حاليًا.' }); }
}
