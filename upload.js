(function(){
if(typeof sb==='undefined')return;
const host=document.getElementById('adminView');
if(!host)return;
const G=id=>document.getElementById(id);
const N=s=>String(s==null?'':s).replace(/[\u064B-\u065F\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').trim().toLowerCase();
const AR='٠١٢٣٤٥٦٧٨٩';
const num=v=>{if(v==null||v==='')return null;if(typeof v==='number')return isFinite(v)?v:null;
  const s=String(v).replace(/[٠-٩]/g,d=>AR.indexOf(d)).replace(/[٬,\s%]/g,'').replace('٫','.');
  const n=parseFloat(s);return isFinite(n)?n:null;};
const K={date:['تاريخ','date'],symbol:['رمز','symbol','ticker','code','كود'],open:['فتح','افتتاح','open'],
  high:['اعلى','high'],low:['ادنى','low'],volume:['حجم','كمية','volume','vol'],
  close:['اغلاق','اقفال','close','اخر سعر','last'],name:['اسم','شركة','name','company','سهم']};
Object.keys(K).forEach(k=>K[k]=K[k].map(N));
function loadXLSX(){return window.XLSX?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=ok;
  s.onerror=()=>no(new Error('تعذر تحميل مكتبة Excel'));document.head.appendChild(s);});}
function toISO(v){
  if(v instanceof Date&&!isNaN(v)){const d=new Date(v.getTime()+12*3600e3);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  if(typeof v==='number'&&v>30000&&v<80000)return new Date(Math.round((v-25569)*86400000)).toISOString().slice(0,10);
  const s=String(v==null?'':v).trim();let m=s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if(m)return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
  m=s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if(m)return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  return null;}
function detect(rows){
  for(let i=0;i<Math.min(rows.length,20);i++){
    const h=(rows[i]||[]).map(N),map={},used=new Set();
    for(const f of ['date','symbol','open','high','low','volume','close','name']){
      const idx=h.findIndex((c,j)=>c&&!used.has(j)&&!/سابق|prev/.test(c)&&K[f].some(k=>c.includes(k)));
      if(idx>=0){map[f]=idx;used.add(idx);}
    }
    if(map.close!=null&&(map.symbol!=null||map.name!=null))return{row:i,map};
  }
  return null;}
const card=document.createElement('div');
card.style.cssText='margin-top:18px;padding-top:14px;border-top:1px solid #e4eaf0';
card.innerHTML='<h3>📥 تحميل بيانات اليوم</h3><p>اختر ملف الأسعار (Excel أو CSV) وراجع المعاينة قبل الحفظ.</p>'
 +'<label>تاريخ الجلسة (يُستخدم لو الملف مفيهوش عمود تاريخ)</label><input type="date" id="upDate">'
 +'<button type="button" id="upPick">تحميل بيانات اليوم</button>'
 +'<input type="file" id="upFile" accept=".xlsx,.xls,.csv" class="hidden"><div id="upOut" class="msg"></div>';
host.appendChild(card);
G('upDate').value=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'});
const out=G('upOut');let pending=null;
function say(t,type){out.textContent=t;out.className='msg '+(type||'ok');}
function el(tag,t,css){const e=document.createElement(tag);if(t!=null)e.textContent=t;if(css)e.style.cssText=css;return e;}
G('upPick').onclick=()=>G('upFile').click();
G('upFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)await handle(f);};
async function handle(f){
  try{
    pending=null;say('جاري قراءة الملف...','ok');
    await loadXLSX();
    const buf=await f.arrayBuffer();
    const wb=/\.csv$/i.test(f.name)?XLSX.read(new TextDecoder('utf-8').decode(buf),{type:'string',cellDates:true}):XLSX.read(buf,{type:'array',cellDates:true});
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:null});
    const d=detect(rows);
    if(!d)return say('معرفتش أعمدة الملف. لازم يكون فيه عمود إغلاق وعمود رمز أو اسم السهم. أول صف: '+((rows[0]||[]).join(' | ')),'err');
    const st=await sb.from('stocks').select('symbol,name').limit(1000);
    if(st.error)throw st.error;
    const bySym={},byName={};
    st.data.forEach(s=>{bySym[String(s.symbol).toUpperCase()]=s.symbol;if(s.name)byName[N(s.name)]=s.symbol;});
    const dflt=G('upDate').value,res=[],bad=[],seen=new Set();
    for(let i=d.row+1;i<rows.length;i++){
      const r=rows[i];if(!r)continue;
      const g=k=>d.map[k]==null?null:r[d.map[k]];
      const raw=g('symbol'),nm=g('name'),close=num(g('close'));
      if(raw==null&&nm==null&&close==null)continue;
      let sym=null;
      if(raw!=null)sym=bySym[String(raw).trim().toUpperCase().replace(/\.(CA|EGX)$/,'')]||null;
      if(!sym&&nm!=null)sym=byName[N(nm)]||null;
      if(!sym||!(close>0)){bad.push(String(raw!=null?raw:(nm!=null?nm:'؟')));continue;}
      const date=toISO(g('date'))||dflt;
      if(!date)return say('اختار تاريخ الجلسة الأول.','err');
      const key=sym+'|'+date;if(seen.has(key))continue;seen.add(key);
      res.push({symbol:sym,trade_date:date,open:num(g('open'))??close,high:num(g('high'))??close,low:num(g('low'))??close,close:close,volume:num(g('volume'))});
    }
    if(!res.length)return say('مفيش صفوف صالحة. غير المطابق: '+bad.slice(0,10).join('، '),'err');
    const dates=[...new Set(res.map(x=>x.trade_date))].sort(),last=dates[dates.length-1];
    const warn=[];
    const wd=new Date(last+'T00:00:00Z').getUTCDay();
    if(wd===5||wd===6)warn.push('تاريخ '+last+' يوم جمعة أو سبت، والبورصة مقفولة.');
    ['open','high','low','volume'].forEach(k=>{if(d.map[k]==null)warn.push('عمود '+k+' مش موجود في الملف'+(k!=='volume'?' واتساوى بالإغلاق.':'.'));});
    const pv=await sb.from('prices').select('trade_date').lt('trade_date',last).order('trade_date',{ascending:false}).limit(1);
    if(pv.data&&pv.data[0]){
      const p=await sb.from('prices').select('symbol,close').eq('trade_date',pv.data[0].trade_date).limit(1000);
      const pm={};(p.data||[]).forEach(x=>pm[x.symbol]=x.close);
      let cmp=0,big=0;
      res.filter(x=>x.trade_date===last).forEach(x=>{if(pm[x.symbol]>0){cmp++;if(Math.abs(x.close/pm[x.symbol]-1)>0.25)big++;}});
      if(cmp&&big/cmp>0.1)warn.push('أكتر من 10% من الأسهم تغيرت أكتر من 25% عن الجلسة السابقة. اتأكد إن عمود الإغلاق صح.');
    }
    pending=res;
    out.className='msg ok';out.textContent='';
    out.appendChild(el('div','قراءة الملف: '+res.length+' سهم | التاريخ: '+dates.join('، '),'font-weight:bold'));
    if(bad.length)out.appendChild(el('div','غير مطابق لقائمة الأسهم ('+bad.length+'): '+bad.slice(0,15).join('، '),'margin-top:6px'));
    warn.forEach(w=>out.appendChild(el('div','⚠️ '+w,'margin-top:6px;color:#a33')));
    const t=el('table',null,'width:100%;margin-top:8px;font-size:13px;border-collapse:collapse');
    const hr=el('tr');['السهم','فتح','أعلى','أدنى','إغلاق','حجم'].forEach(x=>hr.appendChild(el('th',x)));t.appendChild(hr);
    res.slice(0,5).forEach(x=>{const tr=el('tr');[x.symbol,x.open,x.high,x.low,x.close,x.volume==null?'-':x.volume].forEach(v=>tr.appendChild(el('td',v)));t.appendChild(tr);});
    out.appendChild(t);
    const b=el('button','تأكيد الحفظ ('+res.length+' سهم)','margin-top:10px');b.type='button';b.onclick=()=>save(b);out.appendChild(b);
  }catch(err){say('خطأ: '+(err.message||err),'err');}
}
async function save(b){
  if(!pending)return;b.disabled=true;let n=0;
  for(let i=0;i<pending.length;i+=200){
    const part=pending.slice(i,i+200);
    const r=await sb.from('prices').upsert(part,{onConflict:'symbol,trade_date'});
    if(r.error){say('فشل الحفظ بعد '+n+' صف: '+r.error.message,'err');return;}
    n+=part.length;
  }
  pending=null;say('تم حفظ '+n+' صف. افتح لوحة السوق وحدّث الصفحة.','ok');
}
})();
