// Runs the scenario library and sense checks. Usage: node tests/run.js  (add --verbose for every scenario's figures)
const M=require('./load.js')();
const scenarios=require('./scenarios.js');
const verbose=process.argv.includes('--verbose');
let passed=0,failed=0;
const fails=[];
function check(group,name,problem){
  if(problem){failed++;fails.push(group+' › '+name+': '+problem);console.log('  ✗ '+name+'\n      '+problem);}
  else{passed++;if(verbose)console.log('  ✓ '+name);}
}
const near=(a,b,tol=0.01)=>Math.abs(a-b)<=tol;
const k=v=>v==null?'–':(v<0?'−':'')+'£'+Math.round(Math.abs(v)/1000).toLocaleString('en-GB')+'k';

// 1. Formulas, checked against figures worked out by hand.
console.log('\nFormulas');
const unit=[
  ['Repayment on £200k at 5% over 25 years is £1,169.18',()=>near(M.pmt(200000,0.05,300),1169.18,0.01)],
  ['Repayment at 0% is balance ÷ months',()=>near(M.pmt(120000,0,120),1000)],
  ['Stamp duty, England: £125k is £0',()=>M.propTax(125000,'North West',false)===0],
  ['Stamp duty, England: £300k is £5,000',()=>near(M.propTax(300000,'North West',false),5000)],
  ['Stamp duty, England: £925k is £36,250',()=>near(M.propTax(925000,'London',false),36250)],
  ['Stamp duty, England: £1.5m is £93,750',()=>near(M.propTax(1500000,'London',false),93750)],
  ['Stamp duty, first-time buyer: £300k is £0',()=>M.propTax(300000,'North West',true)===0],
  ['Stamp duty, first-time buyer: £500k is £10,000',()=>near(M.propTax(500000,'North West',true),10000)],
  ['Stamp duty, first-time buyer: £510k loses relief (£15,500)',()=>near(M.propTax(510000,'North West',true),15500)],
  ['Northern Ireland uses stamp duty',()=>near(M.propTax(300000,'Northern Ireland',false),5000)],
  ['LBTT, Scotland: £250k is £2,100',()=>near(M.propTax(250000,'Scotland',false),2100)],
  ['LBTT, Scotland: £325k is £5,850',()=>near(M.propTax(325000,'Scotland',false),5850)],
  ['LBTT, Scotland, first-time buyer: £250k is £1,500',()=>near(M.propTax(250000,'Scotland',true),1500)],
  ['LTT, Wales: £300k is £4,500',()=>near(M.propTax(300000,'Wales',false),4500)],
  ['LTT, Wales: £400k is £10,500',()=>near(M.propTax(400000,'Wales',false),10500)],
  ['Rate band: 75% LTV gets the 75% rate',()=>near(M.rateFor(M.params({}),75),0.049,1e-9)],
  ['Rate band: 75.01% LTV gets the 80% rate',()=>near(M.rateFor(M.params({}),75.01),0.051,1e-9)],
  ['Rate band: over 95% has no rate',()=>M.rateFor(M.params({}),95.1)===null],
  ['Growth: North West semi, long-run, is 4.6%',()=>near(M.growth('North West','Semi-detached',0),0.046,1e-9)],
  ['Owner\'s rental value: £250k home rents for £937.50/mo',()=>near(M.params({}).baseRent,937.5)],
];
unit.forEach(([n,f])=>check('Formulas',n,f()?null:'did not match the hand-worked figure'));

// 2. A closed-form world: no growth, interest, inflation or pay rises, so every pound can be counted by hand.
console.log('\nHand-counted worlds');
function flat(inputs){const p=M.params(Object.assign({s:0,wage:0,infl:0,prefer:0},inputs));p.gCur=0;p.gNew=0;
  p.bands=p.bands.map(([b])=>[b,0]);return p;}
{ // Owner, no mortgage, never moves: home value + saving each month until 100.
  const p=flat({age:40,owed:0,curYears:0,save:1000,savings:5000});const r=M.simulate(p,null);
  check('Hand-counted','Mortgage-free owner saving £1,000/mo from 40 to 100',near(r.fin,250000+5000+1000*12*60)?null:'got '+Math.round(r.fin));
}
{ // Owner with £120k at 0% over 10 years (£1,000/mo), saving £500/mo. After it's paid off the whole pot is saved.
  // One remortgage fee is paid at year 5 (the deal taken at month 0 is free, and it's cleared at year 10).
  const p=flat({age:40,owed:120000,curYears:10,save:500,savings:0,fixYears:5,fee:1000});const r=M.simulate(p,null);
  const T=60*12,expect=250000+500*T+1000*(T-120)-1000;
  check('Hand-counted','£120k mortgage at 0% cleared in 10 years, one deal fee',near(r.fin,expect)?null:'expected '+expect+', got '+Math.round(r.fin));
}
{ // Moving now in that flat world costs exactly: selling costs + stamp duty + fee + other costs, and nothing else.
  const p=flat({age:40,owed:0,curYears:0,save:1000,savings:200000,target:300000,sell:1.5,fee:1000,other:3000});
  const stay=M.simulate(p,null).fin, move=M.simulate(p,0).fin, cost=250000*0.015+M.propTax(300000,'North West',false)+1000+3000;
  check('Hand-counted','Moving in a flat world costs exactly the fees and taxes',near(stay-move,cost)?null:'expected '+cost+', got '+Math.round(stay-move));
}

