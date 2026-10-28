import { adminServices } from '../firebaseAdmin.ts';
import { createOsmHandler, createOsmService, osmConfig } from '../osmProxy.ts';
let service: ReturnType<typeof createOsmService>|undefined;
export default createOsmHandler({
 identify:async token=>(await adminServices().auth.verifyIdToken(token,true)).uid,
 lookup:async(kind,input,uid)=>{service??=createOsmService(osmConfig());return service(kind,input,uid)},
});
