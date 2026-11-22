(function(){
const prev=window.showIpo;
window.showIpo=async function(){
  await prev();
  let nb=document.getElementById('newsBox');
  if(!nb){nb=document.createElement('div');nb.id='newsBox';document.getElementById('ipoPanel').firstChild.append(nb);}
  nb.innerHTML='<h3>📰 آخر الأخبار (تتحدث تلقائياً)</h3>';
  const {data,error}=await sb.from('market_news').select('title,link,source,topic,published_at')
    .order('published_at',{ascending:false}).limit(30);
  if(error){nb.append('تعذر تحميل الأخبار: '+error.message);return;}
  if(!data.length){nb.append('لا توجد أخبار بعد.');return;}
  data.forEach(n=>{
    if(!/^https?:/.test(n.link))return;
    const d=document.createElement('div');d.style.cssText='padding:10px 0;border-bottom:1px solid #e4eaf0';
    const a=document.createElement('a');a.href=n.link;a.target='_blank';a.rel='noopener noreferrer';a.textContent=n.title;
    const s=document.createElement('div');s.style.cssText='color:#718092;font-size:12px';
    s.textContent=[n.topic,n.source,(n.published_at||'').slice(0,10)].filter(Boolean).join(' • ');
    d.append(a,s);nb.append(d);
  });
};
})();
