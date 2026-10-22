// Keep this bootstrap free of SDK imports so module-load failures remain
// diagnosable even when a serverless runtime cannot load a dependency.
export function serverEntry(load) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.headers?.origin;
    const native = origin === 'https://localhost' || origin === 'capacitor://localhost';
    if (native) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    }
    if (req.method === 'OPTIONS') return res.status(native ? 204 : 403).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!req.headers?.authorization?.match(/^Bearer (.+)$/)) return res.status(401).json({ error: 'يرجى تسجيل الدخول.' });
    let stage = 'module';
    try {
      const endpoint = await load();
      stage = 'handler';
      return await endpoint.default(req, res);
    } catch (error) {
      const incidentId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
      console.error('Server entry failure', { incidentId, stage, code: error?.code || error?.name || 'unknown', ...(stage === 'module' ? { message: String(error?.message || '').slice(0, 500) } : {}) });
      if (res.headersSent) return res.end();
      return res.status(503).json({ error: 'تعذر تحميل خدمة الخادم. راجع سجل وظائف الاستضافة بمعرّف الخطأ.', code: stage === 'module' ? 'SERVER_MODULE_LOAD_FAILED' : 'SERVER_HANDLER_FAILED', incidentId, ...(stage === 'module' ? { moduleErrorCode: String(error?.code || error?.name || 'unknown').slice(0, 80) } : {}) });
    }
  };
}
