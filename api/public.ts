import { serverEntry } from "../server/serverEntry.js";

const portalAuth = serverEntry(
  () => import("../server/handlers/portal-auth.ts"),
  { requireAuth: false },
);

export default async function handler(req: any, res: any) {
  const route = String(req.query?.handler || "");
  try {
    if (route === "portal-auth") return await portalAuth(req, res);
    if (route === "partner-application")
      return await (await import("../server/handlers/partner-application.ts")).default(req, res);
    if (route === "user-avatar")
      return await (await import("../server/handlers/user-avatar.ts")).default(req, res);
    return res.status(404).json({ error: "المسار غير موجود." });
  } catch {
    return res.status(503).json({ error: "الخدمة غير متاحة حاليًا." });
  }
}
