window.scoreAll=function(rows,names){
  const by={},out=[];
  rows.forEach(r=>(by[r.symbol]=by[r.symbol]||[]).push(r));
  names.forEach(s=>{
    const a=by[s.symbol];
    if(!a||a.length<60)return;
    const c=a.map(r=>+r.close),h=a.map(r=>+r.high),l=a.map(r=>+r.low),v=a.map(r=>+r.volume||0);
    const n=c.length,last=c[n-1];
    const avgV=v.slice(-21,-1).reduce((x,y)=>x+y,0)/20;
    if(avgV*last<500000)return;
    const a20=sma(c,20)[n-1],a50=sma(c,50)[n-1],r=rsi(c),m=macd(c);
    const hi20=Math.max(...h.slice(-21,-1));
    let sc=0;const why=[];
    if(last>a20&&a20>a50){sc+=2;why.push('اتجاه صاعد');}
    else if(last<a20&&a20<a50){sc-=2;why.push('اتجاه هابط');}
    if(r>=45&&r<=65){sc+=1;why.push('RSI صحي '+fmt(r,0));}
    else if(r>75){sc-=2;why.push('تشبع شرائي '+fmt(r,0));}
    else if(r<30)why.push('تشبع بيعي '+fmt(r,0));
    if(m.h>0&&m.h>m.hp){sc+=1;why.push('MACD إيجابي ويتقوى');}
    if(last>hi20){sc+=1;why.push('اختراق أعلى 20 يوم');}
    if(v[n-1]>1.5*avgV){sc+=1;why.push('حجم تداول مرتفع');}
    out.push({s,last,sc,why,date:a[n-1].trade_date,
      chg:(last-c[n-2])/c[n-2]*100,
      sup:Math.min(...l.slice(-20)),res:Math.max(...h.slice(-20))});
  });
  return out.sort((x,y)=>y.sc-x.sc);
};
