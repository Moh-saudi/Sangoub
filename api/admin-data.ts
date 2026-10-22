import { serverEntry } from "../server/serverEntry.js";
export default serverEntry(() => import("../server/handlers/admin-data.ts"));
