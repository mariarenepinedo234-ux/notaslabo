import fs from 'node:fs';
const path='test-results/results.json';
if(fs.existsSync(path)){
 const report=JSON.parse(fs.readFileSync(path,'utf8'));
 const escape=text=>text.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
 function visit(suite){for(const spec of suite.specs||[])for(const test of spec.tests||[])for(const result of test.results||[])for(const error of result.errors||[]){const text=(error.message||error.value||'').replace(/\x1b\[[0-9;]*m/g,'');console.log(`::error title=Prueba de navegador::${escape(spec.title+'\n'+text.slice(-3000))}`);}for(const child of suite.suites||[])visit(child);}
 for(const suite of report.suites||[])visit(suite);
}
