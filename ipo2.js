إضافةضافةindow.ipoAdmin=async function(){
  const box=document.getElementById('ipoAdmin');box.innerHTML='';
  const {data:{session}}=await sb.auth.getSession();
  if(!session)return;
  const {data:p}=await sb.from('profiles').select('is_admin').eq('id',session.user.id).maybeSingle();
  if(!p||p.is_admin!==true)return;
  document.querySelectorAll('#ipoBox .row').forEach(r=>{
    const b=document.createElement('button');b.className='danger';b.textContent='حذف';
    b.onclick=async()=>{
      if(!confirm('حذف هذا البند؟'))return;
      await sb.from('corporate_events').delete().eq('id',r.dataset.id);
      showIpo();
    };
    r.append(b);
  });
  box.innerHTML='<h3>إضافة بند (للمدير فقط)</h3>'
    +'<select id="evK" style="width:100%;padding:13px;margin:7px 0"><option>اكتتاب</option><option>زيادة رأس مال</option><option>حقوق أولوية</option></select>'
    +'<input id="evC" placeholder="اسم الشركة"><input id="evS" placeholder="رمز السهم (اختياري)">'
    +'<input id="evD" placeholder="تفاصيل (نسبة، سعر الإصدار، شروط...)">'
    +'<input id="evP" type="number" step="any" placeholder="السعر (اختياري)">'
    +'<label>تاريخ البداية</label><input id="evA" type="date">'
    +'<label>تاريخ النهاية</label><input id="evE" type="date">'
    +'<button onclick="ipoAdd()">إضافة
</button>';
};
window.ipoAdd=async function(){
  const g=id=>document.getElementById(id).value.trim();
  if(!g('evC'))return alert('اكتب اسم الشركة');
  const {error}=await sb.from('corporate_events').insert({
    kind:g('evK'),company:g('evC'),symbol:g('evS')||null,details:g('evD')||null,
    price:g('evP')||null,start_date:g('evA')||null,end_date:g('evE')||null});
  if(error)return alert('تعذر الإضافة: '+error.message);
  showIpo();
};
