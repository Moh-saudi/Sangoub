import {parse} from '@babel/parser';
import {readFileSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
const root=process.cwd();
const adapters=new Set(['server/data/firestoreQueries.ts','src/data/firestoreQueries.ts']);
const modifiers=new Set(['where','orderBy','startAt','endAt','startAfter','endBefore','limit']);
const inventory={};
function visitDirectory(directory){
 for(const entry of readdirSync(directory,{withFileTypes:true})){
  const file=join(directory,entry.name);if(entry.isDirectory()){visitDirectory(file);continue;}
  if(!/\.[cm]?[jt]sx?$/.test(entry.name)||/\.test\.[cm]?[jt]sx?$/.test(entry.name))continue;
  const name=relative(root,file).replaceAll('\\','/');if(adapters.has(name))continue;
  const text=readFileSync(file,'utf8'),source=parse(text,{sourceType:'unambiguous',plugins:['typescript','jsx']}).program;
  const sdkNames=new Set();
  for(const statement of source.body){
   if(statement.type!=='ImportDeclaration'||!statement.source.value.startsWith('firebase/firestore'))continue;
   for(const binding of statement.specifiers)if(binding.type==='ImportSpecifier'&&modifiers.has(binding.imported.name))sdkNames.add(binding.local.name);
  }
  let count=0;
  function walk(node){
   if(!node||typeof node!=='object')return;
   if(node.type==='CallExpression'||node.type==='OptionalCallExpression'){
    const callee=node.callee;
    if((callee.type==='MemberExpression'||callee.type==='OptionalMemberExpression')&&modifiers.has(callee.property.name))count++;
    else if(callee.type==='Identifier'&&sdkNames.has(callee.name))count++;
   }
   for(const value of Object.values(node))if(Array.isArray(value)){for(const child of value)walk(child);}else if(value&&typeof value==='object'&&typeof value.type==='string')walk(value);
  }
  walk(source);if(count)inventory[name]=count;
 }
}
for(const directory of ['src','server','api'])visitDirectory(join(root,directory));
const sorted=Object.fromEntries(Object.entries(inventory).sort(([a],[b])=>a.localeCompare(b)));
if(process.argv.includes('--inventory')){console.log(JSON.stringify(sorted,null,2));process.exit(0);}
const baseline=JSON.parse(readFileSync(join(root,'config/query-legacy-baseline.json'),'utf8'));
const failures=Object.entries(sorted).filter(([file,count])=>count>(baseline[file]||0));
if(failures.length){for(const [file,count] of failures)console.error(`${file}: ${count} raw query operations exceed the reviewed legacy allowance ${baseline[file]||0}; add the read contract to queryPlans and use an SDK adapter.`);process.exitCode=1;}
else console.log(`Query architecture checked: no new raw read builders; ${Object.keys(sorted).length} legacy files remain explicitly tracked.`);
