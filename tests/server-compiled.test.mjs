import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,symlink,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve,join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

test('compiled serverless JavaScript loads the real handlers without TypeScript loaders',async()=>{
 const root=process.cwd(),temp=await mkdtemp(join(tmpdir(),'capital-compiled-api-'));
 try{
  const config=join(temp,'tsconfig.json'),out=join(temp,'output');
  await writeFile(config,JSON.stringify({extends:join(root,'tsconfig.json'),compilerOptions:{noEmit:false,noCheck:true,rewriteRelativeImportExtensions:true,rootDir:root,outDir:out,types:['node'],typeRoots:[join(root,'node_modules/@types')]},include:[join(root,'api/**/*.ts'),join(root,'server/**/*.ts'),join(root,'server/**/*.js')],exclude:['**/*.test.ts']}));
  const compile=spawnSync(join(root,'node_modules/.bin/tsc'),['-p',config],{encoding:'utf8',timeout:60000});assert.equal(compile.status,0,compile.stdout+'\n'+compile.stderr);
  await writeFile(join(out,'package.json'),JSON.stringify({type:'module'}));await symlink(join(root,'node_modules'),join(out,'node_modules'),'dir');
  for(const name of ['admin-data','admin-users','orders','order-delivery','catalog-images']){
   // Import implementations explicitly, rather than letting the auth guard hide an import error.
   const implementation=await import(pathToFileURL(join(out,'server/handlers/'+name+'.js')).href);assert.equal(typeof implementation.default,'function');
   const endpoint=await import(pathToFileURL(join(out,'api/'+name+'.js')).href);let status;
   await endpoint.default({method:'POST',headers:{},body:{}},{setHeader(){},status(code){status=code;return this;},json(){return this;}});assert.equal(status,401,name);
  }
 }finally{await rm(temp,{recursive:true,force:true});}
});
