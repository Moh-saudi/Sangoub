import {mkdir,open,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {initializeApp,applicationDefault,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {createHash} from 'node:crypto';
import {encode} from './format.mjs';
import {walkFirestore} from './walk-firestore.mjs';
const destination=process.argv[2], projectId=process.env.FIREBASE_PROJECT_ID, databaseId=process.env.FIREBASE_DATABASE_ID||'(default)';
if(!destination||!projectId||process.env.MIGRATION_WRITES_PAUSED!=='true')
 throw new Error('Set FIREBASE_PROJECT_ID and MIGRATION_WRITES_PAUSED=true after pausing writes; pass a NEW private output directory');
// Deliberately no dotenv auto-load: never silently export the local demo project.
const credential=process.env.FIREBASE_CLIENT_EMAIL&&process.env.FIREBASE_PRIVATE_KEY
 ?cert({projectId,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n')})
 :applicationDefault();
const app=initializeApp({projectId,credential}), db=getFirestore(app,databaseId);
const target=resolve(destination);await mkdir(target,{mode:0o700});
const output=await open(resolve(target,'documents.ndjson'),'wx',0o600), hash=createHash('sha256');
let count=0;const collections={};
try{
 await walkFirestore(db,async snapshot=>{
  const line=JSON.stringify({path:snapshot.ref.path,data:encode(snapshot.data())})+'\n';
  await output.write(line);hash.update(line);count++;
  const collectionPath=snapshot.ref.path.split('/').slice(0,-1).join('/');
  collections[collectionPath]=(collections[collectionPath]||0)+1;
 });
 await output.close();
 await writeFile(resolve(target,'manifest.json'),JSON.stringify({version:1,projectId,databaseId,consistency:'writes-paused',
  exportedAt:new Date().toISOString(),documentCount:count,collections,sha256:hash.digest('hex')},null,2),{mode:0o600,flag:'wx'});
 console.log(`Export complete: ${count} documents. Private files must not be committed.`);
}finally{await output.close().catch(()=>{});await db.terminate();}
