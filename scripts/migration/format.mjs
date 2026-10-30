import {createHash} from 'node:crypto';
export const checksum = text => createHash('sha256').update(text).digest('hex');
// Every value is tagged: a user's own '__type' field cannot collide with metadata.
export function encode(value) {
 if(value === null) return ['null'];
 if(typeof value === 'string' || typeof value === 'boolean') return [typeof value,value];
 if(typeof value === 'number') return ['number', Number.isFinite(value) ? value : String(value)];
 if(value instanceof Date) return ['date',value.toISOString()];
 if(Buffer.isBuffer(value)||value instanceof Uint8Array) return ['bytes',Buffer.from(value).toString('base64')];
 if(Array.isArray(value)) return ['array',value.map(encode)];
 if(value && typeof value.toDate === 'function' && Number.isInteger(value.seconds) && Number.isInteger(value.nanoseconds))
  return ['timestamp',value.seconds,value.nanoseconds];
 if(value && typeof value.path === 'string' && typeof value.get === 'function') return ['reference',value.path];
 if(value && typeof value.latitude === 'number' && typeof value.longitude === 'number' && value.constructor?.name === 'GeoPoint')
  return ['geopoint',value.latitude,value.longitude];
 if(value && Object.getPrototypeOf(value)===Object.prototype)
  return ['map',Object.entries(value).map(([key,item])=>[key,encode(item)])];
 throw new Error('Unsupported Firestore value; export stopped instead of dropping data');
}
export function verifyExport(contents, manifest) {
 if(manifest.version !== 1 || manifest.consistency !== 'writes-paused' || !manifest.projectId || !manifest.databaseId)
  throw new Error('Invalid export manifest or writes were not paused');
 if(checksum(contents)!==manifest.sha256) throw new Error('Export checksum mismatch');
 const lines=contents.split('\n').filter(Boolean), paths=new Set();
 for(const line of lines){
  const row=JSON.parse(line);
  if(typeof row.path!=='string'||row.path.split('/').length%2!==0||row.path.split('/').some(x=>!x)||!row.data||row.data[0]!=='map')
   throw new Error('Invalid document record');
  if(paths.has(row.path)) throw new Error('Duplicate document path');
  paths.add(row.path);
 }
 if(lines.length!==manifest.documentCount) throw new Error('Export count mismatch');
 return lines.map(line=>JSON.parse(line));
}
// UTF8 hex avoids interpolating document strings as SQL syntax (including backslashes).
export const sqlText = value => `convert_from(decode('${Buffer.from(value).toString('hex')}','hex'),'UTF8')`;
export function stagingSql(contents, manifest) {
 const rows=verifyExport(contents,manifest), runId=manifest.sha256;
 const header=`begin;\ninsert into migration_private.runs(id,source_project,source_database,exported_at,document_count,sha256) values (${sqlText(runId)},${sqlText(manifest.projectId)},${sqlText(manifest.databaseId)},${sqlText(manifest.exportedAt)}::timestamptz,${rows.length},${sqlText(manifest.sha256)}) on conflict(id) do nothing;\n`;
 return header+rows.map(row=>`insert into migration_private.documents(run_id,path,data) values (${sqlText(runId)},${sqlText(row.path)},${sqlText(JSON.stringify({encoded:row.data}))}::jsonb) on conflict(run_id,path) do nothing;`).join('\n')+
 `\ndo $$ begin if (select count(*) from migration_private.documents where run_id = '${runId}') <> ${rows.length} then raise exception 'Import count mismatch'; end if; end $$;\ncommit;\n`;
}
