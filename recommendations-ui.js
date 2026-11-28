
/* واجهة ترشيحات الأسهم الموحدة - بطاقات وتحليل المخاطر + تنزيل PDF + مستويات واقعية */
(function () {
  'use strict';

  if (window.__recommendationsCardsLoaded) return;
  window.__recommendationsCardsLoaded = true;

  const $ = id => document.getElementById(id);

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function num(value, digits) {
    const n = Number(value);
    if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return 'غير متاح';
    return n.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits == null ? 2 : digits
    });
  }

  function pct(value) {
    return value == null || !Number.isFinite(Number(value)) ? 'غير متاح' : num(value, 1) + '%';
  }

  function safeUrl(value) {
    try {
      const u = new URL(String(value || ''));
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
    } catch (_) {
      return '';
    }
  }

  function setStatus(text, type) {
    const el = $('aiStatus');
    if (!el) return;
    el.textContent = text;
    el.className = 'msg ' + (type || 'ok');
  }

  function metric(label, value, hint) {
    return '<div class="rc-metric"><small>' + esc(label) + '</small><strong>' +
      esc(value) + '</strong>' + (hint ? '<span>' + esc(hint) + '</span>' : '') + '</div>';
  }

  function reasonsList(stock) {
    const list = Array.isArray(stock.reasons) ? stock.reasons :
      Array.isArray(stock.why) ? stock.why :
      stock.reason ? [stock.reason] : [];
    if (!list.length) return '<p class="rc-muted">لم يسجل المحرك أسبابًا تفصيلية لهذا السهم.</p>';
    return '<ul class="rc-reasons">' + list.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
  }

  function newsBlock(news, title) {
    if (!news || !news.title) return '';
    const url = safeUrl(news.link);
    return '<div class="rc-news"><strong>' + esc(title) + '</strong><div>' +
      (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(news.title) + '</a>' : esc(news.title)) +
      '</div><small>' + esc(news.source || 'المصدر غير محدد') + ' · ' +
      esc(news.published_at || 'التاريخ غير متاح') +
      (news.sentiment ? ' · ' + esc(news.sentiment) : '') +
      (news.impact_score != null ? ' · أثر الخبر: ' + esc(news.impact_score) + '/100' : '') +
      '</small></div>';
  }

  function ratio(entry, target, stop) {
    const risk = Number(entry) - Number(stop);
    const reward = Number(target) - Number(entry);
    if (![risk, reward].every(Number.isFinite) || risk <= 0 || reward <= 0) return null;
    return reward / risk;
  }

  function riskReward(stock) {
    const entry = Number(stock.entry_high);
    const stop = Number(stock.stop_loss);
    const r1 = ratio(entry, Number(stock.target1), stop);
    const r2 = ratio(entry, Number(stock.target2), stop);
    return {
      one: r1 == null ? 'غير قابل للحساب' : '1 : ' + num(r1, 2),
      two: r2 == null ? 'غير قابل للحساب' : '1 : ' + num(r2, 2)
    };
  }

  function riskNotes(stock) {
    const notes = [];
    const close = Number(stock.close ?? stock.lastPrice);
    const resistance = Number(stock.resistance);
    const support = Number(stock.support);
    const volumeRatio = Number(stock.volume_ratio);
    if (stock.breakout !== true) notes.push('لم يسجل المحرك اختراق مقاومة مؤكّدًا في آخر جلسة.');
    if (Number.isFinite(resistance) && resistance > close && (resistance - close) / close < 0.03) {
      notes.push('السهم قريب من مقاومة تاريخية؛ راقب فشل الاختراق.');
    }
    if (Number.isFinite(support) && support > 0 && close > 0 && (close - support) / close > 0.08) {
      notes.push('الدعم المحسوب بعيد نسبيًا عن الإغلاق؛ راجع المسافة إلى وقف الخسارة.');
    }
    if (!Number.isFinite(volumeRatio)) notes.push('نسبة حجم التداول غير متاحة.');
    if (!notes.length) notes.push('لا توجد إشارة خطر إضافية مسجلة في حقول المحرك؛ يظل فشل الاختراق أو ضعف السوق احتمالًا قائمًا.');
    return '<ul class="rc-risks">' + notes.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
  }

  /* ===== مستويات واقعية: الأهداف ووقف الخسارة تتحدد حسب تذبذب السهم خلال ~5 جلسات =====
     تحليل فني فقط. المستويات الأصلية من المحرك تبقى محفوظة وتظهر في التفاصيل.
     الأرقام قابلة للتعديل من هنا. حد التغير اليومي في البورصة المصرية (السوق النشط): ±20% ويوقف مؤقتًا عند 10%. */
  const LEVEL_CFG = {
    horizon: 5,
    t1: {k: 1.0, min: 0.02, max: 0.10},
    t2: {k: 1.8, min: 0.035, max: 0.15},
    stop: {k: 0.8, min: 0.02, max: 0.08},
    fallbackSigma: 0.02
  };

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  async function loadSigmas(symbols) {
    const out = {};
    const db = window.sb;
    if (!db || !symbols.length) return out;
    const since = new Date(Date.now() - 50 * 86400000).toISOString().slice(0, 10);
    const res = await db.from('prices').select('symbol,trade_date,close')
      .in('symbol', symbols).gte('trade_date', since)
      .order('trade_date', {ascending: true}).limit(5000);
    if (res.error) throw res.error;
    const by = {};
    (res.data || []).forEach(r => {
      const c = Number(r.close);
      if (Number.isFinite(c) && c > 0) (by[r.symbol] = by[r.symbol] || []).push(c);
    });
    Object.keys(by).forEach(sym => {
      const c = by[sym].slice(-21);
      if (c.length < 8) return;
      const r = c.slice(1).map((v, i) => v / c[i] - 1);
      const m = r.reduce((a, b) => a + b, 0) / r.length;
      out[sym] = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / r.length);
    });
    return out;
  }

  function adjustStock(stock, sigmas) {
    const entry = Number(stock.entry_high);
    if (!Number.isFinite(entry) || entry <= 0 || stock.levels_adjusted) return;
    const known = Number.isFinite(sigmas[stock.symbol]);
    const sd = known ? sigmas[stock.symbol] : LEVEL_CFG.fallbackSigma;
    const sh = sd * Math.sqrt(LEVEL_CFG.horizon);
    const c = LEVEL_CFG;
    const m1 = clamp(c.t1.k * sh, c.t1.min, c.t1.max);
    const m2 = Math.max(clamp(c.t2.k * sh, c.t2.min, c.t2.max), m1 + 0.01);
    const ms = clamp(c.stop.k * sh, c.stop.min, c.stop.max);
    const e1 = Number(stock.target1), e2 = Number(stock.target2), es = Number(stock.stop_loss);
    stock.engine_levels = {target1: e1, target2: e2, stop_loss: es};
    const eM1 = e1 > entry ? e1 / entry - 1 : Infinity;
    const eM2 = e2 > entry ? e2 / entry - 1 : Infinity;
    const eMs = es > 0 && es < entry ? 1 - es / entry : Infinity;
    const f1 = Math.min(m1, eM1), f2 = Math.min(m2, eM2), fs = Math.min(ms, eMs);
    stock.target1 = entry * (1 + f1);
    stock.target2 = entry * (1 + Math.max(f2, f1 + 0.005));
    stock.stop_loss = entry * (1 - fs);
    stock.levels_adjusted = true;
    stock.levels_sigma = known ? sd : null;
  }

  async function adjustLevels(data) {
    const picks = Array.isArray(data.recommendations) ? data.recommendations : [];
    if (!picks.length) return;
    let sigmas = {};
    try { sigmas = await loadSigmas(picks.map(p => p.symbol).filter(Boolean)); }
    catch (e) { console.warn('Levels volatility load failed:', e); }
    picks.forEach(p => adjustStock(p, sigmas));
  }

  function chg(level, entry) {
    const l = Number(level), e = Number(entry);
    if (!Number.isFinite(l) || !Number.isFinite(e) || e <= 0) return null;
    return (l / e - 1) * 100;
  }

  function sgn(v) {
    if (v == null) return '';
    return (v > 0 ? '+' : '') + num(v, 2) + '%';
  }

  function row(label, value, p, cls) {
    return '<div class="rc-row"><span class="rc-l">' + esc(label) + '</span>' +
      '<strong>' + esc(value) + '</strong>' +
      '<em class="' + cls + '">' + esc(p == null ? '' : sgn(p)) + '</em></div>';
  }

  function card(stock, index, type) {
    const score = Number(stock.score);
    const scoreText = Number.isFinite(score) ? num(score, 0) : '';
    const rr = riskReward(stock);
    const name = stock.name || stock.company_name || stock.symbol;
    const symbol = stock.symbol || '';
    const entry = type === 'pick' ? stock.entry_high : (stock.close ?? stock.lastPrice);

    let html = '<article class="rc-card">' +
      '<div class="rc-bar"><span>' + esc(symbol) + '</span>' +
      (scoreText ? '<b title="الدرجة المركبة">' + esc(scoreText) + '</b>' : '') +
      '<span>الكود</span></div>' +
      '<div class="rc-name"><span>' + esc(name) + '</span><small>اسم الشركة</small></div>';

    if (type === 'pick') {
      html += '<div class="rc-row"><span class="rc-l">شراء بعد</span><strong>' + esc(num(entry, 3)) + '</strong><em></em></div>' +
        row('المستهدف الأول', num(stock.target1, 3), chg(stock.target1, entry), 'up') +
        row('المستهدف الثاني', num(stock.target2, 3), chg(stock.target2, entry), 'up') +
        row('وقف خسارة', num(stock.stop_loss, 3), chg(stock.stop_loss, entry), 'dn');
    } else {
      html += '<div class="rc-row"><span class="rc-l">آخر إغلاق</span><strong>' + esc(num(entry, 3)) + '</strong><em></em></div>';
    }

    html += '<details class="rc-details"><summary>لماذا؟ والمخاطر</summary>' +
      (type === 'pick' && stock.levels_adjusted ? '<p class="rc-muted">المستويات مضبوطة على تذبذب السهم خلال ~' + LEVEL_CFG.horizon + ' جلسات' +
        (stock.levels_sigma == null ? ' (بيانات التذبذب غير متاحة، استُخدم تذبذب افتراضي ' + num(LEVEL_CFG.fallbackSigma * 100, 1) + '% يوميًا)' : ' (تذبذب يومي ' + num(stock.levels_sigma * 100, 2) + '%)') +
        '. مستويات المحرك الأصلية: هدف 1 ' + esc(num(stock.engine_levels && stock.engine_levels.target1, 3)) + ' ، هدف 2 ' + esc(num(stock.engine_levels && stock.engine_levels.target2, 3)) + ' ، وقف ' + esc(num(stock.engine_levels && stock.engine_levels.stop_loss, 3)) + '.</p>' : '') +
      (type === 'pick' ? '<p class="rc-muted">منطقة الدخول: ' + esc(num(stock.entry_low, 3)) + ' – ' + esc(num(stock.entry_high, 3)) +
        ' · العائد/المخاطرة: هدف 1 ' + esc(rr.one) + ' ، هدف 2 ' + esc(rr.two) + '</p>' : '') +
      '<p class="rc-muted">RSI ' + esc(num(stock.rsi14 ?? stock.rsi, 1)) +
      ' · حجم/متوسط 20: ' + esc(stock.volume_ratio == null ? 'غير متاح' : num(stock.volume_ratio, 2) + ' مرة') +
      ' · الدرجة الفنية ' + esc(stock.technical_score == null ? 'غير متاح' : num(stock.technical_score, 1) + '/100') +
      ' · السيولة ' + esc(stock.liquidity_score == null ? 'غير متاح' : num(stock.liquidity_score, 1) + '/15') +
      ' · الأخبار ' + esc(stock.news_score == null ? 'غير متاح' : num(stock.news_score, 1) + '/±10') + '</p>' +
      '<h4>أسباب الترشيح</h4>' + reasonsList(stock) +
      '<h4>المخاطر</h4>' + riskNotes(stock) +
      '<p class="rc-muted">الدعم ' + esc(num(stock.support, 3)) + ' · المقاومة ' + esc(num(stock.resistance, 3)) +
      ' · اختراق: ' + esc(stock.breakout === true ? 'نعم' : stock.breakout === false ? 'لم يتأكد' : 'غير متاح') + '</p>' +
      newsBlock(stock.latest_material_news, 'آخر خبر جوهري') +
      newsBlock(stock.latest_news, 'آخر خبر مرتبط') +
      '</details></article>';
    return html;
  }

  function printReport() {
    const root = $('aiResult');
    if (!root || !root.classList.contains('rc-report')) {
      setStatus('أنشئ تقرير التحليل أولًا قبل حفظ PDF.', 'err');
      return;
    }

    const button = $('rcPdfButton');
    const details = Array.from(root.querySelectorAll('details'));
    const previousStates = details.map(el => el.open);

    details.forEach(el => { el.open = true; });
    if (button) button.textContent = 'جاري تجهيز PDF...';

    const restore = function () {
      details.forEach((el, i) => { el.open = previousStates[i]; });
      if (button) button.textContent = 'حفظ التقرير PDF';
      window.removeEventListener('afterprint', restore);
    };

    window.addEventListener('afterprint', restore);
    window.setTimeout(function () {
      window.print();
      window.setTimeout(restore, 1500);
    }, 250);
  }

  /* ===== تنزيل PDF حقيقي من غير طباعة (يعمل على الموبايل) ===== */
  function sortedPicks(picks, key) {
    return picks.slice().sort((a, b) => {
      if (key === 'liquidity') return Number(b.turnover_ratio || 0) - Number(a.turnover_ratio || 0);
      if (key === 'volume') return Number(b.volume_ratio || 0) - Number(a.volume_ratio || 0);
      return Number(b.score || 0) - Number(a.score || 0);
    });
  }

  function wrapText(ctx, text, maxW) {
    const words = String(text).split(' ');
    const lines = [];
    let line = '';
    words.forEach(w => {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    return lines;
  }

  function drawPages(data, sortKey) {
    const picks = sortedPicks(Array.isArray(data.recommendations) ? data.recommendations : [], sortKey);
    const W = 1240, H = 1754, M = 60, rowH = 92, headH = 56;
    const sess = data.latest_session || 'غير متاح';
    const cols = [
      {t: '#', w: 50}, {t: 'السهم', w: 290}, {t: 'الدرجة', w: 110}, {t: 'شراء بعد', w: 170},
      {t: 'المستهدف 1', w: 170}, {t: 'المستهدف 2', w: 170}, {t: 'وقف خسارة', w: 170}
    ];
    const totalW = cols.reduce((a, c) => a + c.w, 0);
    const scale = (W - 2 * M) / totalW;
    cols.forEach(c => { c.w = c.w * scale; });
    const pages = [];
    let canvas, ctx, y, pageNo = 0;

    function newPage() {
      canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      ctx.direction = 'rtl'; ctx.textBaseline = 'middle';
      pageNo++;
      y = M;
      ctx.fillStyle = '#10243a'; ctx.textAlign = 'right';
      ctx.font = 'bold 40px Arial, Tahoma, sans-serif';
      ctx.fillText('مساعد البورصة: أفكار للجلسة القادمة', W - M, y + 20);
      ctx.font = '24px Arial, Tahoma, sans-serif'; ctx.fillStyle = '#44566a';
      ctx.fillText('آخر جلسة بيانات: ' + sess + '  ·  عدد الأسهم: ' + picks.length + '  ·  ' + new Date().toISOString().slice(0, 16).replace('T', ' '), W - M, y + 70);
      y += 110;
      drawHead();
      pages.push(canvas);
    }
    function drawHead() {
      let x = W - M;
      ctx.fillStyle = '#14306b'; ctx.fillRect(M, y, W - 2 * M, headH);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 24px Arial, Tahoma, sans-serif'; ctx.textAlign = 'center';
      cols.forEach(c => { ctx.fillText(c.t, x - c.w / 2, y + headH / 2); x -= c.w; });
      y += headH;
    }
    function footer() {
      ctx.fillStyle = '#555'; ctx.font = '21px Arial, Tahoma, sans-serif'; ctx.textAlign = 'right';
      const note = 'تحليل فني آلي من بيانات الإغلاق، وليس ضمان ربح ولا نصيحة شراء أو بيع. النسب محسوبة من سعر "شراء بعد". المستويات مضبوطة على تذبذب السهم خلال حوالي ' + LEVEL_CFG.horizon + ' جلسات. راجع الأخبار وأحدث الأسعار قبل أي قرار.';
      const lines = wrapText(ctx, note, W - 2 * M);
      ctx.strokeStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(M, H - M - 40 - lines.length * 30); ctx.lineTo(W - M, H - M - 40 - lines.length * 30); ctx.stroke();
      lines.forEach((l, i) => ctx.fillText(l, W - M, H - M - 20 - (lines.length - 1 - i) * 30));
      ctx.textAlign = 'center'; ctx.fillText(String(pageNo), W / 2, H - M + 10);
    }

    newPage();
    const maxY = () => H - M - 220;
    if (!picks.length) {
      ctx.fillStyle = '#172b3d'; ctx.font = '28px Arial, Tahoma, sans-serif'; ctx.textAlign = 'right';
      ctx.fillText('لا توجد أسهم استوفت شروط الترشيح في آخر جلسة.', W - M, y + 50);
    }
    picks.forEach((p, i) => {
      if (y + rowH > maxY()) { footer(); newPage(); }
      const entry = p.entry_high;
      const cells = [
        [String(i + 1)],
        [String(p.symbol || ''), String(p.name || p.company_name || '').slice(0, 26)],
        [Number.isFinite(Number(p.score)) ? num(p.score, 0) : '—'],
        [num(entry, 3)],
        [num(p.target1, 3), sgn(chg(p.target1, entry)), '#1a9a55'],
        [num(p.target2, 3), sgn(chg(p.target2, entry)), '#1a9a55'],
        [num(p.stop_loss, 3), sgn(chg(p.stop_loss, entry)), '#d12a2a']
      ];
      if (i % 2) { ctx.fillStyle = '#f4f7fa'; ctx.fillRect(M, y, W - 2 * M, rowH); }
      let x = W - M;
      ctx.textAlign = 'center';
      cells.forEach((cell, ci) => {
        const cx = x - cols[ci].w / 2;
        ctx.fillStyle = '#172b3d';
        ctx.font = (ci === 1 ? 'bold ' : '') + '26px Arial, Tahoma, sans-serif';
        ctx.fillText(cell[0], cx, y + (cell[1] ? 30 : rowH / 2));
        if (cell[1]) {
          ctx.fillStyle = cell[2] || '#44566a';
          ctx.font = (cell[2] ? 'bold ' : '') + (ci === 1 ? '21px' : '24px') + ' Arial, Tahoma, sans-serif';
          ctx.fillText(cell[1], cx, y + 62);
        }
        x -= cols[ci].w;
      });
      ctx.strokeStyle = '#d5dde5'; ctx.beginPath(); ctx.moveTo(M, y + rowH); ctx.lineTo(W - M, y + rowH); ctx.stroke();
      y += rowH;
    });
    footer();
    return pages;
  }

  function b64ToBytes(b64) {
    const bin = atob(b64), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function buildPdf(canvases) {
    const enc = new TextEncoder();
    const chunks = [], offsets = [];
    let len = 0;
    const push = b => { const u = typeof b === 'string' ? enc.encode(b) : b; chunks.push(u); len += u.length; };
    const n = canvases.length;
    const imgs = canvases.map(c => ({b: b64ToBytes(c.toDataURL('image/jpeg', 0.92).split(',')[1]), w: c.width, h: c.height}));
    const kids = imgs.map((_, i) => (3 + i * 3) + ' 0 R').join(' ');
    push('%PDF-1.4\n');
    offsets[1] = len; push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    offsets[2] = len; push('2 0 obj\n<< /Type /Pages /Kids [' + kids + '] /Count ' + n + ' >>\nendobj\n');
    imgs.forEach((im, i) => {
      const pg = 3 + i * 3, ig = pg + 1, ct = pg + 2;
      const content = 'q 595 0 0 842 0 0 cm /Im0 Do Q';
      offsets[pg] = len;
      push(pg + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ' + ig + ' 0 R >> >> /Contents ' + ct + ' 0 R >>\nendobj\n');
      offsets[ig] = len;
      push(ig + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.b.length + ' >>\nstream\n');
      push(im.b); push('\nendstream\nendobj\n');
      offsets[ct] = len;
      push(ct + ' 0 obj\n<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream\nendobj\n');
    });
    const total = 3 + n * 3;
    const xref = len;
    let x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (let i = 1; i < total; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    push(x + 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    const out = new Uint8Array(len);
    let p = 0;
    chunks.forEach(c => { out.set(c, p); p += c.length; });
    return out;
  }

  function downloadBlob(bytesOrText, name, type) {
    const blob = new Blob([bytesOrText], {type: type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 4000);
  }

  function htmlReport(data, sortKey) {
    const picks = sortedPicks(Array.isArray(data.recommendations) ? data.recommendations : [], sortKey);
    const rows = picks.map((x, i) => {
      const e = x.entry_high;
      return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(x.symbol) + '</b><br>' + esc(x.name || '') + '</td><td>' + esc(num(x.score, 0)) + '</td><td>' + esc(num(e, 3)) +
        '</td><td>' + esc(num(x.target1, 3)) + '<br>' + esc(sgn(chg(x.target1, e))) + '</td><td>' + esc(num(x.target2, 3)) + '<br>' + esc(sgn(chg(x.target2, e))) +
        '</td><td>' + esc(num(x.stop_loss, 3)) + '<br>' + esc(sgn(chg(x.stop_loss, e))) + '</td></tr>';
    }).join('');
    return '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>أفكار للجلسة القادمة</title>' +
      '<style>body{font-family:Arial,sans-serif;margin:14px}table{width:100%;border-collapse:collapse}th{background:#14306b;color:#fff;padding:6px}td{border:1px solid #ccd;padding:6px;text-align:center}</style></head><body>' +
      '<h2>مساعد البورصة: أفكار للجلسة القادمة</h2><p>آخر جلسة بيانات: ' + esc(data.latest_session || 'غير متاح') + '</p>' +
      '<table><tr><th>#</th><th>السهم</th><th>الدرجة</th><th>شراء بعد</th><th>هدف 1</th><th>هدف 2</th><th>وقف</th></tr>' + rows + '</table>' +
      '<p style="font-size:12px;color:#555">تحليل فني آلي وليس ضمان ربح ولا نصيحة شراء أو بيع. راجع الأخبار وأحدث الأسعار قبل أي قرار.</p></body></html>';
  }

  function downloadReport(data, sortKey) {
    const stamp = String(data.latest_session || new Date().toISOString().slice(0, 10)).slice(0, 10);
    try {
      const bytes = buildPdf(drawPages(data, sortKey));
      downloadBlob(bytes, 'ترشيحات-' + stamp + '.pdf', 'application/pdf');
      setStatus('تم تجهيز ملف PDF للتنزيل. افحص مجلد التنزيلات.', 'ok');
    } catch (e) {
      console.error('PDF build failed, falling back to HTML:', e);
      downloadBlob(htmlReport(data, sortKey), 'ترشيحات-' + stamp + '.html', 'text/html');
      setStatus('تعذر إنشاء PDF، تم تنزيل التقرير كملف HTML بدلًا منه.', 'err');
    }
  }

  function renderReport(data) {
    const root = $('aiResult');
    if (!root) return;

    const picks = Array.isArray(data.recommendations) ? data.recommendations : [];
    const watch = Array.isArray(data.watchlist) ? data.watchlist : [];
    const quality = data.data_quality || {};
    const excluded = Array.isArray(data.data_quality_details) ? data.data_quality_details : [];

    let html = '<style>' +
      '#aiResult.rc-report{background:transparent;border:0;padding:0;white-space:normal;line-height:1.5}' +
      '.rc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}' +
      '.rc-card{background:#fff;border:1px solid #e1e8ef;border-radius:6px;padding:0 0 8px;overflow:hidden;font-size:14px;break-inside:avoid;page-break-inside:avoid}' +
      '.rc-bar{display:flex;justify-content:space-between;align-items:center;background:#14306b;color:#fff;padding:7px 10px;font-weight:bold}' +
      '.rc-bar b{background:#e8f7f0;color:#167653;border-radius:10px;padding:1px 8px;font-size:12px}' +
      '.rc-name{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:8px 10px}.rc-name small{color:#687b8d}' +
      '.rc-row{display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center;padding:3px 10px;text-align:center}' +
      '.rc-row .rc-l{text-align:right;color:#172b3d}.rc-row em{font-style:normal;font-weight:bold}.rc-row .up{color:#1a9a55}.rc-row .dn{color:#d12a2a}' +
      '.rc-muted,.rc-metric small{color:#687b8d}.rc-summary{background:#fff;border:1px solid #e1e8ef;border-radius:10px;padding:8px 12px;margin:10px 0}' +
      '.rc-details{margin:6px 10px 0;border-top:1px solid #e4eaf0;padding-top:6px;font-size:13px}.rc-details summary{cursor:pointer;color:#24506d}' +
      '.rc-card h4{margin:10px 0 4px}.rc-reasons,.rc-risks{padding-right:20px;margin:5px 0}.rc-risks{color:#8a4b16}' +
      '.rc-news{background:#f7fafc;border-radius:8px;padding:8px;margin:6px 0}.rc-news a{color:#176b9a}.rc-news small{display:block;color:#687b8d}' +
      '.rc-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0;font-size:13px}.rc-controls select{padding:6px;border:1px solid #ccd5dd;border-radius:8px;background:#fff}' +
      '.rc-pdf-btn{padding:8px 13px;border:0;border-radius:8px;background:#176b55;color:#fff;font-weight:bold;cursor:pointer}' +
      '.rc-section-title{margin:14px 0 8px}.rc-empty{padding:14px;background:#fff;border:1px solid #e1e8ef;border-radius:10px}' +
      '@media(max-width:600px){.rc-grid{grid-template-columns:1fr}}' +
      '@media print{' +
        '@page{size:auto;margin:12mm}' +
        'body *{visibility:hidden !important}' +
        '#aiResult,#aiResult *{visibility:visible !important}' +
        '#aiResult.rc-report{position:absolute !important;left:0 !important;top:0 !important;width:100% !important;margin:0 !important;padding:0 !important;background:#fff !important;color:#111 !important}' +
        '#aiResult .rc-controls{display:none !important}' +
        '#aiResult .rc-grid{grid-template-columns:repeat(2,minmax(0,1fr)) !important;gap:8px !important}' +
        '#aiResult .rc-card{break-inside:avoid;page-break-inside:avoid;box-shadow:none !important}' +
        '#aiResult details:not([open]) > *:not(summary){display:block !important}' +
        '#aiResult .rc-watch,#aiResult .rc-excluded{display:block !important}' +
        '#aiResult a{color:#111 !important;text-decoration:underline}' +
        '#aiResult .rc-bar{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '}' +
      '</style>';

    html += '<details class="rc-summary"><summary>ملخص الجلسة: آخر جلسة ' + esc(data.latest_session || 'غير متاح') +
      ' · المرشحة ' + esc(data.recommended_count ?? picks.length) + ' من ' + esc(data.analyzed ?? 'غير متاح') + '</summary><div class="rc-muted">' +
      'الأسهم النشطة: ' + esc(data.active_stocks ?? 'غير متاح') +
      ' · بيانات قديمة: ' + esc(quality.stale ?? 0) +
      ' · لا توجد أسعار: ' + esc(quality.no_data ?? 0) +
      ' · تاريخ غير كافٍ: ' + esc(quality.insufficient_history ?? 0) +
      (data.generated_at ? ' · وقت التقرير: ' + esc(new Date(data.generated_at).toLocaleString('ar-EG')) : '') +
      '<br>' + esc(data.methodology || 'النتائج مبنية على بيانات الإغلاق المسجلة وليست بثًا لحظيًا.') + '</div></details>';

    html += '<div class="rc-controls"><label for="rcSort">ترتيب المرشحين:</label><select id="rcSort">' +
      '<option value="score">الأعلى درجة مركبة</option><option value="liquidity">الأعلى سيولة</option><option value="volume">الأعلى حجمًا</option></select>' +
      '<button type="button" id="rcPdfDl" class="rc-pdf-btn">⬇️ تنزيل PDF</button>' +
      '<button type="button" id="rcPdfButton" class="rc-pdf-btn" style="background:#51657a">طباعة التقرير الكامل</button></div>';

    html += '<h3 class="rc-section-title">أفكار للجلسة القادمة (' + picks.length + ')</h3>';
    html += '<div id="rcPicks" class="rc-grid">' + (picks.length ? picks.map((x, i) => card(x, i, 'pick')).join('') :
      '<div class="rc-empty">لا توجد أسهم استوفت شروط الترشيح في آخر جلسة. لن نملأ القائمة بأسهم غير مطابقة.</div>') + '</div>';

    html += '<details class="rc-watch"><summary>قائمة المتابعة غير المرشحة (' + watch.length + ')</summary>' +
      '<p class="rc-muted">هذه الأسهم لم تستوفِ شروط الترشيح الحالية، ولا تُعرض كتوصيات شراء.</p>' +
      (watch.length ? '<div class="rc-grid">' + watch.map((x, i) => card(x, i, 'watch')).join('') + '</div>' : '<p>لا توجد أسهم في قائمة المتابعة.</p>') +
      '</details>';

    html += '<details class="rc-excluded"><summary>الأسهم المستبعدة بسبب جودة البيانات (' + excluded.length + ')</summary>' +
      (excluded.length ? '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th>السهم</th><th>سبب الاستبعاد</th><th>آخر تاريخ</th><th>عدد الجلسات</th></tr></thead><tbody>' +
        excluded.map(x => '<tr><td>' + esc(x.name || x.symbol) + ' (' + esc(x.symbol) + ')</td><td>' +
          esc(x.reason === 'stale' ? 'بيانات قديمة' : x.reason === 'no_data' ? 'لا توجد أسعار' : x.reason === 'insufficient_history' ? 'تاريخ غير كافٍ' : x.reason) +
          '</td><td>' + esc(x.last_date || '—') + '</td><td>' + esc(x.sessions_count ?? '—') + '</td></tr>').join('') +
        '</tbody></table></div>' : '<p>لا توجد أسماء مستبعدة في تفاصيل جودة البيانات.</p>') + '</details>';

    html += '<p class="rc-muted">تنبيه: تقديرات آلية من بيانات الإغلاق وليست ضمان ربح ولا نصيحة شراء أو بيع؛ راجع الأخبار وأحدث الأسعار قبل أي قرار.</p>';

    root.innerHTML = html;
    root.classList.remove('hidden');
    root.classList.add('rc-report');

    const dlBtn = $('rcPdfDl');
    if (dlBtn) dlBtn.addEventListener('click', function () { downloadReport(data, $('rcSort') ? $('rcSort').value : 'score'); });
    const pdfButton = $('rcPdfButton');
    if (pdfButton) pdfButton.addEventListener('click', printReport);

    const sort = $('rcSort');
    if (sort) sort.addEventListener('change', function () {
      const key = sort.value;
      const sorted = picks.slice().sort((a, b) => {
        if (key === 'liquidity') return Number(b.turnover_ratio || 0) - Number(a.turnover_ratio || 0);
        if (key === 'volume') return Number(b.volume_ratio || 0) - Number(a.volume_ratio || 0);
        return Number(b.score || 0) - Number(a.score || 0);
      });
      const box = $('rcPicks');
      if (box) box.innerHTML = sorted.map((x, i) => card(x, i, 'pick')).join('') ||
        '<div class="rc-empty">لا توجد أسهم مستوفية للشروط.</div>';
    });
  }

  window.runAIAnalysis = async function () {
    const symbol = ($('aiSymbol')?.value || '').trim().toUpperCase();
    const btn = $('aiAnalyzeBtn');
    const root = $('aiResult');
    if (!btn || !root) return;

    btn.disabled = true;
    btn.textContent = 'جاري التحليل...';
    root.classList.add('hidden');
    root.classList.remove('rc-report');
    root.innerHTML = '';
    setStatus(symbol ? 'جاري تحليل السهم ' + symbol + '...' :
      'جاري تحليل جميع الأسهم وربط الأخبار وفحص السيولة وجودة البيانات...', 'ok');

    try {
      const db = window.sb;
      if (!db) throw new Error('اتصال قاعدة البيانات غير متاح. أعد تسجيل الدخول.');
      const { data, error } = await db.functions.invoke('egx-ai-analysis', {
        body: symbol ? { symbol: symbol } : {}
      });
      if (error) throw error;
      if (!data) throw new Error('لم تصل استجابة من محرك التحليل.');
      if (data.error) throw new Error(data.error);

      await adjustLevels(data);
      renderReport(data);
      setStatus('اكتمل التحليل. آخر جلسة: ' + (data.latest_session || 'غير متاح') +
        ' · الأسهم المرشحة: ' + (data.recommended_count ?? (data.recommendations || []).length) +
        ' · تم فصل قائمة المتابعة عن الترشيحات.', 'ok');
    } catch (error) {
      console.error('Recommendations UI error:', error);
      root.innerHTML = '<div class="rc-empty"><strong>تعذر إنشاء التقرير</strong><p>' +
        esc(error.message || error) + '</p></div>';
      root.classList.remove('hidden');
      setStatus('حدث خطأ أثناء التحليل: ' + (error.message || error), 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = symbol ? 'حلّل السهم' : 'حلّل كل الأسهم';
    }
  };
})();

