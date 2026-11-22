(function(){
const av=document.getElementById('approvedView');
const d=document.createElement('div');d.id='ipoPanel';d.className='hidden';
d.innerHTML='<section class="card"><div class="row"><h2 style="margin:0">📅 الاكتتابات وزيادات رأس المال</h2><button class="sec" onclick="showHome()">رجوع</button></div><div id="ipoBox"></div><div id="ipoAdmin"></div></section>';
av.append(d);
const old=window.panel;
window.panel=function(n){old(n);d.classList.toggle('hidden',n!=='ipoPanel');};
const card=document.querySelectorAll('#homeGrid .grid .card')[3];
if(card){card.classList.add('click');card.onclick=()=>showIpo();}
})();
window.showIpo=async function(){
  panel('ipoPanel');
  const box=document.getElementById('ipoBox');box.textContent='جاري التحميل...';
  const {data,error}=await sb.from('corporate_events').select('*');
  if(error){box.textContent='تعذر التحميل: '+error.message;return;}
  const today=new Date().toISOString().slice(0,10);
  const st=e=>e.end_date&&e.end_date<today?'منتهي':(e.start_date&&e.start_date>today?'قادم':'مفتوح الآن');
  const ord={'مفتوح الآن':0,'قادم':1,'منتهي':2};
  box.innerHTML='';
  if(!data.length)box.textContent='لا توجد بيانات حالياً.';
  data.sort((a,b)=>ord[st(a)]-ord[st(b)]||(a.start_date||'').localeCompare(b.start_date||'')).forEach(e=>{
    const r=document.createElement('div');r.className='row';r.dataset.id=e.id;
    r.innerHTML='<div style="flex:1;min-width:200px"><strong></strong> <small></small><br><span></span><br><small style="color:#718092"></small></div><div></div>';
    const c=r.children[0].children;
    c[0].textContent=e.company+(e.symbol?' ('+e.symbol+')':'');
    c[1].textContent=e.kind;
    c[3].textContent=e.details||'';
    c[5].textContent=(e.start_date?'من '+e.start_date:'')+(e.end_date?' إلى '+e.end_date:'')+(e.price?' | السعر '+fmt(e.price):'');
    const s=st(e);r.children[1].textContent=s;r.children[1].className=s==='مفتوح الآن'?'up':'';
    box.append(r);
  });
  if(window.ipoAdmin)ipoAdmin();
};
