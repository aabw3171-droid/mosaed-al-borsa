window.sma=(a,n)=>a.map((_,i)=>i<n-1?null:a.slice(i-n+1,i+1).reduce((x,y)=>x+y,0)/n);
window.ema=(a,n)=>{const k=2/(n+1),o=[];a.forEach((v,i)=>o.push(i?v*k+o[i-1]*(1-k):v));return o;};
window.rsi=(c,n=14)=>{
  if(c.length<=n)return null;
  let g=0,l=0;
  for(let i=1;i<=n;i++){const d=c[i]-c[i-1];if(d>=0)g+=d;else l-=d;}
  g/=n;l/=n;
  for(let i=n+1;i<c.length;i++){
    const d=c[i]-c[i-1];
    g=(g*(n-1)+(d>0?d:0))/n;l=(l*(n-1)+(d<0?-d:0))/n;
  }
  return l===0?100:100-100/(1+g/l);
};
window.macd=c=>{
  const a=ema(c,12),b=ema(c,26),m=c.map((_,i)=>a[i]-b[i]),s=ema(m,9),i=c.length-1;
  return {m:m[i],h:m[i]-s[i],hp:m[i-1]-s[i-1]};
};
window.chartSVG=(dates,close,s20,s50)=>{
  const W=600,H=220,P=8;
  const all=close.concat(s20.filter(x=>x!=null),s50.filter(x=>x!=null));
  const mn=Math.min(...all),mx=Math.max(...all);
  const X=i=>P+i*(W-2*P)/(close.length-1),Y=v=>H-P-(v-mn)/(mx-mn||1)*(H-2*P);
  const path=a=>{let s='',on=false;
    a.forEach((v,i)=>{if(v==null)return;s+=(on?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)+' ';on=true;});
    return s;};
  const line=(a,c,w)=>'<path d="'+path(a)+'" fill="none" stroke="'+c+'" stroke-width="'+w+'"/>';
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;background:#f8fafc;border-radius:10px">'
    +line(close,'#10243a',2)+line(s20,'#e08a00',1.5)+line(s50,'#3b6fd4',1.5)+'</svg>'
    +'<p style="font-size:12px;color:#718092">أسود: السعر | برتقالي: متوسط 20 | أزرق: متوسط 50 ('
    +dates[0]+' إلى '+dates[dates.length-1]+')</p>';
};
