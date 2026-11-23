(function(){
const av=document.getElementById('approvedView');
const d=document.createElement('div');d.id='recoPanel';d.className='hidden';
d.innerHTML='<section class="card"><div class="row"><h2 style="margin:0">🎯 التوصيات اليومية</h2><button class="sec" onclick="showHome()">رجوع</button></div><div id="recoBox"></div></section>';
av.append(d);
const old=window.panel;
window.panel=function(n){old(n);d.classList.toggle('hidden',n!=='recoPanel');};
const card=document.querySelectorAll('#homeGrid .grid .card')[2];
if(card){card.classList.add('click');card.onclick=()=>showReco();}
})();
function recoCard(x){
  const e=document.createElement('div');e.className='row'is_active',true)'row';e.style.cursor='pointer';
  e.innerHTML='<div style="flex:1;min-width:200px"><strong></strong> <small></small><br><span></span><br><small style="color:#718092"></small></div><div></div>';
  e.children[0].children[0].textContent=x.s.symbol;
  e.children[0].children[1].textContent=x.s.name||'';
  e.children[0].children[3].textContent=x.why.join(' • ');
  e.children[0].children[5].textContent='دعم '+fmt(x.sup)+' | مقاومة '+fmt(x.res);
  e.children[1].innerHTML='<strong>'+fmt(x.last)+'</strong><br><span class="'+cls(x.chg)+'">'+(x.chg>0?'+':'')+fmt(x.chg)+'%</span><br><small>نقاط: '+x.sc+'</small>';
  e.onclick=()=>showStock(x.s.symbol,x.s.name);
  return e;
}
window.showReco=async function(){
  panel('recoPanel');
  const box=document.getElementById('recoBox');box.textContent='جاري التحليل...';
  const since=new Date(Date.now()-150*86400000).toISOString().slice(0,10);
  const st=await sb.from('stocks').select('symbol,name').limit(1000);
  const pages=[...Array(20).keys()].map(i=>sb.from('prices').select('symbol,trade_date,high,low,close,volume')
    .gte('trade_date',since).order('symbol').order('trade_date').range(i*1000,i*1000+999));
  const res=await Promise.all(pages);
  const bad=[st,...res].find(r=>r.error);
  if(bad){box.textContent='تعذر التحميل: '+bad.error.message;return;}
  const all=scoreAll([].concat(...res.map(r=>r.data)),st.data);
  const top=all.filter(x=>x.sc>=3&&!x.why.some(w=>w.startsWith('تشبع شرائي'))).slice(0,10),low=all.filter(x=>x.sc<=-2).reverse().slice(0,5);
  box.innerHTML='<p style="color:#718092;font-size:13px">بيانات إغلاق '+(all[0]?all[0].date:'')+' — أسهم سيولتها كافية فقط</p><h3>فرص للمتابعة</h3>';
  if(!top.length)box.append('لا توجد فرص قوية حالياً.');
  top.forEach(x=>box.append(recoCard(x)));
  box.insertAdjacentHTML('beforeend','<h3>أسهم ضعيفة / تحذير</h3>');
  if(!low.length)box.append('لا يوجد.');
  low.forEach(x=>box.append(recoCard(x)));
  box.insertAdjacentHTML('beforeend','<p style="font-size:12px;color:#718092">التقييم آلي من مؤشرات فنية (اتجاه، RSI، MACD، اختراق، حجم) للاسترشاد فقط وليس توصية بالشراء أو البيع. الدعم والمقاومة مرجعان للمتابعة، وقرار التداول مسؤوليتك.</p>');
};
