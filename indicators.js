
/* أدوات التحليل الفني - بيانات الأسعار الموحدة من EGX MCP عبر Supabase */

window.sma = (a, n) => a.map((_, i) =>
  i < n - 1
    ? null
    : a.slice(i - n + 1, i + 1)
        .reduce((x, y) => x + y, 0) / n
);

window.ema = (a, n) => {
  const k = 2 / (n + 1);
  const out = [];
  a.forEach((v, i) =>
    out.push(i ? v * k + out[i - 1] * (1 - k) : v)
  );
  return out;
};

window.rsi = (closes, n = 14) => {
  if (!Array.isArray(closes) || closes.length <= n) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }

  gains /= n;
  losses /= n;

  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gains = (gains * (n - 1) + Math.max(d, 0)) / n;
    losses = (losses * (n - 1) + Math.max(-d, 0)) / n;
  }

  if (losses === 0) return gains === 0 ? 50 : 100;
  return 100 - 100 / (1 + gains / losses);
};

window.macd = closes => {
  if (!Array.isArray(closes) || closes.length < 35) return null;

  const fast = window.ema(closes, 12);
  const slow = window.ema(closes, 26);
  const line = closes.map((_, i) => fast[i] - slow[i]);
  const signal = window.ema(line, 9);
  const i = closes.length - 1;

  return {
    m: line[i],
    signal: signal[i],
    h: line[i] - signal[i],
    hp: i > 0 ? line[i - 1] - signal[i - 1] : null
  };
};

window.chartSVG = (dates, close, s20, s50) => {
  if (!close || close.length < 2) {
    return '<p>لا توجد بيانات كافية للرسم</p>';
  }

  const W = 600, H = 220, P = 12;
  const all = close.concat(
    s20.filter(x => Number.isFinite(x)),
    s50.filter(x => Number.isFinite(x))
  );

  const mn = Math.min(...all);
  const mx = Math.max(...all);

  const X = i => P + i * (W - 2 * P) / (close.length - 1);
  const Y = v => H - P - (v - mn) / (mx - mn || 1) * (H - 2 * P);

  const path = a => {
    let s = '', on = false;
    a.forEach((v, i) => {
      if (!Number.isFinite(v)) return;
      s += (on ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1) + ' ';
      on = true;
    });
    return s;
  };

  const line = (a, color, width) =>
    '<path d="' + path(a) + '" fill="none" stroke="' +
    color + '" stroke-width="' + width + '"/>';

  return '<svg viewBox="0 0 ' + W + ' ' + H +
    '" style="width:100%;background:#f8fafc;border-radius:10px">' +
    line(close, '#10243a', 2) +
    line(s20, '#e08a00', 1.5) +
    line(s50, '#3b6fd4', 1.5) +
    '</svg>' +
    '<p style="font-size:12px;color:#718092">السعر: أسود | متوسط 20: برتقالي | متوسط 50: أزرق (' +
    dates[0] + ' إلى ' + dates[dates.length - 1] + ')</p>';
};

/* قائمة المؤشرات */
window.EGX_INDICES = [
  { symbol: 'EGX30', name: 'EGX30', title: 'مؤشر EGX30' },
  { symbol: 'EGX30CAPPED', name: 'EGX30CAPPED', title: 'مؤشر EGX30 Capped' },
  { symbol: 'EGX30USD', name: 'EGX30USD', title: 'مؤشر EGX30 بالدولار' },
  { symbol: 'EGX70EWI', name: 'EGX70EWI', title: 'مؤشر EGX70 EWI' },
  { symbol: 'EGX100EWI', name: 'EGX100EWI', title: 'مؤشر EGX100 EWI' }
];

/* فتح صفحة المؤشرات */
window.showIndicators = async function () {
  panel('indicatorsPanel');

  const box = document.getElementById('indicatorsBox');
  if (!box) return;

  box.innerHTML = '';

  const title = document.createElement('h3');
  title.textContent = 'اختر المؤشر المطلوب';
  box.append(title);

  const list = document.createElement('div');
  list.style.cssText =
    'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px';

  window.EGX_INDICES.forEach(index => {
    const b = document.createElement('button');
    b.className = 'sec';
    b.style.cssText = 'padding:18px;min-height:75px';
    b.textContent = index.title;
    b.onclick = () => window.showIndexDetails(index.symbol);
    list.append(b);
  });

  box.append(list);

  const details = document.createElement('div');
  details.id = 'indexDetails';
  details.style.marginTop = '18px';
  box.append(details);
};

