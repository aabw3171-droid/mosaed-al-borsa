
window.showMarket=async function(){
  panel('marketPanel');

  const box=document.getElementById('marketBox');
  box.textContent='جاري تحميل بيانات السوق...';

  const since=new Date(Date.now()-12*86400000)
    .toISOString().slice(0,10);

  const st=await sb.from('stocks')
    .select('symbol,name')
    .limit(1000);

  if(st.error){
    box.textContent='تعذر تحميل الأسهم: '+st.error.message;
    return;
  }

  const by={};

  for(let f=0;;f+=1000){
    const pr=await sb.from('prices')
      .select('symbol,trade_date,close,volume')
      .gte('trade_date',since)
      .order('trade_date',{ascending:true})
      .order('symbol')
      .range(f,f+999);

    if(pr.error){
      box.textContent='تعذر تحميل الأسعار: '+pr.error.message;
      return;
    }

    pr.data.forEach(r=>{
      (by[r.symbol]=by[r.symbol]||[]).push(r);
    });

    if(pr.data.length<1000)break;
  }

  let last='';

  Object.values(by).forEach(a=>{
    a.forEach(r=>{
      if(r.trade_date>last)last=r.trade_date;
    });
  });

  if(!last){
    box.textContent='لا توجد بيانات أسعار خلال آخر 12 يومًا';
    return;
  }

  const rows=st.data.map(s=>{
    const a=by[s.symbol]||[];
    const l=a[a.length-1];
    const p=a.length>1?a[a.length-2]:null;

    if(!l || l.trade_date!==last || l.close==null){
      return null;
    }

    return {
      ...s,
      close:l.close,
      vol:l.volume,
      chg:(p && p.close)
        ? (l.close-p.close)/p.close*100
        : null
    };
  })
  .filter(Boolean)
  .sort((x,y)=>
    (y.vol||0)*y.close-(x.vol||0)*x.close
  );

  const missing=st.data.length-rows.length;
  const adv=rows.filter(r=>r.chg>0).length;
  const dec=rows.filter(r=>r.chg<0).length;
  const unchanged=rows.filter(r=>r.chg===0).length;

  box.innerHTML='';

  const info=document.createElement('p');
  info.textContent=
    'تاريخ الجلسة: '+last+
    ' | صاعد: '+adv+
    ' | هابط: '+dec+
    ' | دون تغيير: '+unchanged+
    ' | الأسهم المحدثة: '+rows.length+
    ' | لم تتوفر لها بيانات في هذه الجلسة: '+missing;

  const q=document.createElement('input');
  q.placeholder='بحث بالرمز أو الاسم';

  const t=document.createElement('table');
  t.innerHTML=
    '<tr><th>السهم</th><th>الإغلاق</th><th>التغير</th><th>الحجم</th></tr>';

  rows.forEach(r=>{
    const tr=document.createElement('tr');
    tr.className='stk';

    const c=r.chg==null
      ? '-'
      : (r.chg>0?'+':'')+fmt(r.chg)+'%';

    tr.innerHTML=
      '<td><strong></strong><br><small></small></td>'+
      '<td></td><td></td><td></td>';

    tr.children[0].children[0].textContent=r.symbol;
    tr.children[0].children[2].textContent=r.name||'';
    tr.children[1].textContent=fmt(r.close);
    tr.children[2].textContent=c;
    tr.children[2].className=cls(r.chg);
    tr.children[3].textContent=r.vol?fmt(r.vol,0):'-';

    tr.onclick=()=>showStock(r.symbol,r.name);
    t.append(tr);
  });

  q.oninput=()=>{
    const v=q.value.trim().toLowerCase();

    t.querySelectorAll('tr.stk').forEach(x=>{
      x.classList.toggle(
        'hidden',
        v && !x.textContent.toLowerCase().includes(v)
      );
    });
  };

  box.append(info,q,t);
};
