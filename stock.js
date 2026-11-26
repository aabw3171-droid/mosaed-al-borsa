window.showStock=async function(symbol,name){
  panel('stockPanel');
  document.getElementById('stBoxT').textContent=symbol+(name?' — '+name:'');
  const box=document.getElementById('stBox');
  box.textContent='جاري التحميل...';
  const {data,error}=await sb.from('prices').select('trade_date,high,low,close')
    .eq('symbol',symbol).order('trade_date',{ascending:true}).limit(600);
  if(error){box.textContent='تعذر التحميل: '+error.message;return;}
  if(!data||data.length<30){box.textContent='البيانات غير كافية لهذا السهم.';return;}
  const n=data.length,dates=data.map(r=>r.trade_date);
  const close=data.map(r=>+r.close),hi=data.map(r=>+r.high),lo=data.map(r=>+r.low);
  const last=close[n-1],chg=(last-close[n-2])/close[n-2]*100;
  const s20=sma(close,20),s50=sma(close,50),a20=s20[n-1],a50=s50[n-1];
  const r=rsi(close),m=macd(close);
  let trend='عرضي / غير حاسم',tc='';
  if(a50!=null&&last>a20&&a20>a50){trend='اتجاه صاعد';tc='up';}
  else if(a50!=null&&last<a20&&a20<a50){trend='اتجاه هابط';tc='dn';}
  const rt=r==null?'-':r>=70?'تشبع شرائي':r<=30?'تشبع بيعي':'محايد';
  const mt=m.h>0?(m.h>m.hp?'إيجابي ويتقوى':'إيجابي ويضعف'):(m.h>m.hp?'سلبي ويتحسن':'سلبي ويضعف');
  const items=[['الاتجاه','<span class="'+tc+'">'+trend+'</span>'],
    ['RSI (14)',fmt(r,1)+' — '+rt],['MACD',fmt(m.m,3)+' — '+mt],
    ['متوسط 20 يوم',fmt(a20)],['متوسط 50 يوم',fmt(a50)],
    ['دعم (20 يوم)',fmt(Math.min(...lo.slice(-20)))],['مقاومة (20 يوم)',fmt(Math.max(...hi.slice(-20)))],
    ['دعم (60 يوم)',fmt(Math.min(...lo.slice(-60)))],['مقاومة (60 يوم)',fmt(Math.max(...hi.slice(-60)))]];
  const k=Math.min(n,120);
  box.innerHTML='<p style="font-size:28px;margin:10px 0 0"><strong>'+fmt(last)+'</strong> <span class="'+cls(chg)
    +'" style="font-size:16px">'+(chg>0?'+':'')+fmt(chg)+'%</span></p><p style="color:#718092;font-size:13px">إغلاق '+dates[n-1]
    +'</p><div class="kv">'+items.map(x=>'<div><small>'+x[0]+'</small>'+x[1]+'</div>').join('')+'</div>'
    +chartSVG(dates.slice(-k),close.slice(-k),s20.slice(-k),s50.slice(-k))
    +'<p style="font-size:12px;color:#718092">المصدر: EGX MCP عبر Supabase. التحليل محسوب آلياً من أسعار الإغلاق للاسترشاد فقط، وليس توصية بالشراء أو البيع.</p>';
};
