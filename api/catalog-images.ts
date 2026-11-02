export default async function handler(req: any, res: any) {
  try {
    return (await import('../server/handlers/catalog-images.ts')).default(req, res);
  } catch (err: any) {
    console.error("Error loading catalog-images handler:", err);
    return res.status(503).json({ error: 'خدمة الصور غير متاحة حاليًا.' });
  }
}
