// Re-runs an exported file through the model and reports the result.
// Usage: node tests/check-export.js when-to-move-2026-09-23.json
const fs=require('fs');
const M=require('./load.js')();
const file=process.argv[2];
if(!file){console.log('Usage: node tests/check-export.js <exported .json file>');process.exit(1);}
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const e=M.evaluate(M.params(data.inputs));
const got=e.kind==='move'?'move at '+e.best.age:e.kind;
const was=data.result&&(data.result.kind==='move'?'move at '+data.result.bestAge:data.result.kind);
console.log('Inputs:',JSON.stringify(data.inputs));
console.log('Exported result:',was,'|',data.result&&data.result.verdict);
console.log('Model now gives:',got);
if(was&&was!==got){console.log('Different from the export: the model has changed since it was saved.');process.exit(2);}
