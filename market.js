
window.showMarket = async function () {
  panel('marketPanel');

  const box = document.getElementById('marketBox');
  box.textContent = 'جاري تحميل بيانات السوق...';

  // آخر 90 يومًا لتجنب فقد بيانات الأسهم قليلة التداول
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 90);

  const since = [
    sinceDate.getFullYear(),
    String(sinceDate.getMonth() + 1).padStart(2, '0'),
    String(sinceDate.getDate()).padStart(2, '0')
  ].join('-');

  const st = await sb.from('stocks')
    .select('symbol,name')
    .eq('is_active', true)
    .order('symbol')
    .limit(1000);

  if (st.error) {
    box.textContent = 'تعذر تحميل الأسهم: ' + st.error.message;
    return;
  }

  const by = {};

  for (let f = 0; ; f += 1000) {
    const pr = await sb.from('prices')
      .select('symbol,trade_date,close,volume')
      .gte('trade_date', since)
      .order('trade_date', { ascending: true })
      .order('symbol')
      .range(f, f + 999);

    if (pr.error) {
      box.textContent = 'تعذر تحميل الأسعار: ' + pr.error.message;
      return;
    }

    (pr.data || []).forEach(r => {
      (by[r.symbol] = by[r.symbol] || []).push(r);
    });

    if (!pr.data || pr.data.length < 1000) break;
  }

  // تحديد أحدث تاريخ مسجل في قاعدة البيانات
  let sessionDate = '';

  Object.values(by).forEach(a => {
    a.forEach(r => {
      if (r.trade_date && r.trade_date > sessionDate) {
        sessionDate = r.trade_date;
      }
    });
  });

  const allRows = st.data.map(s => {
    const a = (by[s.symbol] || []).slice()
      .sort((x, y) =>
        String(x.trade_date).localeCompare(String(y.trade_date))
      );

    const l = a.length ? a[a.length - 1] : null;
    const p = a.length > 1 ? a[a.length - 2] : null;

    const close = l && l.close != null
      ? Number(l.close)
      : null;

    const previousClose = p && p.close != null
      ? Number(p.close)
      : null;

    return {
      ...s,
      close,
      priceDate: l ? l.trade_date : '',
      vol: l && l.volume != null ? Number(l.volume) : null,

      chg: (
        close != null &&
        previousClose != null &&
        previousClose > 0
      )
        ? (close - previousClose) / previousClose * 100
        : null,

      hasLatestSession: !!(
        l &&
        sessionDate &&
        l.trade_date === sessionDate &&
        close != null
      )
    };
  });

  const rows = allRows.slice().sort((x, y) => {
    const xv = (x.vol || 0) * (x.close || 0);
    const yv = (y.vol || 0) * (y.close || 0);
    return yv - xv;
  });

  const updated = rows.filter(r => r.hasLatestSession).length;

  const oldPrices = rows.filter(r =>
    r.close != null && !r.hasLatestSession
  ).length;

  const noPrices = rows.filter(r =>
    r.close == null
  ).length;

  const priced = rows.filter(r => r.hasLatestSession);

  const adv = priced.filter(r => r.chg > 0).length;
  const dec = priced.filter(r => r.chg < 0).length;
  const unchanged = priced.filter(r => r.chg === 0).length;

  box.innerHTML = '';

  const info = document.createElement('div');

  info.style.cssText =
    'padding:12px;margin-bottom:12px;border-radius:8px;' +
    'background:rgba(100,130,160,.10);line-height:2';

  info.textContent =
    (sessionDate
      ? 'أحدث تاريخ بيانات مسجل: ' + sessionDate
      : 'لا توجد بيانات أسعار مسجلة') +
    ' | أسهم لها سعر في أحدث تاريخ: ' + updated +
    ' | أسعار من تواريخ أقدم: ' + oldPrices +
    ' | بلا سعر: ' + noPrices +
    ' | إجمالي الأسهم النشطة: ' + st.data.length +
    ' | صاعد: ' + adv +
    ' | هابط: ' + dec +
    ' | دون تغيير: ' + unchanged;

  const q = document.createElement('input');
  q.placeholder = 'بحث بالرمز أو الاسم';
  q.style.cssText = 'width:100%;margin:8px 0;padding:10px';

  const t = document.createElement('table');

  t.style.cssText =
    'width:100%;border-collapse:collapse;font-size:13px';

  t.innerHTML =
    '<tr>' +
    '<th>السهم</th>' +
    '<th>الإغلاق</th>' +
    '<th>تاريخ السعر</th>' +
    '<th>الحالة</th>' +
    '<th>التغير</th>' +
    '<th>الحجم</th>' +
    '</tr>';

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = 'stk';

    const c = r.chg == null
      ? '-'
      : (r.chg > 0 ? '+' : '') + fmt(r.chg) + '%';

    tr.innerHTML =
      '<td><strong></strong><br><small></small></td>' +
      '<td></td><td></td><td></td><td></td><td></td>';

    tr.children[0].children[0].textContent = r.symbol;
    tr.children[0].children[2].textContent = r.name || '';

    tr.children[1].textContent =
      r.close == null ? '-' : fmt(r.close);

    tr.children[2].textContent =
      r.priceDate || 'لا يوجد سعر';

    let status;

    if (r.hasLatestSession) {
      status = 'أحدث جلسة';
    } else if (r.close != null) {
      status = 'آخر سعر متاح';
    } else {
      status = 'لا يوجد سعر';
    }

    tr.children[3].textContent = status;

    tr.children[4].textContent = c;
    tr.children[4].className = cls(r.chg);

    tr.children[5].textContent =
      r.vol != null ? fmt(r.vol, 0) : '-';

    if (!r.hasLatestSession) {
      tr.style.opacity = '0.72';
    }

    tr.onclick = () => showStock(r.symbol, r.name);

    t.append(tr);
  });

  q.oninput = () => {
    const v = q.value.trim().toLowerCase();

    t.querySelectorAll('tr.stk').forEach(x => {
      x.classList.toggle(
        'hidden',
        v && !x.textContent.toLowerCase().includes(v)
      );
    });
  };

  box.append(info, q, t);
};