// 3. Scenarios, plus rules every result must obey.
console.log('\nScenarios');
const report=[];
for(const s of scenarios){
  const p=M.params(s.inputs), e=M.evaluate(p), x=s.expect||{}, probs=[];
  if(x.kind&&e.kind!==x.kind)probs.push('expected '+x.kind+', got '+e.kind+(e.problem?' ('+e.problem+')':''));
  if(e.kind!=='invalid'){
    if(x.bestAge!=null&&(!e.best||e.best.age!==x.bestAge))probs.push('expected best age '+x.bestAge+', got '+(e.best&&e.best.age));
    if(x.bestAgeIn&&(!e.best||e.best.age<x.bestAgeIn[0]||e.best.age>x.bestAgeIn[1]))probs.push('expected best age '+x.bestAgeIn.join('–')+', got '+(e.best&&e.best.age));
    if(x.minOk!=null&&e.ok.length<x.minOk)probs.push('expected at least '+x.minOk+' possible years, got '+e.ok.length);
    const reasons=e.rows.filter(r=>!r.res.ok).map(r=>r.res.reason);
    (x.reasons||[]).forEach(re=>{if(!reasons.some(t=>re.test(t)))probs.push('expected a year failing with '+re);});
    (x.noReasons||[]).forEach(re=>{const t=reasons.find(t=>re.test(t));if(t)probs.push('unexpected failure: '+t);});
    // Rules for every result.
    const nums=[e.never.tot,e.never.fin].concat(e.rows.flatMap(r=>[r.res.tot,r.res.fin,r.res.info&&r.res.info.price,r.res.info&&r.res.info.dep].filter(v=>v!==undefined)));
    if(nums.some(v=>!Number.isFinite(v)))probs.push('a figure is not a number');
    if(!near(e.never.tot,e.never.fin))probs.push('never moving should carry no extra value');
    e.ok.forEach(r=>{const i=r.res.info;
      if(i.dep<=0)probs.push(r.age+': possible move with no deposit');
      if(i.loan>0&&i.ltv>95+1e-9)probs.push(r.age+': LTV over 95%');
      if(i.loan>i.maxLoan+0.01)probs.push(r.age+': loan over lending limit');
      if(i.loan>0&&!(i.pay>0))probs.push(r.age+': loan with no payment');
      if(i.loan>0&&Math.round((p.maxAge-i.age)*12)<60)probs.push(r.age+': mortgage past the age limit');});
    const bestTot=Math.max(...e.ok.map(r=>r.res.tot));
    if(e.best&&!near(e.best.res.tot,bestTot))probs.push('best is not the highest total');
    if(e.best&&(e.kind==='move')!==(e.best.res.tot>=e.never.tot))probs.push('verdict disagrees with the totals');
  }
  if(x.check){const c=x.check(e,p);if(c)probs.push(c);}
  check('Scenario',s.name,probs.join('; ')||null);
  const b=e.best,i=b&&b.res.info;
  report.push({name:s.name,verdict:e.kind==='invalid'?'asks to check inputs':e.kind==='none'?'no move possible':e.kind==='stay'?'stay put':'move at '+b.age,
    possible:e.kind==='invalid'?'–':e.ok.length+'/'+e.rows.length,never:e.never?k(e.never.tot):'–',best:b?k(b.res.tot):'–',
    detail:i?`price ${k(i.price)}, loan ${k(i.loan)} (${i.ltv.toFixed(0)}% LTV${i.rate?' at '+(i.rate*100).toFixed(2)+'%':''}), payment £${Math.round(i.pay||0).toLocaleString('en-GB')} vs pot £${Math.round(i.budget).toLocaleString('en-GB')}, tax £${Math.round(i.stamp).toLocaleString('en-GB')}`:(e.problem||'')});
}

