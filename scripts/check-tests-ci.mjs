// Preserve the real exit code. Publish static failing test titles as GitHub annotations,
// so maintainers can identify failures even when raw Actions logs require authentication.
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
const suites={'test:rules':['tests/firestore.security.test.ts','tests/order-api.integration.test.ts','tests/admin-api.integration.test.ts'],'test:web-checkout':['tests/web-checkout.integration.test.ts'],'test:commerce-integration':['tests/commerce-integration.test.ts']};
const script=process.argv[2]||'test:rules';if(!Object.hasOwn(suites,script))throw Error('Unsupported test suite');
const titles=suites[script].flatMap(file=>[...readFileSync(file,'utf8').matchAll(/test\(["']([^"'\n]+)["']/g)].map(match=>match[1]));
const child=spawn(process.platform==='win32'?'npm.cmd':'npm',['run',script],{stdio:['inherit','pipe','pipe']});
let output='';const capture=(stream,target)=>stream.on('data',chunk=>{target.write(chunk);output=(output+chunk.toString()).slice(-1024*1024);});
capture(child.stdout,process.stdout);capture(child.stderr,process.stderr);
child.on('error',()=>{console.error('::error title=Firebase validation::Unable to start the rules test command.');process.exitCode=1;});
child.on('close',(code,signal)=>{
 if(code!==0){let count=0;for(const title of titles)if(output.split('\n').some(line=>/✖|not ok/.test(line)&&line.includes(title))){console.error('::error title=Firebase test failed::'+title.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A'));count++;}
  if(!count)console.error('::error title=Firebase validation::Rules test command failed before a named assertion was captured. Inspect the emulator startup and test log.');
 }
 process.exitCode=signal?1:(code??1);
});
