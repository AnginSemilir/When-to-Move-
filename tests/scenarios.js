// Library of test scenarios. Each one is a person, described by the inputs they'd type into the page
// (anything left out uses the page's defaults), plus what a sensible answer looks like.
//
// expect fields (all optional):
//   kind        'move' | 'stay' | 'none' | 'invalid'
//   bestAge     exact best age, or bestAgeIn: [from, to]
//   minOk       at least this many possible moving years
//   reasons     failure reasons (regex) that must appear in the table
//   noReasons   failure reasons (regex) that must not appear
//   check(e,p)  extra checks; return a string describing the problem, or nothing
//
// e is what evaluate() returns: {kind, best, bestFin, first, never, rows, ok, problem}.

const at=(e,age)=>e.rows.find(r=>r.age===age);

module.exports=[
  {
    name:'Default: owner upsizing in the North West',
    why:'The page as it opens. A £250k terrace owner wanting a £400k semi, £65k income.',
    inputs:{},
    expect:{kind:'move',bestAge:39,reasons:[/lenders would offer \(4\.5× income\)/],
      check:e=>{const i=e.best.res.info;
        if(Math.abs(i.pay-1664)>2)return 'payment at 39 should be about £1,664, got '+Math.round(i.pay);
        if(i.loan>i.maxLoan)return 'loan is over what lenders would lend';}}
  },
  {
    name:'Default, judged on money alone',
    why:'With 0% extra value, the total must equal the money-only figure in every year.',
    inputs:{prefer:0},
    expect:{kind:'move',check:e=>{const bad=e.ok.find(r=>Math.abs(r.res.tot-r.res.fin)>0.01);if(bad)return 'total differs from money-only at '+bad.age;}}
  },
  {
    name:'First-time buyer on the defaults',
    why:'£10k saved and £65k income can\'t reach a £400k home: 5% deposit and 4.5× income both bite.',
    inputs:{ftb:'Yes'},
    expect:{kind:'none',reasons:[/Deposit under 5%/,/lenders would offer/]}
  },
  {
    name:'First-time buyer, £90k income, £40k saved',
    why:'Now the deposit and loan work, so buying beats renting for good by a wide margin.',
    inputs:{ftb:'Yes',income:90000,savings:40000},
    expect:{kind:'move',bestAge:35,check:e=>{const i=e.best.res.info;
      if(i.stamp!==5000)return 'first-time buyer stamp duty on £400k should be £5,000, got '+i.stamp;
      if(!(i.ltv>90&&i.ltv<=95))return 'LTV should be just over 90%, got '+i.ltv.toFixed(1);}}
  },
  {
    name:'Young first-time buyer in the North East',
    why:'24, renting at £750, £150k terrace. Should be able to buy within a couple of years, with no stamp duty.',
    inputs:{age:24,ftb:'Yes',rent:750,save:400,savings:5000,income:38000,newRegion:'North East',newType:'Terraced',target:150000},
    expect:{kind:'move',bestAgeIn:[24,28],reasons:[/Deposit under 5%/],check:e=>{if(e.best.res.info.stamp!==0)return 'no stamp duty expected under £300k for a first-time buyer';}}
  },
  {
    name:'London flat to London semi, long-run growth',
    why:'Big step up (£450k to £750k) on £140k income. Every year should pass the checks.',
    inputs:{curRegion:'London',curType:'Flat or maisonette',curValue:450000,owed:250000,newRegion:'London',newType:'Semi-detached',target:750000,income:140000},
    expect:{kind:'move',minOk:30,noReasons:[/Deposit|lenders|cash|pot/]}
  },
  {
    name:'London flat to London semi, last-12-months growth',
    why:'Projects last year forward for decades: London flats −7.9% a year, semis −1.7%. The flat collapses in value, so swapping it for the semi still wins, but later and by far less than on long-run growth.',
    inputs:{curRegion:'London',curType:'Flat or maisonette',curValue:450000,owed:250000,newRegion:'London',newType:'Semi-detached',target:750000,income:140000,basis:'1'},
    expect:{kind:'move',check:e=>{if(e.best.age<45)return 'expected a much later move than on long-run growth, got '+e.best.age;}}
  },
  {
    name:'Downsizing at 62 with no mortgage',
    why:'£600k home, £350k target, likes the new place less (−10%). No loan is needed in any year.',
    inputs:{age:62,curValue:600000,owed:0,curYears:0,newType:'Terraced',target:350000,prefer:-10,save:500,savings:50000,income:30000},
    expect:{kind:'stay',check:e=>{const l=e.ok.find(r=>r.res.info.loan>0);if(l)return 'a downsizer shouldn\'t need a loan, but does at '+l.age;}}
  },
  {
    name:'Cash buyer aged 67, past the mortgage age limit',
    why:'Buying outright, so the "mortgage must end by 70" rule shouldn\'t stop the move.',
    inputs:{age:67,curValue:500000,owed:0,curYears:0,target:300000,prefer:20,save:300,income:20000},
    expect:{minOk:10,noReasons:[/maximum mortgage age/],check:e=>{if(e.kind==='none')return 'a cash buyer should be able to move';}}
  },
  {
    name:'Negative equity',
    why:'Owes £230k on a £200k home. Can\'t move at first; equity rebuilds over time.',
    inputs:{curValue:200000,owed:230000},
    expect:{kind:'move',reasons:[/Not enough cash/],check:e=>{if(at(e,35).res.ok)return 'moving now with negative equity should fail';}}
  },
  {
    name:'Owner with no mortgage',
    why:'Pot is just the monthly saving, so the new payment is over the pot but still allowed.',
    inputs:{owed:0,curYears:0},
    expect:{kind:'move',check:e=>{const i=at(e,35).res.info;if(Math.abs(i.budget-600)>0.01)return 'pot should be £600, got '+i.budget;if(!(i.over>0))return 'payment should be over the pot';}}
  },
  {
    name:'First-time buyer in Scotland (LBTT)',
    why:'£240k with first-time buyer relief: 2% on £175k–£240k = £1,300.',
    inputs:{ftb:'Yes',income:80000,savings:40000,newRegion:'Scotland',target:240000},
    expect:{kind:'move',check:e=>{const s=at(e,35).res.info.stamp;if(Math.abs(s-1300)>0.01)return 'LBTT should be £1,300, got '+s;}}
  },
  {
    name:'First-time buyer in Wales (LTT)',
    why:'No first-time buyer relief in Wales: 6% on £225k–£240k = £900.',
    inputs:{ftb:'Yes',income:80000,savings:40000,newRegion:'Wales',target:240000},
    expect:{kind:'move',check:e=>{const s=at(e,35).res.info.stamp;if(Math.abs(s-900)>0.01)return 'LTT should be £900, got '+s;}}
  },
  {
    name:'First-time buyer over the £500k relief cap',
    why:'£520k in the South East: relief is lost entirely, so full stamp duty of £16,000 applies.',
    inputs:{ftb:'Yes',income:150000,savings:80000,target:520000,newRegion:'South East'},
    expect:{kind:'move',check:e=>{const s=at(e,35).res.info.stamp;if(Math.abs(s-16000)>0.01)return 'stamp duty should be £16,000, got '+s;}}
  },
  {
    name:'Mortgage offer at 3.99% fixed for 2 years',
    why:'A cheap offer should make moving now the best choice, using the offer rate.',
    inputs:{borrow:'offer',offer:340000,offerRate:3.99,offerFix:2},
    expect:{kind:'move',bestAge:35,check:e=>{const i=e.best.res.info;if(Math.abs(i.rate-0.0399)>1e-9||!i.fromOffer)return 'should use the offer rate';}}
  },
  {
    name:'Mortgage offer too small',
    why:'A £250k offer can\'t fund the purchase in the early years.',
    inputs:{borrow:'offer',offer:250000},
    expect:{reasons:[/your mortgage offer allows/],noReasons:[/× income/]}
  },
  {
    name:'Early repayment charge of 3%, fix ends in 2 years',
    why:'The charge applies only to moves before the fix ends, and should push the best age to when it ends.',
    inputs:{income:90000,fixLeft:2,erc:3},
    expect:{kind:'move',bestAge:37,check:e=>{
      if(!(at(e,35).res.info.erc>0))return 'moving now should carry a charge';
      if(at(e,37).res.info.erc!==0)return 'no charge once the fix has ended';}}
  },
  {
    name:'Strict: payment must fit within the pot',
    why:'With "Rule it out", no possible year may have a payment above the pot.',
    inputs:{income:90000,over:'rule'},
    expect:{reasons:[/over your £[\d,]+\/mo pot/],check:e=>{const b=e.ok.find(r=>r.res.info.over>0);if(b)return 'payment over pot allowed at '+b.age;}}
  },
  {
    name:'Loves the new home (200%)',
    why:'A strong preference should mean moving at the earliest possible year.',
    inputs:{income:90000,prefer:200},
    expect:{kind:'move',check:e=>{if(e.best.age!==e.first.age)return 'best should be the earliest possible year ('+e.first.age+'), got '+e.best.age;}}
  },
  {
    name:'Dislikes the new home (−50%)',
    why:'A strong negative preference should favour staying put.',
    inputs:{prefer:-50},
    expect:{kind:'stay'}
  },
  {
    name:'All mortgage rates at 0%',
    why:'Edge case: no interest. Nothing should break and payments are just loan ÷ months.',
    inputs:{r60:0,r75:0,r80:0,r85:0,r90:0,r95:0},
    expect:{kind:'move',check:e=>{const i=e.best.res.info,t=Math.min(30*12,Math.round((70-i.age)*12));if(Math.abs(i.pay-i.loan/t)>0.01)return 'payment should be loan ÷ months';}}
  },
  {
    name:'Owes money with no years left on the mortgage',
    why:'Inconsistent inputs: should ask the person to check them, not invent a huge monthly payment.',
    inputs:{curYears:0},
    expect:{kind:'invalid'}
  },
  {
    name:'Every field blank',
    why:'Should ask for numbers, not crash or show nonsense.',
    inputs:Object.fromEntries(['age','income','curValue','owed','target','rent','savings','save','prefer','term','maxAge','curYears'].map(k=>[k,''])),
    expect:{kind:'invalid'}
  },
];
