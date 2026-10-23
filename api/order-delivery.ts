import { serverEntry } from "../server/serverEntry.js";
export default serverEntry(() => import("../server/handlers/order-delivery.ts"));
