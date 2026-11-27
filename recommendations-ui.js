/* واجهة ترشيحات الأسهم الموحدة - بطاقات وتحليل المخاطر + حفظ PDF */
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
      '<button type="button" id="rcPdfButton" class="rc-pdf-btn">حفظ التقرير PDF</button></div>';

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
