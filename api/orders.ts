import { serverEntry } from "../server/serverEntry.js";
const authenticatedOrders = serverEntry(() => import("../server/handlers/orders.ts"));
export default async function handler(req:any,res:any) {
 // Anonymous website requests are a separate intake, never authenticated operational orders.
 if(req.method==='POST'&&req.body?.action==='sangoub-request') {
  res.setHeader('Cache-Control','no-store');
  try {return await (await import('../server/sangoubRequests.ts')).submitSangoubRequest(req,res);}
  catch {return res.status(503).json({error:'تعذر تسجيل الطلب حاليًا. حاول مجددًا.'});}
 }
 return authenticatedOrders(req,res);
}
