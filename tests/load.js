// Loads data.js and model.js the same way the browser does (as plain scripts sharing one scope)
// and hands back the model's functions, so tests run the exact code the site runs.
const fs=require('fs'), path=require('path'), vm=require('vm');

module.exports=function load(){
  const root=path.join(__dirname,'..');
  const code=['data.js','model.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n;\n')
    +'\n;this.api={BANDS,REGION,TYPE,RENT_YIELD,DEFAULTS,params,evaluate,simulate,pmt,propTax,rateFor,growth,gbp};';
  const ctx={};vm.createContext(ctx);vm.runInContext(code,ctx);
  return ctx.api;
};
