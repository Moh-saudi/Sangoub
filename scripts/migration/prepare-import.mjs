import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {stagingSql} from './format.mjs';
const [directory,output]=process.argv.slice(2);
if(!directory||!output)throw new Error('Usage: node scripts/migration/prepare-import.mjs <export-directory> <new-output.sql>');
const contents=await readFile(resolve(directory,'documents.ndjson'),'utf8');
const manifest=JSON.parse(await readFile(resolve(directory,'manifest.json'),'utf8'));
await writeFile(output,stagingSql(contents,manifest),{mode:0o600,flag:'wx'});
console.log('Verified private staging SQL created. No database was modified.');
