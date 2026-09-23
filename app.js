const $=id=>document.getElementById(id);
const rWrap=$('rates');
BANDS.forEach(([b,r])=>{const l=document.createElement('label');l.innerHTML='Up to '+b+'%<input id="r'+b+'" type="number" step="0.05" value="'+r+'">';rWrap.appendChild(l);});
const FIELDS=Object.keys(DEFAULTS);
function setFields(v){FIELDS.forEach(k=>{const e=$(k);if(e)e.value=v[k];});}
function read(){return params(Object.fromEntries(FIELDS.map(k=>[k,$(k).value])));}

const gbpK=v=>{const a=Math.abs(v);return (v<0?'−':'')+(a>=1e6?'£'+(a/1e6).toFixed(2)+'m':'£'+Math.round(a/1000)+'k')};
const pct=v=>(v*100).toFixed(1)+'%';

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
  if(!p.ftb){const r0=p.curValue>0&&rateFor(p,p.owed/p.curValue*100)||p.bands[p.bands.length-1][1];
    $('payNote').textContent=p.owed<=0?'no mortgage':p.curPay>0?'used as your payment now':p.curYears<=0?'enter the years left to estimate it':'blank: estimated at '+gbp(pmt(p.owed,r0,Math.round(p.curYears*12)))+'/mo';}
  $('preferNote').textContent=p.prefer===0?'0 judges on money alone':(p.prefer<0?'a drawback of about '+gbp(-p.benefit):'worth about '+gbp(p.benefit))+'/mo now, '+(p.ftb?'as a share of your rent':'if your home would rent for about '+gbp(p.baseRent)+'/mo');
  const res=evaluate(p);
  if(res.problem){status('none','Check your numbers');$('verdict').textContent='Something doesn\'t add up';$('sub').textContent=res.problem;$('facts').innerHTML='';$('tbl').innerHTML='';$('alert').hidden=true;$('dealsCard').hidden=true;CH=null;$('chart').innerHTML='';unhover();return;}
  const {never,rows,ok,best,bestFin,first}=res;
  // verdict
  const V=$('verdict'),S=$('sub'),F=$('facts');
  if(!best){status('none','Not possible yet');V.textContent='No move is possible on these numbers';S.textContent='Every year fails at least one check. Look at the reasons in the table, then try a longer term, more saving, or a cheaper target home.';F.innerHTML='';}
  else if(best.res.tot<never.tot){status('stay',p.ftb?'Keep renting':'Stay put');V.textContent=p.ftb?'Renting comes out ahead':'Staying put comes out ahead';
    S.textContent='Even at the best time (age '+best.age+'), moving leaves you '+gbp(never.tot-best.res.tot)+' worse off by 100 in today\'s money. Raise how much more you\'d value living there if the new home matters more than that.';
    F.innerHTML=fact('Best move age',best.age)+fact('Earliest possible',first.age);}
  else{status('move',p.ftb?'Worth buying':'Worth moving');V.textContent=best.y===0?'Move now, at '+best.age:'Move at '+best.age+', in '+best.y+' year'+(best.y>1?'s':'');
    const i=best.res.info;
    S.textContent='By 100 that leaves you '+gbp(best.res.tot-never.tot)+' better off than '+(p.ftb?'renting for good':'never moving')+', in today\'s money.'+(first&&first.y<best.y?' You could move from '+first.age+', but waiting until '+best.age+' leaves you '+gbp(best.res.tot-first.res.tot)+' better off.':'')+(bestFin&&bestFin.y!==best.y?' On money alone the best age would be '+bestFin.age+', but only by '+gbp(bestFin.res.fin-best.res.fin)+', so how much you value the new home decides the timing.':'');
    S.textContent+=closeCall(ok,best);
    F.innerHTML=fact('Price then',gbp(i.price))+fact('Deposit',gbp(Math.min(i.dep,i.price)))+fact('Loan-to-value',i.ltv.toFixed(0)+'%')+(i.pay?fact(i.fromOffer?'Rate (your offer)':'Rate',(i.rate*100).toFixed(2)+'%')+fact('Payment',gbp(i.pay)+'/mo'):'')+fact('Your pot then',gbp(i.budget)+'/mo')+(i.over>0?fact('Over your pot',gbp(i.over)+'/mo','warn'):'')+fact('Lenders would lend',gbp(i.maxLoan))+fact(taxName(p.newRegion),gbp(i.stamp))+(i.erc>0?fact('Early repayment charge',gbp(i.erc),'warn'):'');
    if(i.over>0&&!best.res.short)S.textContent+=' The payment is '+gbp(i.over)+'/mo more than your pot at first; that comes out of savings and is already counted.';}
  // Warn when the recommended path (or staying put) runs savings below zero.
  shortAlert(best&&best.res.tot>=never.tot?best:{res:never,stay:true},p);
  dealsTable(p,best&&best.res.tot>=never.tot?best.y:null);
  table(rows,best);chart(rows,never,best,p);
}
const ICONS={move:'<path d="M3.5 8.5l3 3 6-7"/>',stay:'<path d="M2.5 8h11"/>',none:'<path d="M4 4l8 8M12 4l-8 8"/>'};
function status(kind,label){const b=$('badge');b.hidden=false;b.className='badge '+kind;
  b.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+ICONS[kind]+'</svg>'+label;
  $('hero').classList.toggle('is-none',kind==='none');}
