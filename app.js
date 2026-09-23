const $=id=>document.getElementById(id);
const rWrap=$('rates');
BANDS.forEach(([b,r])=>{const l=document.createElement('label');l.innerHTML='Up to '+b+'%<input id="r'+b+'" type="number" step="0.05" value="'+r+'">';rWrap.appendChild(l);});
const ids=['age','income','lti','offer','offerRate','offerFix','curValue','owed','curYears','fixLeft','erc','sell','rent','target','term','maxAge','other','benefit','savings','save','s','wage','infl','fixYears','fee'];
const sels=['ftb','borrow','over','curRegion','curType','newRegion','newType','basis'];
const defaults={};ids.concat(sels,BANDS.map(b=>'r'+b[0])).forEach(i=>defaults[i]=$(i).value);

function growth(region,type,basis){return (REGION[region][basis]+TYPE[type][basis])/100;}

const gbp=v=>(v<0?'−':'')+'£'+Math.round(Math.abs(v)).toLocaleString('en-GB');
const gbpK=v=>{const a=Math.abs(v);return (v<0?'−':'')+(a>=1e6?'£'+(a/1e6).toFixed(2)+'m':'£'+Math.round(a/1000)+'k')};
const pct=v=>(v*100).toFixed(1)+'%';

function read(){const p={};ids.forEach(i=>p[i]=parseFloat($(i).value)||0);
  ['sell','s','wage','infl'].forEach(k=>p[k]/=100);
  p.ftb=$('ftb').value==='Yes';p.strict=$('over').selectedIndex===1;p.useOffer=$('borrow').selectedIndex===1;p.offerDeal=p.useOffer&&p.offerRate>0?{rate:p.offerRate/100,months:Math.round((p.offerFix||p.fixYears)*12)}:null;p.basis=$('basis').selectedIndex;
  p.newRegion=$('newRegion').value;
  p.gCur=growth($('curRegion').value,$('curType').value,p.basis);
  p.gNew=growth(p.newRegion,$('newType').value,p.basis);
  p.bands=BANDS.map(([b])=>[b,(parseFloat($('r'+b).value)||0)/100]);return p;}
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
  else{const r0=(value>0&&rateFor(p,bal/value*100))||p.bands[p.bands.length-1][1];budget=pmt(bal,r0,remain)+p.save;
    if(fixLeftM>0&&bal>0){rate=r0;payment=budget-p.save;dealLeft=fixLeftM;}}
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
        if(termM<60)return{ok:false,reason:'Too close to your maximum mortgage age',info};
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

function growthTable(p){
  const b=p.basis, types=Object.keys(TYPE);
  let h='<thead><tr><th>Region</th>'+types.map(t=>'<th>'+t.replace(' or maisonette','')+'</th>').join('')+'</tr></thead><tbody>';
  const cur=p.ftb?null:$('curRegion').value, nw=$('newRegion').value;
  Object.keys(REGION).forEach(r=>{h+='<tr'+(r===nw||r===cur?' class="best"':'')+'><td>'+r+'</td>'+types.map(t=>'<td>'+pct(growth(r,t,b))+'</td>').join('')+'</tr>';});
  $('gtbl').innerHTML=h+'</tbody>';
  $('growthUsed').textContent=(b?'Last 12 months':'Long-run')+' basis. '+(p.ftb?'':'Your home now grows at '+pct(p.gCur)+' a year; ')+'the home you want grows at '+pct(p.gNew)+' a year.';
}
function syncMode(){const f=$('ftb').value==='Yes',o=$('borrow').selectedIndex===1;$('offerRow').hidden=!o;document.querySelectorAll('.offerOnly').forEach(e=>e.hidden=!o);$('incomeRow').hidden=o;$('ltiRow').hidden=o;const eq=(parseFloat($('curValue').value)||0)-(parseFloat($('owed').value)||0);$('equityNote').textContent=eq<0?'negative equity of '+gbp(-eq):'your equity is '+gbp(eq);$('ownerSet').hidden=f;$('renterSet').hidden=!f;$('neverLbl').textContent=f?'Never buy (keep renting)':'Never move';}

