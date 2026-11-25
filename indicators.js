
/* أدوات التحليل الفني */
window.sma=(a,n)=>a.map((_,i)=>
  i<n-1?null:
  a.slice(i-n+1,i+1).reduce((x,y)=>x+y,0)/n
);

window.ema=(a,n)=>{
  const k=2/(n+1),o=[];
  a.forEach((v,i)=>o.push(i?v*k+o[i-1]*(1-k):v));
  return o;
};

window.rsi=(c,n=14)=>{
  if(c.length<=n)return null;
  let g=0,l=0;

  for(let i=1;i<=n;i++){
    const d=c[i]-c[i-1];
    if(d>=0)g+=d;
    else l-=d;
  }

  g/=n;
  l/=n;

  for(let i=n+1;i<c.length;i++){
    const d=c[i]-c[i-1];
    g=(g*(n-1)+(d>0?d:0))/n;
    l=(l*(n-1)+(d<0?-d:0))/n;
  }

  return l===0?100:100-100/(1+g/l);
};

window.macd=c=>{
  if(c.length<27)return null;

  const a=ema(c,12);
  const b=ema(c,26);
  const m=c.map((_,i)=>a[i]-b[i]);
  const s=ema(m,9);
  const i=c.length-1;

  return {
    m:m[i],
    h:m[i]-s[i],
    hp:i>0?m[i-1]-s[i-1]:null
  };
};

/* الرسم البياني */
window.chartSVG=(dates,close,s20,s50)=>{
  if(!close||close.length<2)return '<p>لا توجد بيانات كافية للرسم</p>';

  const W=600,H=220,P=12;
  const all=close.concat(
    s20.filter(x=>x!=null),
    s50.filter(x=>x!=null)
  );

  const mn=Math.min(...all);
  const mx=Math.max(...all);

  const X=i=>P+i*(W-2*P)/(close.length-1);
  const Y=v=>H-P-(v-mn)/(mx-mn||1)*(H-2*P);

  const path=a=>{
    let s='',on=false;
    a.forEach((v,i)=>{
      if(v==null)return;
      s+=(on?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)+' ';
      on=true;
    });
    return s;
  };

  const line=(a,c,w)=>
    '<path d="'+path(a)+'" fill="none" stroke="'+c+
    '" stroke-width="'+w+'"/>';

  return '<svg viewBox="0 0 '+W+' '+H+
    '" style="width:100%;background:#f8fafc;border-radius:10px">'+
    line(close,'#10243a',2)+
    line(s20,'#e08a00',1.5)+
    line(s50,'#3b6fd4',1.5)+
    '</svg>'+
    '<p style="font-size:12px;color:#718092">السعر: أسود | متوسط 20: برتقالي | متوسط 50: أزرق ('+
    dates[0]+' إلى '+dates[dates.length-1]+')</p>';
};

/* قائمة المؤشرات */
window.EGX_INDICES=[
  {symbol:'EGX30',name:'EGX30',title:'مؤشر EGX30'},
  {symbol:'SHARIAH33',name:'EGX33 الشرعي',title:'مؤشر الشريعة الإسلامية'},
  {symbol:'EGX70',name:'EGX70',title:'مؤشر EGX70'},
  {symbol:'EGX100',name:'EGX100',title:'مؤشر EGX100'}
];

/* فتح صفحة المؤشرات */
window.showIndicators=async function(){
  panel('indicatorsPanel');

  const box=document.getElementById('indicatorsBox');
  box.innerHTML='';

  const title=document.createElement('h3');
  title.textContent='اختر المؤشر المطلوب';
  box.append(title);

  const list=document.createElement('div');
  list.style.cssText=
    'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px';

  EGX_INDICES.forEach(index=>{
    const b=document.createElement('button');
    b.className='sec';
    b.style.cssText='padding:18px;min-height:75px';
    b.textContent=index.title;
    b.onclick=()=>showIndexDetails(index.symbol);
    list.append(b);
  });

  box.append(list);

  const details=document.createElement('div');
  details.id='indexDetails';
  details.style.marginTop='18px';
  box.append(details);
};

