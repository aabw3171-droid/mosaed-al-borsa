
(function(){
  const previousShowIpo = window.showIpo;

  window.showIpo = async function(){
    await previousShowIpo();

    let box = document.getElementById('newsBox');

    if(!box){
      box = document.createElement('div');
      box.id = 'newsBox';
      document.querySelector('#ipoPanel section.card').append(box);
    }

    box.innerHTML = '<h3>📰 آخر الأخبار</h3>';

    const {data,error} = await sb.from('market_news')
      .select('title,link,source,topic,published_at')
      .order('published_at',{ascending:false})
      .limit(30);

    if(error){
      box.textContent = 'تعذر تحميل الأخبار: ' + error.message;
      return;
    }

    if(!data || !data.length){
      box.append('لا توجد أخبار بعد.');
      return;
    }

    data.forEach(item=>{
      if(!item.link || !/^https?:/.test(item.link)) return;

      const row = document.createElement('div');
      row.style.cssText = 'padding:10px 0;border-bottom:1px solid #e4eaf0';

      const link = document.createElement('a');
      link.href = item.link;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = item.title || 'خبر';

      const meta = document.createElement('div');
      meta.style.cssText = 'color:#718092;font-size:12px';
      meta.textContent = [
        item.topic,
        item.source,
        (item.published_at || '').slice(0,10)
      ].filter(Boolean).join(' • ');

      row.append(link,meta);
      box.append(row);
    });
  };
})();