function run(){
  syncMode();
  const p=read();
  growthTable(p);
  const never=simulate(p,null);
  const rows=[];
  for(let y=0;y<=45&&p.age+y<=p.maxAge-5&&p.age+y<100;y++)rows.push({y,age:p.age+y,res:simulate(p,y)});
  const ok=rows.filter(r=>r.res.ok);
  let best=null,bestFin=null;
  ok.forEach(r=>{if(!best||r.res.tot>best.res.tot)best=r;if(!bestFin||r.res.fin>bestFin.res.fin)bestFin=r;});
  const first=ok[0];
  // verdict
  const V=$('verdict'),S=$('sub'),F=$('facts');
  if(!best){status('none','Not possible yet');V.textContent='No move is possible on these numbers';S.textContent='Every year fails at least one check. Look at the reasons in the table, then try a longer term, more saving, or a cheaper target home.';F.innerHTML='';}
  else if(best.res.tot<never.tot){status('stay',p.ftb?'Keep renting':'Stay put');V.textContent=p.ftb?'Renting comes out ahead':'Staying put comes out ahead';
    S.textContent='Even at the best time (age '+best.age+'), moving leaves you '+gbp(never.tot-best.res.tot)+' worse off by 100 in today\'s money. Raise the "worth to you" figure if the bigger home matters more than that.';
    F.innerHTML=fact('Best move age',best.age)+fact('Earliest possible',first.age);}
  else{status('move',p.ftb?'Worth buying':'Worth moving');V.textContent=best.y===0?'Move now, at '+best.age:'Move at '+best.age+', in '+best.y+' year'+(best.y>1?'s':'');
    const i=best.res.info;
    S.textContent='By 100 that leaves you '+gbp(best.res.tot-never.tot)+' better off than '+(p.ftb?'renting for good':'never moving')+', in today\'s money.'+(bestFin&&bestFin.y!==best.y?' On money alone the best age would be '+bestFin.age+'.':'')+(first&&first.y<best.y?' You could move from '+first.age+', but waiting pays.':'');
    F.innerHTML=fact('Price then',gbp(i.price))+fact('Deposit',gbp(Math.min(i.dep,i.price)))+fact('Loan-to-value',i.ltv.toFixed(0)+'%')+(i.pay?fact(i.fromOffer?'Rate (your offer)':'Rate',(i.rate*100).toFixed(2)+'%')+fact('Payment',gbp(i.pay)+'/mo'):'')+fact('Your pot then',gbp(i.budget)+'/mo')+(i.over>0?fact('Over your pot',gbp(i.over)+'/mo','warn'):'')+fact('Lenders would lend',gbp(i.maxLoan))+fact(taxName(p.newRegion),gbp(i.stamp))+(i.erc>0?fact('Early repayment charge',gbp(i.erc),'warn'):'');
    if(i.over>0)S.textContent+=' The payment is '+gbp(i.over)+'/mo more than your pot at first; that comes out of savings and is already counted.';}
  table(rows,best);chart(rows,never,best,p);
}
const ICONS={move:'<path d="M3.5 8.5l3 3 6-7"/>',stay:'<path d="M2.5 8h11"/>',none:'<path d="M4 4l8 8M12 4l-8 8"/>'};
function status(kind,label){const b=$('badge');b.hidden=false;b.className='badge '+kind;
  b.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+ICONS[kind]+'</svg>'+label;
  $('hero').classList.toggle('is-none',kind==='none');}
function fact(k,v,cls){return '<div'+(cls?' class="'+cls+'"':'')+'><dt>'+k+'</dt><dd>'+v+'</dd></div>';}
function table(rows,best){
  let h='<thead><tr><th>Move at</th><th>Price then</th><th>ERC</th><th>Deposit</th><th>LTV</th><th>Rate</th><th>Payment</th><th>Your pot</th><th>Over pot</th><th>At 100</th><th>Money only</th></tr></thead><tbody>';
  rows.forEach(r=>{const i=r.res.info||{};
    if(!r.res.ok){h+='<tr class="fail"><td>'+r.age+'</td><td>'+gbp(i.price)+'</td><td>'+(i.erc>0?gbp(i.erc):'–')+'</td><td colspan="8" class="no">'+r.res.reason+'</td></tr>';return;}
    const isBest=best&&r.y===best.y;
    h+='<tr'+(isBest?' class="best"':'')+'><td>'+r.age+(isBest?'<span class="pill">Best</span>':'')+'</td><td>'+gbp(i.price)+'</td><td>'+(i.erc>0?gbp(i.erc):'–')+'</td><td>'+gbp(Math.min(i.dep,i.price))+'</td><td>'+i.ltv.toFixed(0)+'%</td><td>'+(i.rate?(i.rate*100).toFixed(2)+'%':'–')+'</td><td>'+(i.pay?gbp(i.pay):'–')+'</td><td>'+gbp(i.budget)+'</td><td'+(i.over>0?' class="warn"':'')+'>'+(i.over>0?gbp(i.over):'–')+'</td><td>'+gbpK(r.res.tot)+'</td><td>'+gbpK(r.res.fin)+'</td></tr>';});
  $('tbl').innerHTML=h+'</tbody>';
}

