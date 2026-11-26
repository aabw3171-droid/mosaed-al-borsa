
(function () {
  if (typeof sb === 'undefined') return;

  const host = document.getElementById('adminView');
  if (!host) return;

  const G = id => document.getElementById(id);

  const N = s => String(s ?? '')
    .replace(/[\u064B-\u065F\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ـ\-_,.()]/g, ' ')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().toLowerCase();

  const num = v => {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;

    const s = String(v)
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[٬,\s%]/g, '')
      .replace('٫', '.');

    const n = Number(s);
    return isFinite(n) ? n : null;
  };

  const keys = {
    date: ['التاريخ', 'تاريخ الجلسة', 'تاريخ التداول', 'تاريخ', 'date'],
    symbol: ['كود السهم', 'رمز السهم', 'symbol', 'ticker', 'code'],
    name: ['اسم السهم', 'اسم الشركة', 'السهم', 'الشركة', 'name', 'company'],
    open: ['سعر الفتح', 'فتح', 'افتتاح', 'open'],
    high: ['اعلى سعر', 'اعلى', 'high'],
    low: ['اقل سعر', 'ادنى سعر', 'ادنى', 'low'],
    close: ['سعر الاغلاق', 'الاغلاق', 'اغلاق', 'اقفال', 'close', 'اخر سعر', 'last'],
    volume: ['حجم التداول', 'حجم', 'كمية', 'volume', 'vol']
  };

  // أسماء بديلة لأسهم موجودة بالفعل في قاعدة البيانات
  const aliases = new Map([
    // أم بي للهندسة
    ['ام بي للهندسه', 'MBEG'],
    ['ام بي للهندسه m b', 'MBEG'],
    ['ام بي للهندسهm b', 'MBEG'],

    // الصعيد للمقاولات
    ['الصعيد العامه للمقاولات والاستثمار العقاري sccd', 'UEGC'],
    ['الصعيد العامه للمقاولات والاستثمار العقاري', 'UEGC'],

    // بنك قناة السويس
    ['بنك قناة السويس شركه مساهمه مصريه', 'CANA'],
    ['بنك قناة السويس', 'CANA'],

    // النيل للأدوية
    ['النيل للادويه والصناعات الكيماويه النيل', 'NIPH'],
    ['النيل للادويه والصناعات الكيماويه', 'NIPH'],

    // بيراميزا
    ['بيراميزا للفنادق والقرى السياحيه بيراميزا', 'PHTV'],
    ['بيراميزا للفنادق والقرى السياحيه', 'PHTV'],

    // الإسكندرية للخدمات الطبية
    ['الاسكندريه للخدمات الطبيه المركز الطبي الجديد الاسكندريه', 'AMES'],
    ['الاسكندريه للخدمات الطبيه المركز الطبي الجديد', 'AMES'],

    // إيجيترانس
    ['المصريه لخدمات النقل والتجاره ايجيترانس نوسكو', 'ETRS'],
    ['المصريه لخدمات النقل والتجاره ايجيترانس', 'ETRS'],

    // راميدا
    ['العاشر من رمضان للصناعات الدوائيه والمستحضرات تشخيصيه راميدا', 'RMDA'],
    ['العاشر من رمضان للصناعات الدوائيه والمستحضرات التشخيصيه راميدا', 'RMDA'],

    // مينا فارم
    ['مينا فارم للادويه و الصناعات الكيماويه', 'MIPH'],
    ['مينا فارم للادويه والصناعات الكيماويه', 'MIPH'],
    ['مينا فارم للادويه والصناعات الكيماويه مينا فارم', 'MIPH'],

    // بنك فيصل بالجنيه
    ['بنك فيصل الاسلامي المصريه بالجنيه', 'FAIT'],
    ['بنك فيصل الاسلامي المصري بالجنيه المصري', 'FAIT'],

    // الوادي العالمية
    ['الوادي العالميه للاستثمار و التنميه', 'ELWA'],
    ['الوادي العالميه للاستثمار والتنميه', 'ELWA'],

    // إم إن تي تك
    ['ام ان تي تيك القابضه للاستثمارات الماليه', 'HALN'],
    ['ام ان تي تك القابضه للاستثمارات الماليه', 'HALN'],

    // جي بي آي
    ['جي بي اي للنمو العمراني', 'GPIM'],
    ['جي بي اي للنمو العمراني والتطوير', 'GPIM'],

    // جي إم سي
    ['مجموعه جي ام سي للاستثمارات الصناعيه والتجاريه الماليه', 'GMCI'],
    ['مجموعه جي ام سي للاستثمارات الصناعيه والتجاريه', 'GMCI'],

    // الخزف والصيني
    ['العامه لمنتجات الخزف والصيني', 'PRCL'],
    ['العامه للخزف والصيني', 'PRCL'],

    // أليكوا
    ['الاستثمار العقاري العربي اليكو', 'AREH'],
    ['الاستثمار العقاري العربي اليكوا', 'AREH'],

    // كوبر
    ['كوبر للاستثمار التجاري والتطوير العقاري', 'COPR'],
    ['كوبر للاستثمار التجارى و التطوير العقارى', 'COPR'],

    // سيرا
    ['القاهره للاستثمار و التنميه العقاريه سيرا للتعليم', 'CIRA'],
    ['القاهره للاستثمار والتنميه العقاريه سيرا', 'CIRA'],

    // دومتي
    ['الصناعات الغذائيه العربيه دومتى', 'DOMT'],
    ['العربيه للصناعات الغذائيه دومتي', 'DOMT'],

    // الملتقى العربي
    ['الملتقي العربي للاستثمارات', 'AMIA'],
    ['الملتقى العربي للاستثمارات', 'AMIA'],

    // العربية لإدارة وتطوير الأصول
    ['الشركه العربيه لاداره وتطوير الاصول', 'ACAMD'],
    ['العربيه لاداره وتطوير الاصول', 'ACAMD'],

    // مدينة الإنتاج الإعلامي
    ['المصريه لمدينه الانتاج الاعلامي', 'MPRC'],
    ['المصريه لمدينة الانتاج الاعلامي', 'MPRC'],

    // تعليم
    ['تعليم لخدمات الاداره', 'TALM'],
    ['تعليم لخدمات الادارة', 'TALM'],

    // نهر الخير
    ['نهر الخير للتنميه والاستثمار الزراعي والبيئي', 'KRDI'],
    ['الخير ريفر للتنميه والاستثمار الزراعي والبيئي', 'KRDI'],

    // بلتون
    ['بايونيرز بروبرتيز', 'BTFH'],

    // مستشفى كليوباترا
    ['مستشفي كليوباترا', 'CLHO'],
    ['مستشفى كليوباترا', 'CLHO'],

    // مصرف أبوظبي الإسلامي
    ['مصرف ابو ظبي الاسلامي', 'ADIB'],
    ['مصرف ابوظبي الاسلامي مصر', 'ADIB'],

    // كاتاليست
    ['كاتليست بارتنرز ميدل ايست', 'CPME'],
    ['كاتاليست بارتنرز ميدل ايست', 'CPME'],

    // أودن للاستثمارات المالية
    ['اودن للاستثمارات الماليه', 'ODIN'],
    // أسماء إضافية مؤكدة من رموز موجودة بجدول الأسهم النشطة فقط
    ['العامة لاستصلاح الاراضي و التنمية و التعمير', 'AALR'],
    ['العامة لاستصلاح الأراضي والتنمية والتعمير', 'AALR'],
    ['أم بي للهندسة', 'MBEG'],
    ['بنك قناة السويس شركة مساهمة مصرية', 'CANA'],
    ['بيراميزا للفنادق والقرى السياحية بيراميزا', 'PHTV'],
    ['مجموعة جى أم سى للاستثمارات الصناعية و التجارية المالية', 'GMCI'],
    ['شركة مستشفى كليوباترا', 'CLHO'],
    ['مصرف أبو ظبي الإسلامي مصر', 'ADIB'],
    ['البنك التجاري الدولي مصر سي اي بي', 'COMI'],
    ['تااليم مانجمنت سيرفيسز تعليم لخدمات الإدارة', 'TALM'],
    ['نهر الخير للتنمية والأستثمار الزراعي والخدمات البيئية', 'KRDI']
  ].map(([name, symbol]) => [N(name), symbol]));

  function loadXLSX() {
    if (window.XLSX) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('تعذر تحميل مكتبة Excel'));
      document.head.appendChild(s);
    });
  }

  function detect(rows) {
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const headers = (rows[i] || []).map(N);
      const map = {};

      for (const field of Object.keys(keys)) {
        map[field] = headers.findIndex(h =>
          keys[field].some(k => h === N(k))
        );
      }

      if (map.close >= 0 && (map.symbol >= 0 || map.name >= 0)) {
        return { row: i, map };
      }
    }

    return null;
  }

  function dateISO(v) {
    if (v instanceof Date && !isNaN(v)) {
      return v.getFullYear() + '-' + String(v.getMonth()+1).padStart(2,'0') + '-' + String(v.getDate()).padStart(2,'0');
    }
    const raw = String(v ?? '').trim().replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    const serial = typeof v === 'number' ? v : (/^\\d{5}(?:\\.\\d+)?$/.test(raw) ? Number(raw) : null);
    if (serial != null && serial > 30000 && serial < 80000) {
      const d = new Date(Date.UTC(1899,11,30) + Math.round(serial)*86400000);
      return d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0') + '-' + String(d.getUTCDate()).padStart(2,'0');
    }
    let m = raw.match(/^(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    m = raw.match(/^(\\d{1,2})[-/.](\\d{1,2})[-/.](\\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return null;
  }

  const card = document.createElement('div');
  card.style.cssText = 'margin-top:18px;padding:16px;border-top:1px solid #ddd';

  card.innerHTML = `
    <h3>📥 استيراد أسعار Excel</h3>
    <label>تاريخ الجلسة</label>
    <input type="date" id="upDate" style="display:block;width:100%;padding:12px;margin:8px 0">
    <button type="button" id="upPick" style="padding:12px;width:100%">اختيار ملف Excel</button>
    <input type="file" id="upFile" accept=".xlsx,.xls,.csv" style="display:none">
    <div id="upOut" style="margin-top:14px"></div>
  `;

  host.appendChild(card);

  G('upDate').value = '';
  G('upDate').placeholder = 'يُقرأ التاريخ تلقائيًا من ملف Excel';

  const out = G('upOut');
  let pending = null;

  function message(t, error) {
    out.textContent = t;
    out.style.color = error ? '#b42318' : '#16783b';
  }

  G('upPick').onclick = () => G('upFile').click();

  G('upFile').onchange = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    try {
      pending = null;
      message('جاري قراءة الملف...', false);

      await loadXLSX();

      const buffer = await file.arrayBuffer();

      const wb = /\.csv$/i.test(file.name)
        ? XLSX.read(new TextDecoder().decode(buffer), { type: 'string' })
        : XLSX.read(buffer, { type: 'array', cellDates: true });

      const rows = XLSX.utils.sheet_to_json(
        wb.Sheets[wb.SheetNames[0]],
        { header: 1, defval: null, raw: true }
      );

      const detected = detect(rows);

      if (!detected) {
        message('لم يتم التعرف على الأعمدة. تأكد من وجود اسم السهم وسعر الإغلاق.', true);
        return;
      }

      const result = await sb.from('stocks')
        .select('symbol,name')
        .eq('is_active', true)
        .limit(1000);

      if (result.error) throw result.error;

      const stocks = result.data || [];
      const bySymbol = new Map();
      const byName = new Map();

      stocks.forEach(s => {
        bySymbol.set(String(s.symbol).toUpperCase(), s.symbol);

        if (s.name) {
          const key = N(s.name);
          if (!byName.has(key)) byName.set(key, []);
          byName.get(key).push(s.symbol);
        }
      });

      const activeSymbols = new Set(stocks.map(s => s.symbol));

      const get = (row, field) => {
        const i = detected.map[field];
        return i == null || i < 0 ? null : row[i];
      };

      const dateDefault = G('upDate').value || null;
      const valid = [];
      const unmatched = [];
      const used = new Set();

      for (let i = detected.row + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        const rawSymbol = get(row, 'symbol');
        const rawName = get(row, 'name');
        const close = num(get(row, 'close'));

        if (close == null && rawName == null && rawSymbol == null) continue;

        let symbol = null;

        if (rawSymbol) {
          symbol = bySymbol.get(String(rawSymbol).trim().toUpperCase()) || null;
        }

        if (!symbol && rawName) {
          const name = N(rawName);
          const compactAliasName = name.replace(/\\s+/g, '');
          const aliasSymbol = aliases.get(name) || aliases.get(compactAliasName) ||
            aliases.get(N(rawName).replace(/\\s+/g, ''));

          if (aliasSymbol && activeSymbols.has(aliasSymbol)) {
            symbol = aliasSymbol;
          }

          if (!symbol) {
            const exact = byName.get(name);
            if (exact && exact.length === 1) symbol = exact[0];
          }

          // مطابقة جزئية محافظة بعد إزالة المسافات أيضًا؛
          // تعالج اختلافات كتابة الاسم مثل "الجيزةالعامة" و"الجيزة العامة".
          // لا تعتمد إلا عند وجود رمز واحد فقط، وتترك الأسماء المكررة للمراجعة.
          if (!symbol && name.replace(/\\s+/g, '').length >= 9) {
            const compactName = name.replace(/\\s+/g, '');
            const partialMatches = stocks
              .filter(s => {
                if (!s.name) return false;
                const stockName = N(s.name);
                const compactStockName = stockName.replace(/\\s+/g, '');
                return compactStockName.length >= 9 &&
                  (compactName.includes(compactStockName) ||
                   compactStockName.includes(compactName));
              })
              .map(s => s.symbol)
              .filter((v, i, a) => a.indexOf(v) === i);

            if (partialMatches.length === 1) {
              symbol = partialMatches[0];
            }
          }
        }

        if (!symbol || !(close > 0)) {
          unmatched.push(String(rawName || rawSymbol || 'غير معروف'));
          continue;
        }

        const rawDate = get(row, 'date');
        const parsedFileDate = detected.map.date >= 0 ? dateISO(rawDate) : null;
        const tradeDate = parsedFileDate || (rawDate == null || rawDate === '' ? dateDefault : null);

        if (!tradeDate) {
          unmatched.push(String(rawName || symbol) + ' (التاريخ غير موجود)');
          continue;
        }

        const key = symbol + '|' + tradeDate;
        if (used.has(key)) continue;
        used.add(key);

        const open = num(get(row, 'open'));
        const high = num(get(row, 'high'));
        const low = num(get(row, 'low'));
        const volume = num(get(row, 'volume'));

        if (
          open == null || high == null ||
          low == null || volume == null
        ) {
          unmatched.push(String(rawName || symbol) + ' (بيانات ناقصة)');
          continue;
        }

        valid.push({
          symbol,
          trade_date: tradeDate,
          open,
          high,
          low,
          close,
          volume
        });
      }

      if (!valid.length) {
        message('لم يتم العثور على أسهم صالحة للحفظ. راجع أسماء الأسهم والأعمدة.', true);
        return;
      }

      pending = valid;
      out.innerHTML = '';

      const summary = document.createElement('p');
      summary.textContent =
        `تمت قراءة ${valid.length} سهمًا صالحًا. غير مطابق أو ناقص: ${unmatched.length}. تاريخ البيانات: ${valid[0].trade_date}`;
      out.appendChild(summary);

      if (unmatched.length) {
        const warning = document.createElement('p');
        warning.style.color = '#a15c00';
        warning.textContent =
          'لم يتم حفظ هذه الأسماء (' + unmatched.length + '): ' +
          unmatched.slice(0, 100).join('، ');
        out.appendChild(warning);
      }

      const table = document.createElement('table');
      table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px';
      table.innerHTML =
        '<tr><th>السهم</th><th>فتح</th><th>أعلى</th><th>أدنى</th><th>إغلاق</th><th>حجم</th></tr>';

      valid.slice(0, 8).forEach(x => {
        const tr = document.createElement('tr');
        [x.symbol, x.open, x.high, x.low, x.close, x.volume].forEach(v => {
          const td = document.createElement('td');
          td.textContent = v;
          td.style.padding = '7px';
          tr.appendChild(td);
        });
        table.appendChild(tr);
      });

      out.appendChild(table);

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `تأكيد حفظ ${valid.length} سهم`;
      button.style.cssText =
        'display:block;width:100%;padding:16px;margin-top:15px;background:#16803c;color:white;border:0;border-radius:8px;font-size:17px;font-weight:bold';

      button.onclick = async () => {
        if (!pending) return;

        button.disabled = true;
        button.textContent = 'جاري الحفظ...';

        try {
          for (let i = 0; i < pending.length; i += 100) {
            const part = pending.slice(i, i + 100);
            const saved = await sb.from('prices').upsert(part, {
              onConflict: 'symbol,trade_date'
            });
            if (saved.error) throw saved.error;
          }

          pending = null;
          message('تم حفظ البيانات بنجاح. جارٍ تحديث بيانات السوق...', false);
          if (typeof window.showMarket === 'function') {
            await window.showMarket();
          } else if (typeof window.loadMarket === 'function') {
            await window.loadMarket();
          }
          const done = document.createElement('p');
          done.textContent = 'اكتمل الاستيراد. افتح صفحة السوق المصري إذا لم تتحدث تلقائيًا.';
          out.appendChild(done);

        } catch (err) {
          button.disabled = false;
          button.textContent = 'إعادة محاولة الحفظ';
          message('خطأ أثناء الحفظ: ' + err.message, true);
        }
      };

      out.appendChild(button);

    } catch (err) {
      message('حدث خطأ: ' + (err.message || err), true);
    }
  };
})();