/* تحليل مؤشر */
window.showIndexDetails = async function (symbol) {
  const box = document.getElementById('indexDetails');
  if (!box) return;

  const index = window.EGX_INDICES.find(x => x.symbol === symbol);

  if (!index) {
    box.textContent = 'المؤشر غير معروف';
    return;
  }

  box.innerHTML = '<p>جاري تحميل بيانات ' + index.title + '...</p>';

  const result = await sb.from('index_prices')
    .select('trade_date,close,source')
    .eq('index_code', symbol)
    .order('trade_date', { ascending: true })
    .limit(120);

  if (result.error) {
    box.textContent = 'تعذر تحميل البيانات: ' + result.error.message;
    return;
  }

  const data = result.data || [];

  const valid = data
    .map(x => ({
      ...x,
      close: Number(x.close),
      low: Number(x.close),
      high: Number(x.close)
    }))
    .filter(x =>
      Number.isFinite(x.close) &&
      x.close > 0 &&
      x.trade_date
    );

  if (!valid.length) {
    box.innerHTML =
      '<h3>' + index.title + '</h3>' +
      '<p>لا توجد أسعار إغلاق صالحة لهذا المؤشر في قاعدة البيانات.</p>';
    return;
  }

  const last = valid[valid.length - 1];
  const prev = valid.length > 1 ? valid[valid.length - 2] : null;

  const close = last.close;
  const previous = prev ? prev.close : null;

  const change = previous > 0
    ? (close - previous) / previous * 100
    : null;

  const closes = valid.map(x => x.close);
  const dates = valid.map(x => x.trade_date);

  const s20 = window.sma(closes, 20);
  const s50 = window.sma(closes, 50);
  const rv = window.rsi(closes, 14);
  const mc = window.macd(closes);

  /* الدعم والمقاومة: تجاهل الصفر والقيم غير الصالحة */
  const recent = valid.slice(-20);

  const lows = recent
    .map(x => x.low)
    .filter(x => Number.isFinite(x) && x > 0);

  const highs = recent
    .map(x => x.high)
    .filter(x => Number.isFinite(x) && x > 0);

  const supportValues = lows.length
    ? lows
    : recent.map(x => x.close).filter(x => x > 0);

  const resistanceValues = highs.length
    ? highs
    : recent.map(x => x.close).filter(x => x > 0);

  const support = supportValues.length
    ? Math.min(...supportValues)
    : null;

  const resistance = resistanceValues.length
    ? Math.max(...resistanceValues)
    : null;

  const fmt = value =>
    Number.isFinite(value)
      ? value.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
      : 'غير متاح';

  /* الاتجاه */
  let trend = 'بيانات غير كافية لتحديد الاتجاه';

  if (closes.length >= 50) {
    const ma20 = s20[s20.length - 1];
    const ma50 = s50[s50.length - 1];

    if (close > ma20 && ma20 > ma50) trend = 'اتجاه صاعد';
    else if (close < ma20 && ma20 < ma50) trend = 'اتجاه هابط';
    else trend = 'اتجاه عرضي أو مختلط';
  } else if (closes.length >= 20) {
    trend = close > s20[s20.length - 1]
      ? 'السعر أعلى متوسط 20 جلسة'
      : 'السعر أسفل متوسط 20 جلسة';
  }

  let rsiText = 'غير متاح';

  if (rv !== null) {
    rsiText = rv >= 70
      ? 'تشبع شرائي'
      : rv <= 30
        ? 'تشبع بيعي'
        : 'منطقة محايدة';
  }

  /* التوصية لا تظهر قبل اكتمال البيانات */
  let recommendation = 'لا توجد توصية؛ البيانات غير كافية';
  let confidence = 'غير متاحة';
  let risk = 'مرتفع بسبب نقص البيانات';

  if (closes.length >= 50 && rv !== null && mc) {
    const ma20 = s20[s20.length - 1];
    const ma50 = s50[s50.length - 1];

    if (close > ma20 && ma20 > ma50 && mc.h > 0 && rv < 70) {
      recommendation = 'إشارة إيجابية مبدئية';
      confidence = 'متوسطة';
      risk = 'متوسط؛ يلزم تأكيد الاتجاه';
    } else if (close < ma20 && ma20 < ma50 && mc.h < 0) {
      recommendation = 'إشارة سلبية';
      confidence = 'متوسطة';
      risk = 'مرتفع';
    } else {
      recommendation = 'انتظار تأكيد الاتجاه';
      confidence = 'منخفضة';
      risk = 'متوسط إلى مرتفع';
    }
  }

  box.innerHTML = '';

  const h = document.createElement('h3');
  h.textContent = index.title;
  box.append(h);

  const info = document.createElement('div');
  info.className = 'kv';

  const items = [
    ['آخر إغلاق', fmt(close)],
    ['تاريخ السعر', last.trade_date],
    ['التغير', change === null ? 'غير متاح' : (change > 0 ? '+' : '') + fmt(change) + '%'],
    ['عدد الجلسات', valid.length],
    ['الاتجاه', trend],
    ['RSI 14', rv === null ? 'غير متاح' : fmt(rv)],
    ['حالة RSI', rsiText],
    ['MACD Histogram', mc ? fmt(mc.h) : 'غير متاح'],
    ['الدعم التقريبي', fmt(support)],
    ['المقاومة التقريبية', fmt(resistance)]
  ];

  items.forEach(([k, v]) => {
    const d = document.createElement('div');
    const small = document.createElement('small');
    small.textContent = k;

    const strong = document.createElement('strong');
    strong.textContent = v;

    d.append(small, strong);
    info.append(d);
  });

  box.append(info);

  const chart = document.createElement('div');
  chart.innerHTML = window.chartSVG(dates, closes, s20, s50);
  box.append(chart);

  const rec = document.createElement('div');
  rec.style.cssText =
    'padding:14px;margin-top:14px;border-radius:10px;background:#f2f5f8;line-height:2';

  const recTitle = document.createElement('h3');
  recTitle.textContent = 'التحليل والتوصية';
  rec.append(recTitle);

  [
    ['التقييم', recommendation],
    ['درجة الثقة', confidence],
    ['مستوى المخاطر', risk]
  ].forEach(([k, v]) => {
    const p = document.createElement('p');
    p.textContent = k + ': ' + v;
    rec.append(p);
  });

  const note = document.createElement('p');
  note.style.fontSize = '12px';
  note.textContent =
    'المصدر: EGX MCP عبر Supabase (بيانات إغلاق يومية متأخرة). المؤشرات الفنية محسوبة من الإغلاقات المسجلة. لا تتوفر بيانات أعلى/أدنى مستقلة للمؤشر، لذلك الدعم والمقاومة تقريبيان من الإغلاقات فقط. لا تظهر القيم غير المتاحة على أنها أرقام مؤكدة. التحليل آلي ولا يمثل توصية استثمارية مؤكدة.';
  rec.append(note);

  box.append(rec);
};