// Chart: drawn at the box's real pixel width so text stays readable on phones.
let CH=null;
const axisK=v=>{const a=Math.abs(v),sg=v<0?'−':'';return a>=1e6?sg+'£'+(a/1e6).toFixed(2).replace(/\.?0+$/,'')+'m':sg+'£'+Math.round(a/1000)+'k';};
function niceStep(span,n){const raw=span/n,p=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/p;return p*(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10);}
function chart(rows,never,best,p){CH={rows,never,best,ftb:p.ftb};drawChart();}
function drawChart(){
  if(!CH)return;
  const {rows,never,best,ftb}=CH, svg=$('chart'), box=$('chartbox');
  const W=Math.max(280,Math.round(box.clientWidth||640)), narrow=W<560, H=narrow?250:320;
  const L=54,R=narrow?12:132,T=28,B=30;
  const ok=rows.filter(r=>r.res.ok);
  const vals=[never.tot,never.fin].concat(ok.flatMap(r=>[r.res.tot,r.res.fin]));
  let lo=Math.min(...vals),hi=Math.max(...vals);if(hi-lo<1){hi+=1;lo-=1;}
  const st=niceStep(hi-lo,narrow?4:5);lo=Math.floor(lo/st)*st;hi=Math.ceil(hi/st)*st;
  const a0=rows[0]?rows[0].age:0,a1=rows.length>1?rows[rows.length-1].age:a0+1;
  const x=a=>L+(a-a0)/(a1-a0)*(W-L-R), y=v=>T+(1-(v-lo)/(hi-lo))*(H-T-B);
  let s='';
  for(let v=lo;v<=hi+st/2;v+=st){const yy=y(v).toFixed(1);s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" stroke="var(--lineSoft)"/><text x="'+(L-8)+'" y="'+(+yy+4)+'" text-anchor="end" font-size="12" fill="var(--muted)">'+axisK(v)+'</text>';}
  const xs=niceStep(Math.max(1,a1-a0),narrow?5:9);
  for(let a=Math.ceil(a0/xs)*xs;a<=a1;a+=xs)s+='<text x="'+x(a).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" font-size="12" fill="var(--muted)">'+a+'</text>';
  s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(never.tot).toFixed(1)+'" y2="'+y(never.tot).toFixed(1)+'" stroke="var(--s2)" stroke-width="2" stroke-dasharray="7 5"/>';
  const path=k=>{let d='',prev=false;rows.forEach(r=>{if(r.res.ok){d+=(prev?'L':'M')+x(r.age).toFixed(1)+' '+y(r.res[k]).toFixed(1);prev=true;}else prev=false;});return d;};
  s+='<path d="'+path('fin')+'" fill="none" stroke="var(--s3)" stroke-width="2" stroke-dasharray="1.5 4" stroke-linecap="round"/>';
  s+='<path d="'+path('tot')+'" fill="none" stroke="var(--s1)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
  // Direct labels at the right-hand end of each line, nudged apart so they never overlap.
  if(!narrow&&ok.length){const lastOk=ok[ok.length-1];
    const labs=[{t:'With living value',v:lastOk.res.tot,w:700},{t:'Money only',v:lastOk.res.fin,w:500},{t:ftb?'Keep renting':'Never move',v:never.tot,w:500}].map(o=>({...o,y:y(o.v)})).sort((a,b)=>a.y-b.y);
    for(let i=1;i<labs.length;i++)if(labs[i].y-labs[i-1].y<15)labs[i].y=labs[i-1].y+15;
    const over=labs[labs.length-1].y-(H-B);if(over>0)labs.forEach(o=>o.y-=over);
    labs.forEach(o=>{s+='<text x="'+(W-R+8)+'" y="'+(o.y+4).toFixed(1)+'" font-size="12" font-weight="'+o.w+'" fill="'+(o.w>600?'var(--ink)':'var(--muted)')+'">'+o.t+'</text>';});}
  if(best){const bx=x(best.age),by=y(best.res.tot);
    s+='<circle cx="'+bx.toFixed(1)+'" cy="'+by.toFixed(1)+'" r="6" fill="var(--s1)" stroke="var(--card)" stroke-width="2.5"/>';
    s+='<text x="'+Math.min(Math.max(bx,L+34),W-R-34).toFixed(1)+'" y="'+Math.max(by-13,14).toFixed(1)+'" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)">Best: '+best.age+'</text>';}
  if(!ok.length)s+='<text x="'+((L+W-R)/2)+'" y="'+(H/2)+'" text-anchor="middle" font-size="14" fill="var(--muted)">No possible move years</text>';
  s+='<g id="hov"></g><rect id="hit" x="'+L+'" y="'+T+'" width="'+(W-L-R)+'" height="'+(H-T-B)+'" fill="transparent"/>';
  svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('width',W);svg.setAttribute('height',H);
  svg.setAttribute('aria-label',best?'Wealth at age 100 by moving age. Best age to move: '+best.age+'.':'Wealth at age 100 by moving age. No possible move years.');
  svg.innerHTML=s;
  CH.geo={x,y,L,R,T,B,W,H,a0,a1};
  const hit=$('hit');
  hit.addEventListener('pointermove',hover);hit.addEventListener('pointerdown',hover);
  hit.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')unhover();});
}
function hover(e){
  const {rows,never,ftb,geo}=CH, svg=$('chart'), rect=svg.getBoundingClientRect();
  const px=(e.clientX-rect.left)*geo.W/rect.width;
  const age=Math.round(geo.a0+(px-geo.L)/(geo.W-geo.L-geo.R)*(geo.a1-geo.a0));
  const r=rows.find(q=>q.age===Math.min(Math.max(age,geo.a0),geo.a1));if(!r)return;
  const cx=geo.x(r.age);let g='<line x1="'+cx+'" x2="'+cx+'" y1="'+geo.T+'" y2="'+(geo.H-geo.B)+'" stroke="var(--muted)" stroke-width="1"/>';
  const dot=(v,c)=>'<circle cx="'+cx+'" cy="'+geo.y(v)+'" r="4.5" fill="'+c+'" stroke="var(--card)" stroke-width="2"/>';
  g+=dot(never.tot,'var(--s2)');if(r.res.ok)g+=dot(r.res.fin,'var(--s3)')+dot(r.res.tot,'var(--s1)');
  $('hov').innerHTML=g;
  const row=(c,dash,k,v)=>'<div class="r"><span><i style="border-top:2px '+dash+' '+c+'"></i>'+k+'</span><span>'+axisK(v)+'</span></div>';
  const tip=$('tip');
  tip.innerHTML='<b>Move at '+r.age+'</b>'+(r.res.ok?row('var(--s1)','solid','With living value',r.res.tot)+row('var(--s3)','dotted','Money only',r.res.fin):'<div class="no">'+r.res.reason+'</div>')+row('var(--s2)','dashed',ftb?'Keep renting':'Never move',never.tot);
  tip.hidden=false;
  const bw=$('chartbox').clientWidth,tw=tip.offsetWidth,sx=cx*rect.width/geo.W;
  tip.style.left=Math.round(sx+14+tw>bw?Math.max(0,sx-14-tw):sx+14)+'px';tip.style.top=Math.round(geo.T*rect.height/geo.H)+'px';
}
function unhover(){const h=$('hov');if(h)h.innerHTML='';$('tip').hidden=true;}
if(window.ResizeObserver){let lastW=0;new ResizeObserver(en=>{const w=Math.round(en[0].contentRect.width);if(w!==lastW){lastW=w;unhover();drawChart();}}).observe($('chartbox'));}
document.addEventListener('pointerdown',e=>{if(!e.target.closest||!e.target.closest('#chartbox'))unhover();});
document.querySelectorAll('input,select').forEach(i=>i.addEventListener('input',run));
// Number fields are typed only: no arrow-key or scroll-wheel stepping.
document.querySelectorAll('input[type=number]').forEach(i=>{i.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown')e.preventDefault();});i.addEventListener('wheel',e=>{if(document.activeElement===i)e.preventDefault();},{passive:false});});
$('reset').addEventListener('click',()=>{Object.entries(defaults).forEach(([k,v])=>$(k).value=v);run();});
run();