// When other years are within 1% of the best, the timing is a close call: say so, with the range.
function closeCall(ok,best){const near=ok.filter(r=>best.res.tot-r.res.tot<=Math.abs(best.res.tot)*0.01);if(near.length<2)return '';
  const a=near[0].age,b=near[near.length-1].age;return ' It\'s a close call: moving any time from '+a+' to '+b+' comes within 1% ('+gbp(Math.abs(best.res.tot)*0.01)+') of the best.';}
function shortAlert(path,p){const a=$('alert'),s=path&&path.res.short;
  if(!s){a.hidden=true;return;}
  a.hidden=false;
  a.innerHTML='<b>Your savings run out'+(path.stay?(p.ftb?' if you keep renting':' if you stay put'):'')+'.</b> They drop below zero at '+Math.floor(s.from)+' and are at their lowest at '+Math.floor(s.worstAge)+', '+gbp(-s.worst)+' short in today\'s money. '+
    'The figures assume you borrow the gap at your savings interest rate. In practice you\'d need to cut other spending or borrow at a higher rate, so treat this result with care.';}
// Every fixed deal on the recommended path (or staying put): rate by LTV at each remortgage.
function dealsTable(p,moveYear){
  const d=[];simulate(p,moveYear,d);
  if(!d.length){$('dealsCard').hidden=true;return;}
  $('dealsCard').hidden=false;
  const lowest=Math.min(...p.bands.map(b=>b[1]));
  $('dealsNote').textContent=(moveYear==null?(p.ftb?'Renting for good, so no mortgage.':'If you stay put. '):'If you move at '+(p.age+moveYear)+'. ')+
    'Each time a fix ends you remortgage at the rate for your loan-to-value then. Rates stop falling once you\'re in the lowest band (up to '+p.bands[0][0]+'% LTV, '+(lowest*100).toFixed(2)+'%).';
  let h='<thead><tr><th>From age</th><th>Owed</th><th>Home worth</th><th>LTV</th><th>Rate</th><th>Payment</th></tr></thead><tbody>';
  d.forEach((x,i)=>{const prev=d[i-1],down=prev&&x.rate<prev.rate-1e-9;
    h+='<tr><td>'+Math.floor(x.age)+'</td><td>'+gbp(x.balance)+'</td><td>'+gbp(x.value)+'</td><td>'+x.ltv.toFixed(0)+'%</td><td'+(down?' class="good"':'')+'>'+(x.rate*100).toFixed(2)+'%'+(down?' ↓':'')+'</td><td>'+gbp(x.payment)+'</td></tr>';});
  $('deals').innerHTML=h+'</tbody>';
}
function fact(k,v,cls){return '<div'+(cls?' class="'+cls+'"':'')+'><dt>'+k+'</dt><dd>'+v+'</dd></div>';}
function table(rows,best){
  let h='<thead><tr><th>Move at</th><th>Price then</th><th>ERC</th><th>Deposit</th><th>LTV</th><th>First rate</th><th>Payment</th><th>Your pot</th><th>Over pot</th><th>Savings run out</th><th>At 100</th><th>Money only</th></tr></thead><tbody>';
  rows.forEach(r=>{const i=r.res.info||{};
    if(!r.res.ok){h+='<tr class="fail"><td>'+r.age+'</td><td>'+gbp(i.price)+'</td><td>'+(i.erc>0?gbp(i.erc):'–')+'</td><td colspan="9" class="no">'+r.res.reason+'</td></tr>';return;}
    const isBest=best&&r.y===best.y;
    h+='<tr'+(isBest?' class="best"':'')+'><td>'+r.age+(isBest?'<span class="pill">Best</span>':'')+'</td><td>'+gbp(i.price)+'</td><td>'+(i.erc>0?gbp(i.erc):'–')+'</td><td>'+gbp(Math.min(i.dep,i.price))+'</td><td>'+i.ltv.toFixed(0)+'%</td><td>'+(i.rate?(i.rate*100).toFixed(2)+'%':'–')+'</td><td>'+(i.pay?gbp(i.pay):'–')+'</td><td>'+gbp(i.budget)+'</td><td'+(i.over>0?' class="warn"':'')+'>'+(i.over>0?gbp(i.over):'–')+'</td><td'+(r.res.short?' class="warn" title="Lowest point '+gbp(-r.res.short.worst)+' short at '+Math.floor(r.res.short.worstAge)+'"':'')+'>'+(r.res.short?'at '+Math.floor(r.res.short.from):'–')+'</td><td>'+gbpK(r.res.tot)+'</td><td>'+gbpK(r.res.fin)+'</td></tr>';});
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
    const labs=[{t:'Incl. preference',v:lastOk.res.tot,w:700},{t:'Money only',v:lastOk.res.fin,w:500},{t:ftb?'Keep renting':'Never move',v:never.tot,w:500}].map(o=>({...o,y:y(o.v)})).sort((a,b)=>a.y-b.y);
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
  tip.innerHTML='<b>Move at '+r.age+'</b>'+(r.res.ok?row('var(--s1)','solid','Incl. preference',r.res.tot)+row('var(--s3)','dotted','Money only',r.res.fin):'<div class="no">'+r.res.reason+'</div>')+row('var(--s2)','dashed',ftb?'Keep renting':'Never move',never.tot);
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
$('reset').addEventListener('click',()=>{setFields(DEFAULTS);run();});
// Export: your inputs (as typed, using the model's field names) and the full results, as a JSON file.
function exportData(){
  const inputs=Object.fromEntries(FIELDS.map(k=>[k,$(k).value])), p=params(inputs), e=evaluate(p);
  const r2=v=>v==null?null:Math.round(v*100)/100, info=i=>i&&{price:r2(i.price),deposit:r2(i.dep),loan:r2(i.loan),ltv:r2(i.ltv),rate:i.rate==null?null:r2(i.rate*100),
    payment:r2(i.pay),pot:r2(i.budget),overPot:r2(i.over),propertyTax:r2(i.stamp),earlyRepaymentCharge:r2(i.erc),lendingLimit:r2(i.maxLoan)};
  const short=s=>s&&{fromAge:r2(s.from),lowestAge:r2(s.worstAge),lowest:r2(s.worst)};
  const out={app:'When to move house',exported:new Date().toISOString(),inputs,
    result:{verdict:$('verdict').textContent,summary:$('sub').textContent,kind:e.kind,problem:e.problem||null}};
  if(!e.problem){const moveY=e.kind==='move'?e.best.y:null,d=[];simulate(p,moveY,d);
    Object.assign(out.result,{bestAge:e.best&&e.best.age,moneyOnlyBestAge:e.bestFin&&e.bestFin.age,
      neverMove:{atHundred:r2(e.never.tot),savingsShort:short(e.never.short)},
      best:e.best&&{age:e.best.age,atHundred:r2(e.best.res.tot),moneyOnly:r2(e.best.res.fin),...info(e.best.res.info),savingsShort:short(e.best.res.short)},
      deals:d.map(x=>({fromAge:r2(x.age),owed:r2(x.balance),homeWorth:r2(x.value),ltv:r2(x.ltv),rate:r2(x.rate*100),payment:r2(x.payment)})),
      years:e.rows.map(r=>Object.assign({age:r.age,possible:r.res.ok,reason:r.res.reason||null},r.res.ok?{atHundred:r2(r.res.tot),moneyOnly:r2(r.res.fin),savingsShort:short(r.res.short)}:{},info(r.res.info)))});}
  const text=JSON.stringify(out,null,2), name='when-to-move-'+new Date().toISOString().slice(0,10)+'.json';
  try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(err){}
  const b=$('export');
  const done=msg=>{b.textContent=msg;setTimeout(()=>b.textContent='Export',2000);};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(()=>done('Saved & copied'),()=>done('Saved'));else done('Saved');
  return out;
}
$('export').addEventListener('click',exportData);
setFields(DEFAULTS);
run();