// 4. What-ifs: change one input and the answer should move the way common sense says.
console.log('\nWhat-ifs');
const ev=inp=>M.evaluate(M.params(inp));
const bestTot=e=>e.best?e.best.res.tot:-Infinity;
const okAges=e=>new Set(e.ok.map(r=>r.age));
const subset=(a,b)=>[...a].every(x=>b.has(x));
const whatifs=[
  ['More savings never leaves you worse off',()=>bestTot(ev({savings:30000}))>=bestTot(ev({savings:10000}))],
  ['More savings never makes fewer years possible',()=>subset(okAges(ev({savings:10000})),okAges(ev({savings:30000})))],
  ['Higher income never makes fewer years possible',()=>subset(okAges(ev({income:65000})),okAges(ev({income:90000})))],
  ['A cheaper target never makes fewer years possible',()=>subset(okAges(ev({target:400000})),okAges(ev({target:350000})))],
  ['Valuing the new home more never delays the best age',()=>{const a=ev({income:90000,prefer:10}),b=ev({income:90000,prefer:80});return b.best.age<=a.best.age;}],
  ['Valuing the new home more raises every possible year\'s total',()=>{const a=ev({prefer:10}),b=ev({prefer:50});return a.ok.every(r=>b.ok.find(q=>q.age===r.age).res.tot>r.res.tot);}],
  ['Never-moving result ignores the target home',()=>near(ev({target:400000}).never.tot,ev({target:900000,newRegion:'London'}).never.tot)],
  ['"Rule it out" only removes years, never adds them',()=>subset(okAges(ev({income:90000,over:'rule'})),okAges(ev({income:90000})))],
  ['An early repayment charge lowers the total only before the fix ends',()=>{const a=ev({income:90000}),b=ev({income:90000,fixLeft:2,erc:3});
     const t=(e,age)=>e.rows.find(r=>r.age===age).res;return t(b,35).info.erc>0&&t(b,35).tot<t(a,35).tot&&t(b,38).info.erc===0;}],
  ['A 0% early repayment charge changes nothing',()=>near(bestTot(ev({income:90000,fixLeft:2,erc:0})),bestTot(ev({income:90000,fixLeft:2})))],
  ['A cheaper offer rate raises the move-now total',()=>{const a=ev({borrow:'offer',offer:340000,offerRate:5.5}),b=ev({borrow:'offer',offer:340000,offerRate:3.5});return b.rows[0].res.tot>a.rows[0].res.tot;}],
  ['Higher mortgage rates never leave you better off (with your real payment entered)',()=>{const up={curPay:950};M.BANDS.forEach(([b,r])=>up['r'+b]=r+1);return bestTot(ev(up))<=bestTot(ev({curPay:950}));}],
  ['Entering your payment sets the pot: payment + monthly saving',()=>near(M.simulate(M.params({curPay:950}),0).info.budget,950+600)],
  ['Higher stamp duty region costs more on the same price (Wales vs England, £400k)',()=>M.propTax(400000,'Wales',false)>M.propTax(400000,'North West',false)],
  ['Higher rent makes renting for good worse',()=>ev({ftb:'Yes',rent:1400}).never.tot<ev({ftb:'Yes',rent:1100}).never.tot],
  ['A later mortgage age limit never makes fewer years possible',()=>subset(okAges(ev({maxAge:70})),okAges(ev({maxAge:75})))],
];
whatifs.forEach(([n,f])=>{let ok;try{ok=f();}catch(err){ok=false;}check('What-if',n,ok?null:'did not hold');});

// Summary table of every scenario, for reading the results as a person would.
console.log('\nScenario results');
const w=Math.max(...report.map(r=>r.name.length));
report.forEach(r=>console.log('  '+r.name.padEnd(w)+'  '+r.verdict.padEnd(21)+' possible '+r.possible.padEnd(6)+' never '+r.never.padStart(8)+'  best '+r.best.padStart(8)+(verbose||r.detail.length<90?'\n'+' '.repeat(w+4)+r.detail:'')));

console.log('\n'+passed+' passed, '+failed+' failed');
if(failed){console.log(fails.map(f=>'  - '+f).join('\n'));process.exit(1);}
