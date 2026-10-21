// Capacitor serves bundled assets from these local origins. Authentication
// remains mandatory: allowing an origin never grants database privileges.
const nativeOrigins = new Set(["https://localhost", "capacitor://localhost"]);

export function mobileCors(req: any, res: any): boolean {
  const origin = req.headers.origin;
  if (typeof origin === "string" && nativeOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return true;
    }
  }
  if (req.method === "OPTIONS") {
    res.status(403).end();
    return true;
  }
  return false;
}