/* تحليل مؤشر منفصل */
window.showIndexDetails=async function(symbol){
  const box=document.getElementById('indexDetails');
  if(!box)return;

  const index=EGX_INDICES.find(x=>x.symbol===symbol);

  if(!index){
    box.textContent='المؤشر غير معروف';
    return;
  }

  box.innerHTML='<p>جاري تحميل بيانات '+index.title+'...</p>';

  const result=await sb.from('prices')
    .select('trade_date,open,high,low,close,volume')
    .eq('symbol',symbol)
    .order('trade_date',{ascending:true})
    .limit(120);

  if(result.error){
    box.textContent='تعذر تحميل البيانات: '+result.error.message;
    return;
  }

  const data=result.data||[];

  if(data.length===0){
    box.innerHTML=
      '<h3>'+index.title+'</h3>'+
      '<p>لا توجد بيانات مسجلة لهذا المؤشر في قاعدة البيانات.</p>';
    return;
  }

  const valid=data.filter(x=>
    x.close!=null&&Number(x.close)>0
  );

  if(valid.length===0){
    box.innerHTML=
      '<h3>'+index.title+'</h3>'+
      '<p>لا توجد أسعار إغلاق صالحة لهذا المؤشر.</p>';
    return;
  }

  const last=valid[valid.length-1];
  const prev=valid.length>1?valid[valid.length-2]:null;

  const close=Number(last.close);
  const previous=prev?Number(prev.close):null;

  const change=previous&&previous>0
    ?(close-previous)/previous*100
    :null;

  const closes=valid.map(x=>Number(x.close));
  const dates=valid.map(x=>x.trade_date);

  const s20=sma(closes,20);
  const s50=sma(closes,50);
  const rv=rsi(closes);
  const mc=macd(closes);

  const support=Math.min(...valid.slice(-20).map(x=>Number(x.low??x.close)));
  const resistance=Math.max(...valid.slice(-20).map(x=>Number(x.high??x.close)));

  let trend='بيانات غير كافية لتحديد الاتجاه';
  if(closes.length>=50){
    const ma20=s20[s20.length-1];
    const ma50=s50[s50.length-1];

    if(close>ma20&&ma20>ma50)trend='اتجاه صاعد';
    else if(close<ma20&&ma20<ma50)trend='اتجاه هابط';
    else trend='اتجاه عرضي أو مختلط';
  }else if(closes.length>=20){
    trend=close>s20[s20.length-1]
      ?'السعر أعلى متوسط 20 جلسة'
      :'السعر أسفل متوسط 20 جلسة';
  }

  let rsiText='غير متاح';
  if(rv!=null){
    rsiText=rv>=70?'تشبع شرائي':
      rv<=30?'تشبع بيعي':'منطقة محايدة';
  }

  let recommendation='لا توجد توصية؛ البيانات غير كافية';
  let confidence='غير متاحة';
  let risk='مرتفع بسبب نقص البيانات';

  if(closes.length>=50&&rv!=null&&mc){
    if(close>s20[s20.length-1]&&
       s20[s20.length-1]>s50[s50.length-1]&&
       mc.h>0&&rv<70){
      recommendation='إشارة إيجابية مبدئية';
      confidence='متوسطة';
      risk='متوسط؛ يلزم تأكيد الاتجاه';
    }else if(close<s20[s20.length-1]&&
       s20[s20.length-1]<s50[s50.length-1]&&
       mc.h<0){
      recommendation='إشارة سلبية';
      confidence='متوسطة';
      risk='مرتفع';
    }else{
      recommendation='انتظار تأكيد الاتجاه';
      confidence='منخفضة';
      risk='متوسط إلى مرتفع';
    }
  }

  box.innerHTML='';

  const h=document.createElement('h3');
  h.textContent=index.title;
  box.append(h);

  const info=document.createElement('div');
  info.className='kv';

  const items=[
    ['آخر إغلاق',fmt(close)],
    ['تاريخ السعر',last.trade_date],
    ['التغير',change==null?'-':(change>0?'+':'')+fmt(change)+'%'],
    ['عدد الجلسات',valid.length],
    ['الاتجاه',trend],
    ['RSI 14',rv==null?'-':fmt(rv)],
    ['حالة RSI',rsiText],
    ['MACD Histogram',mc?fmt(mc.h):'-'],
    ['الدعم التقريبي',fmt(support)],
    ['المقاومة التقريبية',fmt(resistance)]
  ];

  items.forEach(([k,v])=>{
    const d=document.createElement('div');
    const small=document.createElement('small');
    small.textContent=k;
    const strong=document.createElement('strong');
    strong.textContent=v;
    d.append(small,strong);
    info.append(d);
  });

  box.append(info);

  const chart=document.createElement('div');
  chart.innerHTML=chartSVG(dates,closes,s20,s50);
  box.append(chart);

  const rec=document.createElement('div');
  rec.style.cssText=
    'padding:14px;margin-top:14px;border-radius:10px;background:#f2f5f8;line-height:2';

  rec.innerHTML='<h3>التحليل والتوصية</h3>';

  [
    ['التقييم',recommendation],
    ['درجة الثقة',confidence],
    ['مستوى المخاطر',risk]
  ].forEach(([k,v])=>{
    const p=document.createElement('p');
    p.textContent=k+': '+v;
    rec.append(p);
  });

  const note=document.createElement('p');
  note.style.fontSize='12px';
  note.textContent=
    'الدعم والمقاومة محسوبان من أعلى وأدنى الأسعار المسجلة لآخر 20 جلسة، وليسا ضمانًا لمستويات التداول القادمة. التحليل آلي ولا يمثل توصية استثمارية مؤكدة.';
  rec.append(note);

  box.append(rec);
};
