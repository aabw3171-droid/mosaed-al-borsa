/* واجهة ترشيحات الأسهم الموحدة - بطاقات وتحليل المخاطر */
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

  function card(stock, index, type) {
    const score = Number(stock.score);
    const scoreText = Number.isFinite(score) ? num(score, 1) + '/100' : 'غير متاح';
    const rr = riskReward(stock);
    const name = stock.name || stock.company_name || stock.symbol;
    const symbol = stock.symbol || '';
    const date = stock.last_date || stock.date || '';
    const volumePass = stock.next_session_volume_pass === true;
    const closePass = stock.next_session_close_pass === true;
    const trendPass = stock.next_session_trend_pass === true;

    let html = '<article class="rc-card">' +
      '<div class="rc-card-head"><div><span class="rc-rank">#' + (index + 1) + '</span>' +
      '<h3>' + esc(name) + '</h3><small>' + esc(symbol) + '</small></div>' +
      '<div class="rc-score"><strong>' + esc(scoreText) + '</strong><small>الدرجة المركبة</small></div></div>' +
      '<div class="rc-pills"><span>' + esc(stock.recommendation || (type === 'pick' ? 'مرشح للجلسة القادمة' : 'للمتابعة')) + '</span>' +
      '<span>تاريخ البيانات: ' + esc(date || 'راجع آخر جلسة') + '</span></div>' +
      '<div class="rc-metrics">' +
      metric('آخر إغلاق', num(stock.close ?? stock.lastPrice, 3)) +
      metric('التغير', pct(stock.change_percent ?? stock.changePct)) +
      metric('RSI', num(stock.rsi14 ?? stock.rsi, 1)) +
      metric('حجم التداول / متوسط 20', stock.volume_ratio == null ? 'غير متاح' : num(stock.volume_ratio, 2) + ' مرة') +
      metric('قيمة التداول', stock.turnover_egp == null ? 'غير متاح' : num(stock.turnover_egp, 0) + ' جنيه') +
      metric('قيمة التداول / متوسطها', stock.turnover_ratio == null ? 'غير متاح' : num(stock.turnover_ratio, 2) + ' مرة') +
      '</div>';

    if (type === 'pick') {
      html += '<div class="rc-levels"><h4>خطة المستويات المحسوبة</h4><div class="rc-metrics">' +
        metric('منطقة الدخول', num(stock.entry_low, 3) + ' – ' + num(stock.entry_high, 3)) +
        metric('الهدف الأول', num(stock.target1, 3)) +
        metric('الهدف الثاني', num(stock.target2, 3)) +
        metric('وقف الخسارة', num(stock.stop_loss, 3)) +
        metric('العائد / المخاطرة للهدف 1', rr.one) +
        metric('العائد / المخاطرة للهدف 2', rr.two) +
        '</div><p class="rc-muted">حساب نسبة العائد للمخاطرة هنا يستخدم الحد الأعلى لمنطقة الدخول كافتراض أكثر تحفظًا، وليس سعر تنفيذ مضمونًا.</p></div>';
    }

    html += '<details class="rc-details"><summary>لماذا ظهر السهم؟ وما المخاطر؟</summary>' +
      '<h4>أسباب الترشيح / التقييم</h4>' + reasonsList(stock) +
      '<h4>تفصيل الدرجة</h4><div class="rc-metrics">' +
      metric('الدرجة الفنية الخام', stock.technical_score == null ? 'غير متاح' : num(stock.technical_score, 1) + '/100') +
      metric('المساهمة الفنية بعد الوزن 75%', stock.technical_score == null ? 'غير متاح' : num(Number(stock.technical_score) * 0.75, 1)) +
      metric('نقاط السيولة', stock.liquidity_score == null ? 'غير متاح' : num(stock.liquidity_score, 1) + '/15') +
      metric('نقاط الأخبار', stock.news_score == null ? 'غير متاح' : num(stock.news_score, 1) + '/±10') +
      '</div><h4>المخاطر وما قد يبطل الفكرة</h4>' + riskNotes(stock) +
      '<div class="rc-metrics">' + metric('الدعم التقريبي', num(stock.support, 3)) +
      metric('المقاومة التقريبية', num(stock.resistance, 3)) +
      metric('اختراق المقاومة', stock.breakout === true ? 'نعم' : stock.breakout === false ? 'لم يتأكد' : 'غير متاح') +
      '</div>' + newsBlock(stock.latest_material_news, 'آخر خبر جوهري') +
      newsBlock(stock.latest_news, 'آخر خبر مرتبط') +
      '</details></article>';
    return html;
  }

  function renderReport(data) {
    const root = $('aiResult');
    if (!root) return;

    const picks = Array.isArray(data.recommendations) ? data.recommendations : [];
    const watch = Array.isArray(data.watchlist) ? data.watchlist : [];
    const quality = data.data_quality || {};
    const excluded = Array.isArray(data.data_quality_details) ? data.data_quality_details : [];

    let html = '<style>' +
      '#aiResult.rc-report{background:transparent;border:0;padding:0;white-space:normal;line-height:1.65}' +
      '.rc-summary,.rc-card{background:#fff;border:1px solid #e1e8ef;border-radius:13px;padding:14px;margin:12px 0}' +
      '.rc-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}' +
      '.rc-card h3{margin:4px 0;font-size:19px}.rc-card-head small,.rc-muted,.rc-metric small,.rc-metric span{color:#687b8d}' +
      '.rc-rank{font-size:12px;color:#167653}.rc-score{background:#e8f7f0;border-radius:10px;padding:9px;text-align:center;min-width:82px}' +
      '.rc-score strong{display:block;font-size:21px;color:#167653}.rc-score small{font-size:11px}' +
      '.rc-pills{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}.rc-pills span{background:#eef3f7;border-radius:20px;padding:4px 9px;font-size:12px}' +
      '.rc-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}' +
      '.rc-metric{background:#f7fafc;border-radius:8px;padding:9px;min-width:0}.rc-metric small,.rc-metric strong,.rc-metric span{display:block;overflow-wrap:anywhere}' +
      '.rc-metric strong{font-size:15px;margin-top:3px}.rc-metric span{font-size:11px}' +
      '.rc-levels{border-top:1px solid #e4eaf0;margin-top:12px;padding-top:8px}.rc-card h4{margin:13px 0 6px}' +
      '.rc-details{border-top:1px solid #e4eaf0;margin-top:12px;padding-top:10px}.rc-details summary{cursor:pointer;font-weight:bold;color:#24506d}' +
      '.rc-reasons,.rc-risks{padding-right:20px;margin:7px 0}.rc-reasons li,.rc-risks li{margin:5px 0}.rc-risks{color:#8a4b16}' +
      '.rc-news{background:#f7fafc;border-radius:8px;padding:10px;margin:8px 0}.rc-news a{color:#176b9a}.rc-news small{display:block;color:#687b8d;margin-top:4px}' +
      '.rc-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}.rc-controls select{padding:9px;border:1px solid #ccd5dd;border-radius:8px;background:#fff}' +
      '.rc-section-title{margin:20px 0 8px}.rc-empty{padding:14px;background:#fff;border:1px solid #e1e8ef;border-radius:10px}' +
      '@media(max-width:420px){.rc-metrics{grid-template-columns:1fr}.rc-card-head{align-items:center}}' +
      '</style>';

    html += '<section class="rc-summary"><h3>ملخص جلسة التحليل</h3><div class="rc-metrics">' +
      metric('آخر جلسة', data.latest_session || 'غير متاح') +
      metric('وقت إنشاء التقرير', data.generated_at ? new Date(data.generated_at).toLocaleString('ar-EG') : 'غير متاح') +
      metric('الأسهم النشطة', data.active_stocks ?? 'غير متاح') +
      metric('الأسهم التي تم تحليلها', data.analyzed ?? 'غير متاح') +
      metric('الأسهم المرشحة', data.recommended_count ?? picks.length) +
      metric('بيانات قديمة', quality.stale ?? 0) +
      metric('لا توجد أسعار', quality.no_data ?? 0) +
      metric('تاريخ غير كافٍ', quality.insufficient_history ?? 0) +
      '</div><p class="rc-muted">' + esc(data.methodology || 'النتائج مبنية على بيانات الإغلاق المسجلة وليست بثًا لحظيًا.') + '</p></section>';

    html += '<div class="rc-controls"><label for="rcSort">ترتيب المرشحين:</label><select id="rcSort">' +
      '<option value="score">الأعلى درجة مركبة</option><option value="liquidity">الأعلى سيولة</option><option value="volume">الأعلى حجمًا</option></select></div>';

    html += '<h3 class="rc-section-title">الأسهم المستوفية لشروط الترشيح (' + picks.length + ')</h3>';
    html += '<div id="rcPicks">' + (picks.length ? picks.map((x, i) => card(x, i, 'pick')).join('') :
      '<div class="rc-empty">لا توجد أسهم استوفت شروط الترشيح في آخر جلسة. لن نملأ القائمة بأسهم غير مطابقة.</div>') + '</div>';

    html += '<details class="rc-watch"><summary>قائمة المتابعة غير المرشحة (' + watch.length + ')</summary>' +
      '<p class="rc-muted">هذه الأسهم لم تستوفِ شروط الترشيح الحالية، ولا تُعرض كتوصيات شراء.</p>' +
      (watch.length ? watch.map((x, i) => card(x, i, 'watch')).join('') : '<p>لا توجد أسهم في قائمة المتابعة.</p>') +
      '</details>';

    html += '<details class="rc-excluded"><summary>الأسهم المستبعدة بسبب جودة البيانات (' + excluded.length + ')</summary>' +
      (excluded.length ? '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th>السهم</th><th>سبب الاستبعاد</th><th>آخر تاريخ</th><th>عدد الجلسات</th></tr></thead><tbody>' +
        excluded.map(x => '<tr><td>' + esc(x.name || x.symbol) + ' (' + esc(x.symbol) + ')</td><td>' +
          esc(x.reason === 'stale' ? 'بيانات قديمة' : x.reason === 'no_data' ? 'لا توجد أسعار' : x.reason === 'insufficient_history' ? 'تاريخ غير كافٍ' : x.reason) +
          '</td><td>' + esc(x.last_date || '—') + '</td><td>' + esc(x.sessions_count ?? '—') + '</td></tr>').join('') +
        '</tbody></table></div>' : '<p>لا توجد أسماء مستبعدة في تفاصيل جودة البيانات.</p>') + '</details>';

    html += '<p class="rc-muted">تنبيه: الدرجة الفنية ليست احتمال نجاح إحصائيًا ولا ضمانًا للربح. مستويات الدخول والأهداف ووقف الخسارة تقديرات آلية من بيانات الإغلاق التاريخية، وقد لا تتحقق عند التنفيذ الفعلي. راجع الأخبار والسوق وأحدث الأسعار قبل أي قرار.</p>';

    root.innerHTML = html;
    root.classList.remove('hidden');
    root.classList.add('rc-report');

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