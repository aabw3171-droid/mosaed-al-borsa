
window.showMarket=async function(){
  panel('marketPanel');

  const box=document.getElementById('marketBox');
  box.textContent='جاري تحميل بيانات السوق...';

  const since=new Date(Date.now()-30*86400000)
    .toISOString().slice(0,10);

  const st=await sb.from('stocks')
    .select('symbol,name')
    .eq('is_active', true)
    .order('symbol')
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

    (pr.data||[]).forEach(r=>{
      (by[r.symbol]=by[r.symbol]||[]).push(r);
    });

    if(!pr.data || pr.data.length<1000)break;
  }

  let last='';
  Object.values(by).forEach(a=>{
    a.forEach(r=>{
      if(r.trade_date>last)last=r.trade_date;
    });
  });

  const allRows=st.data.map(s=>{
    const a=by[s.symbol]||[];
    const l=a.length?a[a.length-1]:null;
    const p=a.length>1?a[a.length-2]:null;

    return {
      ...s,
      close:l && l.close!=null ? l.close : null,
      priceDate:l ? l.trade_date : '',
      vol:l ? l.volume : null,
      chg:(l && p && p.close)
        ? (l.close-p.close)/p.close*100
        : null,
      hasLatestSession:!!(l && last && l.trade_date===last && l.close!=null)
    };
  });

  const rows=allRows.slice().sort((x,y)=>{
    const xv=(x.vol||0)*(x.close||0);
    const yv=(y.vol||0)*(y.close||0);
    return yv-xv;
  });

  const updated=rows.filter(r=>r.hasLatestSession).length;
  const missing=st.data.length-updated;
  const priced=rows.filter(r=>r.close!=null);
  const adv=priced.filter(r=>r.chg>0).length;
  const dec=priced.filter(r=>r.chg<0).length;
  const unchanged=priced.filter(r=>r.chg===0).length;

  box.innerHTML='';

  const info=document.createElement('p');
  info.textContent=
    (last?'تاريخ أحدث جلسة مسجلة: '+last:'لا توجد بيانات أسعار مسجلة')+
    ' | صاعد: '+adv+
    ' | هابط: '+dec+
    ' | دون تغيير: '+unchanged+
    ' | الأسهم التي لها سعر في أحدث جلسة: '+updated+
    ' | لم تتوفر لها بيانات في هذه الجلسة: '+missing+
    ' | إجمالي الأسهم النشطة: '+st.data.length;

  const q=document.createElement('input');
  q.placeholder='بحث بالرمز أو الاسم';

  const t=document.createElement('table');
  t.innerHTML=
    '<tr><th>السهم</th><th>الإغلاق</th><th>تاريخ السعر</th><th>التغير</th><th>الحجم</th></tr>';

  rows.forEach(r=>{
    const tr=document.createElement('tr');
    tr.className='stk';

    const c=r.chg==null
      ? '-'
      : (r.chg>0?'+':'')+fmt(r.chg)+'%';

    tr.innerHTML=
      '<td><strong></strong><br><small></small></td>'+
      '<td></td><td></td><td></td><td></td>';

    tr.children[0].children[0].textContent=r.symbol;
    tr.children[0].children[2].textContent=r.name||'';
    tr.children[1].textContent=r.close==null?'-':fmt(r.close);
    tr.children[2].textContent=r.priceDate
      ? r.priceDate+(r.priceDate===last?'':' (آخر سعر متاح)')
      : 'لا يوجد سعر';
    tr.children[3].textContent=c;
    tr.children[3].className=cls(r.chg);
    tr.children[4].textContent=r.vol?fmt(r.vol,0):'-';

    if(!r.hasLatestSession)tr.style.opacity='0.72';

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
