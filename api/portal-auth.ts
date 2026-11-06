import { serverEntry } from "../server/serverEntry.js";
export default serverEntry(() => import("../server/handlers/portal-auth.ts"), { requireAuth: false });
