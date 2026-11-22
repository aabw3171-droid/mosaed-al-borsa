(function(){
const css=`.click{cursor:pointer}.click:hover{border-color:#4dd6a3}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{padding:10px 6px;text-align:right;border-bottom:1px solid #e4eaf0}
tr.stk{cursor:pointer}tr.stk:hover{background:#f2f5f8}
.up{color:#167653;font-weight:bold}.dn{color:#c0392b;font-weight:bold}
.kv{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:14px 0}
.kv div{background:#f2f5f8;border-radius:10px;padding:12px}
.kv small{color:#718092;display:block}`;
const st=document.createElement('style');st.textContent=css;document.head.append(st);
const av=document.getElementById('approvedView');
const home=document.createElement('div');home.id='homeGrid';
while(av.firstChild)home.append(av.firstChild);
av.append(home);
function mk(id,title,back,body){
  const d=document.createElement('div');d.id=id;d.className='hidden';
  d.innerHTML='<section class="card"><div class="row"><h2 style="margin:0" id="'+body+'T">'+title+'</h2><button class="sec" onclick="'+back+'">رجوع</button></div><div id="'+body+'"></div></section>';
  av.append(d);
}
mk('marketPanel','📊 السوق المصري','showHome()','marketBox');
mk('stockPanel','','showMarket()','stBox');
home.querySelectorAll('.grid .card').forEach((c,i)=>{
  if(i<2){c.classList.add('click');c.onclick=()=>showMarket();}
});
})();
window.fmt=(n,d=2)=>(n==null||isNaN(n))?'-':Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
window.cls=n=>n>0?'up':(n<0?'dn':'');
window.panel=function(name){
  ['homeGrid','marketPanel','stockPanel'].forEach(id=>document.getElementById(id).classList.toggle('hidden',id!==name));
  window.scrollTo({top:0});
};
window.showHome=()=>panel('homeGrid');
