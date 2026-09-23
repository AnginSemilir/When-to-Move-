// The model: pure calculations, no page access. Used by the page (app.js) and the tests (tests/run.js).
// Relies on BANDS, REGION, TYPE and RENT_YIELD from data.js.

// Default inputs, keyed by the page's field ids. The page starts from these and Reset returns to them.
const DEFAULTS=Object.assign({
  age:35,ftb:'No',borrow:'income',income:65000,lti:4.5,offer:300000,offerRate:'',offerFix:'',over:'pay',
  curRegion:'North West',curType:'Terraced',curValue:250000,owed:170000,curPay:'',curYears:25,fixLeft:'',erc:'',sell:1.5,
  rent:1100,
  newRegion:'North West',newType:'Semi-detached',target:400000,term:30,maxAge:70,other:3000,prefer:30,
  savings:10000,save:600,s:4,wage:2,
  basis:'0',infl:2.5,fixYears:5,fee:1000
},Object.fromEntries(BANDS.map(([b,r])=>['r'+b,r])));
const NUMERIC=['age','income','lti','offer','offerRate','offerFix','curValue','owed','curPay','curYears','fixLeft','erc','sell','rent','target','term','maxAge','other','prefer','savings','save','s','wage','infl','fixYears','fee'];

// Turn raw field values (as typed, so strings are fine) into the parameters the model runs on.
// Anything not given falls back to DEFAULTS.
function params(values){
  const v=Object.assign({},DEFAULTS,values), p={};
  NUMERIC.forEach(k=>p[k]=parseFloat(v[k])||0);
  ['sell','s','wage','infl'].forEach(k=>p[k]/=100);
  p.ftb=v.ftb===true||v.ftb==='Yes';p.strict=v.over==='rule';p.useOffer=v.borrow==='offer';
  p.offerDeal=p.useOffer&&p.offerRate>0?{rate:p.offerRate/100,months:Math.round((p.offerFix||p.fixYears)*12)}:null;
  p.basis=+v.basis?1:0;
  p.curRegion=v.curRegion;p.newRegion=v.newRegion;
  p.gCur=growth(v.curRegion,v.curType,p.basis);
  p.gNew=growth(v.newRegion,v.newType,p.basis);
  // The new home is worth this much more a month to you, in today's money: a percentage of what your home now would rent for.
  p.baseRent=p.ftb?p.rent:p.curValue*RENT_YIELD/12;p.benefit=p.prefer/100*p.baseRent;
  p.bands=BANDS.map(([b])=>[b,(parseFloat(v['r'+b])||0)/100]);
  return p;
}

function growth(region,type,basis){return (REGION[region][basis]+TYPE[type][basis])/100;}

const gbp=v=>(v<0?'−':'')+'£'+Math.round(Math.abs(v)).toLocaleString('en-GB');

function rateFor(p,ltv){for(const [b,r] of p.bands){if(ltv<=b+1e-9)return r;}return null;}
function pmt(bal,r,n){if(bal<=0)return 0;if(n<=0)return bal;const m=r/12;return m===0?bal/n:bal*m/(1-Math.pow(1+m,-n));}
function banded(price,bands){let t=0,lo=0;for(const [hi,r] of bands){if(price>lo)t+=(Math.min(price,hi)-lo)*r;lo=hi;}return t;}
function propTax(price,region,ftb){
  if(region==='Scotland')return banded(price,ftb?[[175000,0],[250000,.02],[325000,.05],[750000,.10],[Infinity,.12]]:[[145000,0],[250000,.02],[325000,.05],[750000,.10],[Infinity,.12]]);
  if(region==='Wales')return banded(price,[[225000,0],[400000,.06],[750000,.075],[1500000,.10],[Infinity,.12]]);
  if(ftb&&price<=500000)return banded(price,[[300000,0],[500000,.05]]);
  return banded(price,[[125000,0],[250000,.02],[925000,.05],[1500000,.10],[Infinity,.12]]);
}
function taxName(region){return region==='Scotland'?'LBTT':region==='Wales'?'Land Transaction Tax':'Stamp duty';}

