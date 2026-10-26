import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { ESLint } from 'eslint';
const eslint = new ESLint();
const original = JSON.parse(await fs.readFile('artifacts/app-redesign/lint-final.json','utf8'));
const updated = await eslint.lintFiles(['src/components/admin/AdminLayout.tsx','src/pages/Create/Create.tsx','src/pages/Map/Map.tsx','src/pages/Home/Home.tsx']);
const current = original.map(r => updated.find(n=>n.filePath===r.filePath)||r);
await fs.writeFile('artifacts/app-redesign/lint-final.json', JSON.stringify(current,null,2));
const results=[];
for(const file of current.filter(r=>r.errorCount||r.warningCount)){
 const path=file.filePath.replaceAll('\\','/').replace(process.cwd().replaceAll('\\','/')+'/','');
 const source=execFileSync('git',['show',`HEAD:${path}`],{encoding:'utf8',maxBuffer:4*1024*1024});
 const [baseline]=await eslint.lintText(source,{filePath:path});
 const count=r=>r.messages.reduce((a,m)=>(a[m.ruleId]=(a[m.ruleId]||0)+1,a),{});
 results.push({path,current:{errors:file.errorCount,warnings:file.warningCount,rules:count(file)},baseline:{errors:baseline.errorCount,warnings:baseline.warningCount,rules:count(baseline)}});
}
await fs.writeFile('artifacts/app-redesign/lint-baseline-comparison.json',JSON.stringify(results,null,2));
console.log(JSON.stringify({files:current.length,errors:current.reduce((s,r)=>s+r.errorCount,0),warnings:current.reduce((s,r)=>s+r.warningCount,0),results}));
