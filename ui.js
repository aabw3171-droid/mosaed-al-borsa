
(function () {
  const css = `
    .click{cursor:pointer;transition:.15s}
    .click:hover{border-color:#4dd6a3;transform:translateY(-2px)}
    table{width:100%;border-collapse:collapse;font-size:14px}
    th,td{padding:10px 6px;text-align:right;border-bottom:1px solid #e4eaf0}
    tr.stk{cursor:pointer}
    tr.stk:hover{background:#f2f5f8}
    .up{color:#167653;font-weight:bold}
    .dn{color:#c0392b;font-weight:bold}
    .kv{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:14px 0}
    .kv div{background:#f2f5f8;border-radius:10px;padding:12px}
    .kv small{color:#718092;display:block}
    .section-title{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);

  const av = document.getElementById('approvedView');
  if (!av) return;

  const home = document.createElement('div');
  home.id = 'homeGrid';

  while (av.firstChild) home.append(av.firstChild);
  av.append(home);

  function makePanel(id, title, bodyId) {
    if (document.getElementById(id)) return;
    const panel = document.createElement('div');
    panel.id = id;
    panel.className = 'hidden';
    panel.innerHTML = `
      <section class="card">
        <div class="section-title">
          <h2 id="${bodyId}T" style="margin:0">${title}</h2>
          <button class="sec" type="button" onclick="showHome()">رجوع للرئيسية</button>
        </div>
        <div id="${bodyId}"></div>
      </section>`;
    av.append(panel);
  }

  makePanel('marketPanel', '📊 السوق المصري', 'marketBox');
  makePanel('stockPanel', '📈 تحليل الأسهم', 'stBox');
  makePanel('indicatorsPanel', '📊 المؤشرات', 'indicatorsBox');
  makePanel('candidatesPanel', '🎯 مرشحات الجلسة القادمة', 'candidatesBox');

  window.fmt = function (n, d = 2) {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
    return Number(n).toLocaleString('en-US', {minimumFractionDigits:d,maximumFractionDigits:d});
  };

  window.cls = function (n) {
    return n > 0 ? 'up' : n < 0 ? 'dn' : '';
  };

  window.panel = function (name) {
    av.querySelectorAll(':scope > div').forEach(el => el.classList.toggle('hidden', el.id !== name));
    window.scrollTo({top:0,behavior:'smooth'});
  };

  window.showHome = function () { window.panel('homeGrid'); };

  window.showCandidates = async function () {
    window.panel('candidatesPanel');
    const box = document.getElementById('candidatesBox');
    box.textContent = 'جاري تحميل المرشحات من قاعدة البيانات...';

    try {
      const latest = await sb.from('prices')
        .select('trade_date')
        .order('trade_date', {ascending:false})
        .limit(1)
        .maybeSingle();

      if (latest.error) throw latest.error;

      const result = await sb.from('next_session_candidates')
        .select('symbol,name,trade_date,close,high,volume,avg_volume_20,volume_ratio,sma_50,above_sma50_pct,close_to_high_pct')
        .order('volume_ratio', {ascending:false})
        .limit(100);

      if (result.error) throw result.error;

      const rows = result.data || [];
      box.innerHTML = '';

      const info = document.createElement('div');
      info.style.cssText = 'padding:12px;margin:12px 0;background:#f2f5f8;border-radius:9px;line-height:1.9';
      info.textContent = 'آخر تاريخ أسعار مسجل: ' + (latest.data?.trade_date || 'غير متاح') +
        ' | عدد الأسهم المطابقة للشروط: ' + rows.length +
        ' | المصدر: EGX MCP عبر Supabase';
      box.append(info);

      const rules = document.createElement('div');
      rules.style.cssText = 'padding:12px;margin-bottom:14px;border:1px solid #e4eaf0;border-radius:9px;line-height:1.9';
      rules.textContent = 'شروط الترشيح: حجم آخر جلسة أكبر من ضعفي متوسط أحجام الجلسات العشرين السابقة، الإغلاق عند 98% على الأقل من أعلى سعر في الجلسة، والإغلاق أعلى من متوسط 50 جلسة.';
      box.append(rules);

      if (!rows.length) {
        const empty = document.createElement('p');
        empty.style.cssText = 'padding:16px;background:#fff8e8;border-radius:9px;line-height:1.9';
        empty.textContent = 'لا توجد أسهم استوفت الشروط الثلاثة في آخر جلسة متاحة. هذا لا يعني وجود خطأ؛ الفلاتر انتقائية وقد لا تنتج مرشحين كل يوم.';
        box.append(empty);
        return;
      }

      const table = document.createElement('table');
      const head = document.createElement('tr');
      ['السهم','الإغلاق','الحجم','متوسط 20','مضاعف الحجم','متوسط 50','فوق SMA50','قرب القمة'].forEach(label => {
        const th = document.createElement('th');
        th.textContent = label;
        head.append(th);
      });
      table.append(head);

      rows.forEach(r => {
        const tr = document.createElement('tr');
        const values = [
          (r.symbol || '') + (r.name ? ' - ' + r.name : ''),
          fmt(r.close),
          fmt(r.volume,0),
          fmt(r.avg_volume_20,0),
          fmt(r.volume_ratio) + 'x',
          fmt(r.sma_50),
          fmt(r.above_sma50_pct) + '%',
          fmt(r.close_to_high_pct) + '%'
        ];
        values.forEach(v => {
          const td = document.createElement('td');
          td.textContent = v;
          tr.append(td);
        });
        table.append(tr);
      });
      box.append(table);
    } catch (err) {
      console.error('Candidates loading error', err);
      box.textContent = 'تعذر تحميل المرشحات: ' + (err.message || 'تحقق من صلاحيات قراءة البيانات.');
    }
  };

  const grid = home.querySelector('.grid');
  if (grid) {
    const cards = Array.from(grid.querySelectorAll('.card'));

    if (cards[0]) {
      cards[0].classList.add('click');
      cards[0].onclick = () => { if (typeof window.showMarket === 'function') window.showMarket(); };
    }

    if (cards[1]) {
      cards[1].classList.add('click');
      cards[1].onclick = () => {
        window.panel('stockPanel');
        const box = document.getElementById('stBox');
        if (box) box.innerHTML = '<p>لفتح تحليل سهم محدد، انتقل إلى السوق واختر السهم من القائمة.</p><button type="button" onclick="showMarket()">اختيار سهم من السوق</button>';
      };
    }

    const indicatorCard = document.createElement('div');
    indicatorCard.className = 'card click';
    indicatorCard.innerHTML = '<h3>📊 المؤشرات</h3><p>متابعة EGX30 وEGX33 الشرعي وEGX70 وEGX100.</p><button type="button">عرض المؤشرات</button>';
    indicatorCard.onclick = () => { if (typeof window.showIndicators === 'function') window.showIndicators(); };
    grid.append(indicatorCard);

    const candidatesCard = document.createElement('div');
    candidatesCard.className = 'card click';
    candidatesCard.innerHTML = '<h3>🎯 مرشحات الجلسة القادمة</h3><p>أسهم ذات نشاط تداول مرتفع وإغلاق قوي، مع استبعاد الأسهم أسفل متوسط 50 جلسة.</p><button type="button">عرض المرشحات</button>';
    candidatesCard.onclick = () => window.showCandidates();
    grid.append(candidatesCard);
  }

  window.goToStock = function (symbol, name) {
    if (typeof window.showStock === 'function') window.showStock(symbol, name);
  };
})();
