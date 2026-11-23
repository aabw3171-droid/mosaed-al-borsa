
(function () {
  'use strict';

  // منع تكرار تشغيل الملف
  if (window.__reco2Loaded) return;
  window.__reco2Loaded = true;

  const root = document.getElementById('approvedView');
  if (!root) {
    console.error('reco2: approvedView not found');
    return;
  }

  // إنشاء لوحة التوصيات
  let recoPanel = document.getElementById('recoPanel');

  if (!recoPanel) {
    recoPanel = document.createElement('div');
    recoPanel.id = 'recoPanel';
    recoPanel.className = 'hidden';
    root.appendChild(recoPanel);
  }

  // ربط لوحة التوصيات بنظام التنقل
  const originalPanel = window.panel;

  if (typeof originalPanel === 'function') {
    window.panel = function (name) {
      originalPanel(name);
      recoPanel.classList.toggle('hidden', name !== 'recoPanel');
    };
  }

  // إنشاء بطاقة التوصيات في الصفحة الرئيسية
  function createRecoCard() {
    const grid = document.querySelector('#homeGrid .grid');
    if (!grid || document.getElementById('recoHomeCard')) return;

    const card = document.createElement('div');
    card.id = 'recoHomeCard';
    card.className = 'card';
    card.style.cursor = 'pointer';
    card.innerHTML = `
      <div style="padding:16px">
        <div style="font-size:25px">📊</div>
        <h3>توصيات الأسهم</h3>
        <p>تحليل الأسهم النشطة وأفضل الفرص للجلسة القادمة</p>
        <button type="button">عرض التوصيات</button>
      </div>
    `;

    card.addEventListener('click', showReco);
    grid.appendChild(card);
  }

  // تجهيز لوحة التوصيات
  recoPanel.innerHTML = `
    <div style="padding:12px">
      <button id="recoBack" type="button">رجوع</button>
      <h2>توصيات الأسهم المصرية</h2>
      <p style="color:gray">
        التوصيات مبنية على بيانات الأسعار المتاحة، وليست ضمانًا للربح.
      </p>
      <button id="recoRefresh" type="button">تحديث التحليل</button>
      <div id="recoStatus" style="margin:14px 0"></div>
      <div id="recoBox"></div>
    </div>
  `;

  document.getElementById('recoBack').addEventListener('click', function () {
    if (typeof window.showHome === 'function') window.showHome();
  });

  document.getElementById('recoRefresh').addEventListener('click', showReco);

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c];
    });
  }

  function showMessage(message, isError) {
    const status = document.getElementById('recoStatus');
    if (!status) return;

    status.textContent = message;
    status.style.color = isError ? '#c62828' : 'inherit';
  }

  function getScore(item) {
    const value = Number(
      item.score ??
      item.totalScore ??
      item.points ??
      item.rating ??
      0
    );
    return Number.isFinite(value) ? value : 0;
  }

  function renderRows(title, rows, color) {
    if (!rows.length) {
      return `<h3>${title}</h3><p>لا توجد أسهم كافية للعرض.</p>`;
    }

    let html = `
      <h3 style="margin-top:22px">${title}</h3>
      <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="padding:8px">السهم</th>
            <th style="padding:8px">الرمز</th>
            <th style="padding:8px">التقييم</th>
          </tr>
        </thead>
        <tbody>
    `;

    rows.forEach(function (item) {
      const symbol = item.symbol || item.ticker || '';
      const name = item.name || item.company || symbol;
      const score = getScore(item);

      html += `
        <tr style="border-top:1px solid #ddd">
          <td style="padding:9px">${escapeHTML(name)}</td>
          <td style="padding:9px">${escapeHTML(symbol)}</td>
          <td style="padding:9px;color:${color};font-weight:bold">
            ${escapeHTML(score)}
          </td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    return html;
  }

  // تحميل البيانات وتحليل الأسهم
  async function showReco() {
    window.panel('recoPanel');

    const box = document.getElementById('recoBox');
    if (!box) return;

    box.innerHTML = '';
    showMessage('جارٍ تحميل الأسهم والأسعار...', false);

    try {
      if (typeof window.sb === 'undefined' || !window.sb) {
        throw new Error('اتصال قاعدة البيانات غير متاح. راجع إعداد Supabase.');
      }

      if (typeof window.scoreAll !== 'function') {
        throw new Error('دالة التحليل scoreAll غير موجودة. راجع تحميل ملف reco.js.');
      }

      // الأسهم النشطة فقط
      const st = await window.sb
        .from('stocks')
        .select('symbol,name')
        .eq('is_active', true)
        .limit(1000);

      if (st.error) {
        throw new Error('خطأ تحميل الأسهم: ' + st.error.message);
      }

      const stocks = st.data || [];

      if (!stocks.length) {
        throw new Error('لم يتم العثور على أسهم نشطة في جدول stocks.');
      }

      const names = {};
      stocks.forEach(function (stock) {
        if (stock.symbol) names[stock.symbol] = stock.name || stock.symbol;
      });

      // آخر 150 يومًا
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 150);
      const dateText = fromDate.toISOString().slice(0, 10);

      let allPrices = [];
      let page = 0;
      const pageSize = 1000;

      while (true) {
        const result = await window.sb
          .from('prices')
          .select('symbol,trade_date,high,low,close,volume')
          .gte('trade_date', dateText)
          .order('symbol', { ascending: true })
          .order('trade_date', { ascending: true })
          .range(page * pageSize, page * pageSize + pageSize - 1);

        if (result.error) {
          throw new Error('خطأ تحميل الأسعار: ' + result.error.message);
        }

        const batch = result.data || [];
        allPrices = allPrices.concat(batch);

        if (batch.length < pageSize) break;

        page++;
        if (page >= 100) {
          throw new Error('عدد سجلات الأسعار أكبر من الحد المتوقع.');
        }
      }

      if (!allPrices.length) {
        throw new Error('لا توجد أسعار في الفترة المطلوبة.');
      }

      // الاحتفاظ ببيانات الأسهم النشطة فقط
      const activeSymbols = new Set(stocks.map(function (s) {
        return s.symbol;
      }));

      allPrices = allPrices.filter(function (row) {
        return activeSymbols.has(row.symbol);
      });

      if (!allPrices.length) {
        throw new Error('لا توجد أسعار مطابقة للأسهم النشطة.');
      }

      showMessage('تم تحميل ' + stocks.length + ' سهم و' +
        allPrices.length + ' سجل سعر. جارٍ التحليل...', false);

      // تنفيذ التحليل
      const result = window.scoreAll(allPrices, names);

      if (!Array.isArray(result)) {
        throw new Error('نتيجة التحليل غير متوقعة. راجع دالة scoreAll في reco.js.');
      }

      if (!result.length) {
        throw new Error('لم ينتج التحليل أي توصيات. قد تكون البيانات غير كافية.');
      }

      const validRows = result.filter(function (item) {
        return item && (item.symbol || item.ticker);
      });

      if (!validRows.length) {
        throw new Error('نتيجة التحليل لا تحتوي على رموز أسهم.');
      }

      const best = validRows.slice().sort(function (a, b) {
        return getScore(b) - getScore(a);
      }).slice(0, 10);

      const weak = validRows.slice().sort(function (a, b) {
        return getScore(a) - getScore(b);
      }).slice(0, 5);

      box.innerHTML =
        renderRows('أفضل 10 فرص حسب نتيجة التحليل', best, '#16834a') +
        renderRows('أقل 5 أسهم حسب نتيجة التحليل', weak, '#c62828');

      showMessage(
        'اكتمل التحليل بنجاح — عدد الأسهم التي ظهرت في النتائج: ' +
        validRows.length,
        false
      );

    } catch (error) {
      console.error('Reco error:', error);
      box.innerHTML = `
        <div style="padding:12px;border:1px solid #d66;border-radius:8px">
          <strong>تعذر إنشاء التوصيات</strong>
          <p>${escapeHTML(error.message || error)}</p>
        </div>
      `;
      showMessage('حدث خطأ أثناء التحليل.', true);
    }
  }

  // إظهار بطاقة الصفحة الرئيسية
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createRecoCard);
  } else {
    createRecoCard();
  }

  window.showReco = showReco;

})();
