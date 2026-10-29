import {operationIdentity} from '../operations.ts';
import { OsmError, createOsmHandler, createOsmService, osmConfig } from '../osmProxy.ts';
let service: ReturnType<typeof createOsmService>|undefined;
export default createOsmHandler({
 identify:async token=>{const identity=await operationIdentity({headers:{authorization:'Bearer '+token}});if(!identity.verified)throw new OsmError(403,'أكد حسابك لاستخدام الخرائط.');return identity.actor.uid;},
 lookup:async(kind,input,uid)=>{service??=createOsmService(osmConfig());return service(kind,input,uid)},
});
