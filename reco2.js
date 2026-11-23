
/* نظام عرض التوصيات - النسخة المصححة */
(function () {
  'use strict';

  if (window.__reco2Loaded) return;
  window.__reco2Loaded = true;

  const root = document.getElementById('approvedView');

  if (!root) {
    console.error('reco2: approvedView not found');
    return;
  }

  let recoPanel = document.getElementById('recoPanel');

  if (!recoPanel) {
    recoPanel = document.createElement('div');
    recoPanel.id = 'recoPanel';
    recoPanel.className = 'hidden';
    root.appendChild(recoPanel);
  }

  // حفظ نظام التنقل الأصلي
  const originalPanel = window.panel;

  // إصلاح التنقل بين الصفحات
  window.panel = function (name) {
    if (name === 'recoPanel') {
      ['homeGrid', 'marketPanel', 'stockPanel'].forEach(
        function (id) {
          const element = document.getElementById(id);
          if (element) element.classList.add('hidden');
        }
      );

      recoPanel.classList.remove('hidden');
      window.scrollTo({ top: 0 });
      return;
    }

    recoPanel.classList.add('hidden');

    if (typeof originalPanel === 'function') {
      originalPanel(name);
    }
  };

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(
      /[&<>"']/g,
      function (c) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        }[c];
      }
    );
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

  function showMessage(message, isError) {
    const status = document.getElementById('recoStatus');
    if (!status) return;

    status.textContent = message;
    status.style.color = isError ? '#c62828' : '#167653';
  }

  function renderRows(title, rows, color) {
    let html = `
      <h3 style="margin-top:25px">${title}</h3>
    `;

    if (!rows.length) {
      return html + '<p>لا توجد أسهم كافية للعرض.</p>';
    }

    html += `
      <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th>السهم</th>
            <th>الرمز</th>
            <th>الإغلاق</th>
            <th>التقييم</th>
            <th>RSI</th>
          </tr>
        </thead>
        <tbody>
    `;

    rows.forEach(function (item) {
      const symbol = item.symbol || '';
      const name = item.name || symbol;
      const score = getScore(item);

      html += `
        <tr style="border-top:1px solid #ddd">
          <td style="padding:9px">
            ${escapeHTML(name)}
          </td>
          <td style="padding:9px">
            ${escapeHTML(symbol)}
          </td>
          <td style="padding:9px">
            ${escapeHTML(
              item.lastPrice == null
                ? '-'
                : Number(item.lastPrice).toFixed(2)
            )}
          </td>
          <td style="padding:9px;color:${color};font-weight:bold">
            ${escapeHTML(score)}
          </td>
          <td style="padding:9px">
            ${escapeHTML(
              item.rsi == null
                ? '-'
                : Number(item.rsi).toFixed(1)
            )}
          </td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';

    return html;
  }

  // إنشاء واجهة التوصيات
  recoPanel.innerHTML = `
    <section class="card" style="padding:18px">
      <button id="recoBack" type="button">رجوع</button>

      <h2 style="margin-top:20px">
        توصيات الأسهم المصرية
      </h2>

      <p style="color:gray;line-height:1.9">
        التوصيات مبنية على بيانات الأسعار المتاحة،
        وليست ضمانًا للربح.
      </p>

      <button id="recoRefresh" type="button">
        تحديث التحليل
      </button>

      <div id="recoStatus" style="margin:15px 0"></div>

      <div id="recoBox"></div>
    </section>
  `;

  document.getElementById('recoBack').onclick = function () {
    if (typeof window.showHome === 'function') {
      window.showHome();
    } else {
      window.panel('homeGrid');
    }
  };

  document.getElementById('recoRefresh').onclick = showReco;

  // إنشاء بطاقة التوصيات الرئيسية
  function createRecoCard() {
    const grid = document.querySelector('#homeGrid .grid');

    if (!grid || document.getElementById('recoHomeCard')) {
      return;
    }

    const card = document.createElement('div');
    card.id = 'recoHomeCard';
    card.className = 'card';
    card.style.cursor = 'pointer';

    card.innerHTML = `
      <div style="padding:16px">
        <div style="font-size:25px">📊</div>
        <h3>توصيات الأسهم</h3>
        <p>
          تحليل الأسهم النشطة وأفضل الفرص للجلسة القادمة
        </p>
        <button type="button">عرض التوصيات</button>
      </div>
    `;

    card.addEventListener('click', showReco);
    grid.appendChild(card);
  }

  // تنفيذ التحليل
  async function showReco() {
    window.panel('recoPanel');

    const box = document.getElementById('recoBox');
    if (!box) return;

    box.innerHTML = '';

    const refreshButton =
      document.getElementById('recoRefresh');

    if (refreshButton) refreshButton.disabled = true;

    showMessage('جارٍ تحميل الأسهم والأسعار...', false);

    try {
      const db = window.sb;

      if (!db) {
        throw new Error(
          'اتصال قاعدة البيانات غير متاح. راجع إعداد Supabase.'
        );
      }

      if (typeof window.scoreAll !== 'function') {
        throw new Error(
          'دالة التحليل غير موجودة. تأكد من تحميل reco.js.'
        );
      }

      // تحميل الأسهم النشطة
      const stockResult = await db
        .from('stocks')
        .select('symbol,name')
        .eq('is_active', true)
        .limit(1000);

      if (stockResult.error) {
        throw new Error(
          'خطأ تحميل الأسهم: ' +
          stockResult.error.message
        );
      }

      const stocks = stockResult.data || [];

      if (!stocks.length) {
        throw new Error('لا توجد أسهم نشطة في قاعدة البيانات.');
      }

      const names = {};

      stocks.forEach(function (stock) {
        if (stock.symbol) {
          names[stock.symbol] = stock.name || stock.symbol;
        }
      });

      // تحميل أسعار آخر 150 يومًا
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 150);

      const dateText = fromDate.toISOString().slice(0, 10);

      let allPrices = [];
      let page = 0;
      const pageSize = 1000;

      while (true) {
        const priceResult = await db
          .from('prices')
          .select(
            'symbol,trade_date,high,low,close,volume'
          )
          .gte('trade_date', dateText)
          .order('symbol', { ascending: true })
          .order('trade_date', { ascending: true })
          .range(
            page * pageSize,
            page * pageSize + pageSize - 1
          );

        if (priceResult.error) {
          throw new Error(
            'خطأ تحميل الأسعار: ' +
            priceResult.error.message
          );
        }

        const batch = priceResult.data || [];

        allPrices = allPrices.concat(batch);

        if (batch.length < pageSize) break;

        page++;

        if (page >= 100) {
          throw new Error(
            'عدد سجلات الأسعار تجاوز الحد المتوقع.'
          );
        }
      }

      if (!allPrices.length) {
        throw new Error('لا توجد أسعار في الفترة المطلوبة.');
      }

      // فلترة الأسهم النشطة
      const activeSymbols = new Set(
        stocks.map(s => s.symbol)
      );

      allPrices = allPrices.filter(function (row) {
        return activeSymbols.has(row.symbol);
      });

      if (!allPrices.length) {
        throw new Error(
          'لا توجد أسعار مطابقة للأسهم النشطة.'
        );
      }

      showMessage(
        'تم تحميل ' + stocks.length +
        ' سهم و' + allPrices.length +
        ' سجل سعر. جارٍ التحليل...',
        false
      );

      // تشغيل التحليل
      const results = window.scoreAll(allPrices, names);

      if (!Array.isArray(results)) {
        throw new Error('نتيجة التحليل غير صحيحة.');
      }

      const validRows = results.filter(function (item) {
        return item && item.symbol;
      });

      if (!validRows.length) {
        throw new Error(
          'لم ينتج التحليل توصيات. تأكد من كفاية بيانات الأسعار.'
        );
      }

      const sorted = validRows.slice().sort(
        (a, b) => getScore(b) - getScore(a)
      );

      const best = sorted.slice(0, 10);

      const weak = sorted
        .slice()
        .reverse()
        .slice(0, 5);

      box.innerHTML =
        renderRows(
          'أفضل 10 فرص حسب نتيجة التحليل',
          best,
          '#16834a'
        ) +
        renderRows(
          'أقل 5 أسهم حسب نتيجة التحليل',
          weak,
          '#c62828'
        );

      showMessage(
        'اكتمل التحليل بنجاح. عدد الأسهم التي ظهرت: ' +
        validRows.length,
        false
      );

    } catch (error) {
      console.error('Reco error:', error);

      box.innerHTML = `
        <div style="
          padding:14px;
          border:1px solid #d66;
          border-radius:8px;
          color:#a33
        ">
          <strong>تعذر إنشاء التوصيات</strong>
          <p>${escapeHTML(error.message || error)}</p>
        </div>
      `;

      showMessage('حدث خطأ أثناء التحليل.', true);

    } finally {
      if (refreshButton) {
        refreshButton.disabled = false;
      }
    }
  }

  window.showReco = showReco;

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      createRecoCard
    );
  } else {
    createRecoCard();
  }

})();
