import { createHash } from 'node:crypto';
import {operationIdentity} from '../operations.ts';
import { OsmError, createOsmHandler, createOsmService, osmConfig } from '../osmProxy.ts';
let service: ReturnType<typeof createOsmService>|undefined;
export default createOsmHandler({
 // Vercel supplies this header; do not trust browser-supplied IP headers elsewhere.
 guestSearchKey:req=>{const ip=(process.env.VERCEL ? req.headers?.['x-vercel-forwarded-for'] : req.socket?.remoteAddress)||'unknown';return 'guest:'+createHash('sha256').update(String(ip)).digest('hex');},
 identify:async token=>{const identity=await operationIdentity({headers:{authorization:'Bearer '+token}});if(!identity.verified)throw new OsmError(403,'أكد حسابك لاستخدام الخرائط.');return identity.actor.uid;},
 lookup:async(kind,input,uid)=>{const config=osmConfig(kind);service??=createOsmService(config);return service(kind,input,uid)},
});