function simulate(p,moveYear){
  const T=Math.max(1,Math.round((100-p.age)*12));
  const sm=p.s/12, gmCur=Math.pow(1+p.gCur,1/12)-1, gmNew=Math.pow(1+p.gNew,1/12)-1;
  let value=p.ftb?0:p.curValue, bal=p.ftb?0:Math.max(0,p.owed), savings=p.savings, benefit=0, lend=p.useOffer?p.offer:p.income*p.lti;
  let remain=Math.round(p.curYears*12), dealLeft=0, rate=0, payment=0, moved=false, info=null;
  let budget;const fixLeftM=p.ftb?0:Math.round(p.fixLeft*12);
  if(p.ftb)budget=p.rent+p.save;
  else{const r0=(value>0&&rateFor(p,bal/value*100))||p.bands[p.bands.length-1][1];
    // Your real payment if you gave it; otherwise estimated from the rates table.
    const pay0=p.curPay>0&&bal>0?p.curPay:pmt(bal,r0,remain);budget=pay0+p.save;
    if(fixLeftM>0&&bal>0){rate=r0;payment=pay0;dealLeft=fixLeftM;}}
  const moveM=moveYear==null?-1:moveYear*12;
  for(let m=0;m<T;m++){
    if(m>0&&m%12===0){budget*=1+p.wage;lend*=1+p.wage;}
    if(m===moveM){
      const age=p.age+m/12, price=p.target*Math.pow(1+p.gNew,m/12);
      const erc=m<fixLeftM?bal*p.erc/100:0;
      const cash=(p.ftb?0:value*(1-p.sell)-bal-erc)+savings, stamp=propTax(price,p.newRegion,p.ftb);
      const dep=cash-stamp-p.fee-p.other;
      const termM=Math.min(Math.round(p.term*12),Math.round((p.maxAge-age)*12));
      info={age,price,stamp,erc,dep,budget,maxLoan:lend};
      if(dep<=0)return{ok:false,reason:'Not enough cash to cover moving costs',info};
      const loan=Math.max(0,price-dep), ltv=loan/price*100;Object.assign(info,{loan,ltv});
      if(loan>0){
        if(ltv>95)return{ok:false,reason:'Deposit under 5%',info};
        if(termM<60)return{ok:false,reason:TOO_OLD,info};
        if(loan>info.maxLoan)return{ok:false,reason:'Loan of '+gbp(loan)+' is over the '+gbp(info.maxLoan)+(p.useOffer?' your mortgage offer allows':' lenders would offer ('+p.lti+'× income)'),info};
        const r=p.offerDeal?p.offerDeal.rate:rateFor(p,ltv), pay=pmt(loan,r,termM);Object.assign(info,{rate:r,pay,over:Math.max(0,pay-budget),fromOffer:!!p.offerDeal});
        if(p.strict&&pay>budget)return{ok:false,reason:'Payment '+gbp(pay)+'/mo is over your '+gbp(budget)+'/mo pot',info};
      }
      value=price;bal=loan;savings=Math.max(0,dep-price);remain=termM;dealLeft=0;moved=true;
      if(loan>0&&p.offerDeal){rate=info.rate;payment=info.pay;dealLeft=p.offerDeal.months;}
    }
    if(bal>0&&dealLeft<=0){
      rate=rateFor(p,bal/value*100)??p.bands[p.bands.length-1][1];
      payment=pmt(bal,rate,remain);dealLeft=Math.round(p.fixYears*12);
      if(m>0&&m!==moveM)savings-=p.fee;
    }
    let out=0;
    if(p.ftb&&!moved)out=p.rent*Math.pow(1+p.infl,m/12);
    else if(bal>0){const int=bal*rate/12;out=Math.min(payment,bal+int);bal=bal+int-out;if(bal<1)bal=0;}
    remain--;dealLeft--;
    savings=savings*(1+sm)+(budget-out);
    value*=1+(moved?gmNew:gmCur);
    if(moved)benefit=benefit*(1+sm)+p.benefit*Math.pow(1+p.infl,m/12);
  }
  const defl=Math.pow(1+p.infl,T/12);
  const fin=(value-bal+savings)/defl;
  return{ok:true,fin,tot:fin+benefit/defl,info};
}

// Run every possible moving year and pick the best. Returns everything the page and tests need.
const TOO_OLD='Too close to your maximum mortgage age';
// Inputs the model can't make sense of. Returns a message for the person, or null.
function checkInputs(p){
  if(p.age<16||p.age>=95)return 'Enter an age between 16 and 94.';
  if(!p.ftb&&p.owed>0&&p.curYears<=0)return 'You still owe '+gbp(p.owed)+' but have no years left on your mortgage. Enter the years left, or set what you owe to 0.';
  if(p.target<=0)return 'Enter the price of the home you want.';
  return null;
}
function evaluate(p){
  const problem=checkInputs(p);
  if(problem)return{problem,never:null,rows:[],ok:[],best:null,bestFin:null,first:null,kind:'invalid'};
  const never=simulate(p,null), rows=[];
  for(let y=0;y<=45&&p.age+y<95;y++)rows.push({y,age:p.age+y,res:simulate(p,y)});
  // Past the mortgage age limit only cash buyers can move; drop the trailing years that fail on age alone.
  while(rows.length&&!rows[rows.length-1].res.ok&&rows[rows.length-1].res.reason===TOO_OLD)rows.pop();
  const ok=rows.filter(r=>r.res.ok);
  let best=null,bestFin=null;
  ok.forEach(r=>{if(!best||r.res.tot>best.res.tot)best=r;if(!bestFin||r.res.fin>bestFin.res.fin)bestFin=r;});
  const kind=!best?'none':best.res.tot<never.tot?'stay':'move';
  return{never,rows,ok,best,bestFin,first:ok[0]||null,kind};
}
