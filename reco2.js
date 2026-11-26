
/* نظام توصيات الأسهم مع تفاصيل السهم - إصلاح جلب أحدث الأسعار */
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

  const originalPanel = window.panel;

  window.panel = function (name) {
    if (name === 'recoPanel') {
      ['homeGrid', 'marketPanel', 'stockPanel'].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      });

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
    let html = '<h3 style="margin-top:25px">' +
      escapeHTML(title) + '</h3>';

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
            <button
              type="button"
              class="sec recoStockLink"
              data-symbol="${escapeHTML(symbol)}"
              style="padding:7px 9px;cursor:pointer"
            >${escapeHTML(name)}</button>
          </td>
          <td style="padding:9px">${escapeHTML(symbol)}</td>
          <td style="padding:9px">
            ${item.lastPrice == null ? '-' : Number(item.lastPrice).toFixed(2)}
          </td>
          <td style="padding:9px;color:${color};font-weight:bold">
            ${escapeHTML(score)}
          </td>
          <td style="padding:9px">
            ${item.rsi == null ? '-' : Number(item.rsi).toFixed(1)}
          </td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    return html;
  }

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
      <div id="recoDetail" class="hidden"></div>
    </section>
  `;

  const detailBox = document.getElementById('recoDetail');
  const listBox = document.getElementById('recoBox');

  let currentRows = [];

  listBox.addEventListener('click', function (event) {
    const button = event.target.closest('.recoStockLink');

    if (!button) return;

    const symbol = button.getAttribute('data-symbol');

    const selected = currentRows.find(function (item) {
      return String(item.symbol) === String(symbol);
    });

    if (selected) {
      showDetails(selected);
    } else {
      showMessage('لم يتم العثور على بيانات السهم.', true);
    }
  });

  function backToRecommendations() {
    detailBox.classList.add('hidden');
    listBox.classList.remove('hidden');
    window.scrollTo({ top: 0 });
  }

  function showDetails(item) {
    listBox.classList.add('hidden');
    detailBox.classList.remove('hidden');

    detailBox.innerHTML = `
      <button type="button" id="detailBack" class="sec">
        رجوع للتوصيات
      </button>
      <h3>${escapeHTML(item.name || item.symbol)}</h3>
      <p>جارٍ تحميل تفاصيل السهم...</p>
    `;

    document.getElementById('detailBack').onclick =
      backToRecommendations;

    window.scrollTo({ top: 0 });

    loadStockDetails(item);
  }

  async function loadStockDetails(item) {
    try {
      const db = window.sb;

      if (!db) {
        throw new Error('اتصال قاعدة البيانات غير متاح.');
      }

      // جلب أحدث 150 جلسة أولاً
      const result = await db
        .from('prices')
        .select('trade_date,high,low,close,volume')
        .eq('symbol', item.symbol)
        .order('trade_date', { ascending: false })
        .limit(150);

      if (result.error) throw result.error;

      // إعادة ترتيب البيانات من الأقدم إلى الأحدث لحساب المؤشرات
      const data = (result.data || []).slice().reverse();

      if (data.length < 30) {
        throw new Error('بيانات الأسعار غير كافية لهذا السهم.');
      }

      const close = data.map(x => Number(x.close));
      const high = data.map(x => Number(x.high || x.close));
      const low = data.map(x => Number(x.low || x.close));
      const volume = data.map(x => Number(x.volume || 0));

      const n = data.length;
      const last = close[n - 1];
      const previous = close[n - 2];

      const change = previous
        ? ((last - previous) / previous) * 100
        : 0;

      const avg20 = window.sma
        ? window.sma(close, 20)[n - 1]
        : null;

      const avg50 = window.sma
        ? window.sma(close, 50)[n - 1]
        : null;

      const rsiValue = window.rsi
        ? window.rsi(close, 14)
        : item.rsi;

      const macdValue = window.macd
        ? window.macd(close)
        : null;

      const support20 = Math.min.apply(null, low.slice(-20));
      const resistance20 = Math.max.apply(null, high.slice(-20));

      const avgVolumeValues = volume.slice(-21, -1);

      const avgVolume = avgVolumeValues.length
        ? avgVolumeValues.reduce((a, b) => a + b, 0) /
          avgVolumeValues.length
        : 0;

      let trend = 'عرضي / غير حاسم';

      if (avg20 != null && avg50 != null) {
        if (last > avg20 && avg20 > avg50) {
          trend = 'اتجاه صاعد';
        } else if (last < avg20 && avg20 < avg50) {
          trend = 'اتجاه هابط';
        }
      }

      const reasons = Array.isArray(item.why || item.reasons)
        ? (item.why || item.reasons)
        : [];

      let html = `
        <button type="button" id="detailBack2" class="sec">
          رجوع للتوصيات
        </button>

        <h2 style="margin-top:20px">
          ${escapeHTML(item.name || item.symbol)}
        </h2>

        <p style="color:#718092">
          رمز التداول: ${escapeHTML(item.symbol)}
        </p>

        <div class="kv">
          <div>
            <small>آخر إغلاق</small>
            <strong>${last.toFixed(2)}</strong>
          </div>

          <div>
            <small>تاريخ السعر</small>
            <strong>${escapeHTML(data[n - 1].trade_date)}</strong>
          </div>

          <div>
            <small>التغير عن الجلسة السابقة</small>
            <strong style="color:${change >= 0 ? '#16834a' : '#c62828'}">
              ${change > 0 ? '+' : ''}${change.toFixed(2)}%
            </strong>
          </div>

          <div>
            <small>نقاط التحليل (من -5 إلى +5)</small>
            <strong>${escapeHTML(getScore(item))}</strong>
          </div>

          <div>
            <small>الاتجاه</small>
            <strong>${escapeHTML(trend)}</strong>
          </div>

          <div>
            <small>RSI (14)</small>
            <strong>${rsiValue == null ? '-' : Number(rsiValue).toFixed(1)}</strong>
          </div>

          <div>
            <small>متوسط 20 جلسة</small>
            <strong>${avg20 == null ? '-' : avg20.toFixed(2)}</strong>
          </div>

          <div>
            <small>متوسط 50 جلسة</small>
            <strong>${avg50 == null ? '-' : avg50.toFixed(2)}</strong>
          </div>

          <div>
            <small>الدعم - آخر 20 جلسة</small>
            <strong>${support20.toFixed(2)}</strong>
          </div>

          <div>
            <small>المقاومة - آخر 20 جلسة</small>
            <strong>${resistance20.toFixed(2)}</strong>
          </div>

          <div>
            <small>حجم آخر جلسة</small>
            <strong>${volume[n - 1].toLocaleString('en-US')}</strong>
          </div>

          <div>
            <small>متوسط حجم التداول</small>
            <strong>${Math.round(avgVolume).toLocaleString('en-US')}</strong>
          </div>

          ${
            macdValue && macdValue.h != null
              ? `<div>
                  <small>MACD Histogram</small>
                  <strong>${Number(macdValue.h).toFixed(4)}</strong>
                </div>`
              : ''
          }
        </div>

        <h3>أسباب تقييم السهم</h3>

        <ul>
          ${
            reasons.length
              ? reasons.map(x => '<li>' + escapeHTML(x) + '</li>').join('')
              : '<li>لا توجد أسباب تفصيلية مسجلة.</li>'
          }
        </ul>
      `;

      if (window.chartSVG && window.sma) {
        const s20 = window.sma(close, 20);
        const s50 = window.sma(close, 50);
        const k = Math.min(n, 90);

        html += `
          <h3>الرسم البياني ومتوسطات الحركة</h3>
          ${window.chartSVG(
            data.slice(-k).map(x => x.trade_date),
            close.slice(-k),
            s20.slice(-k),
            s50.slice(-k)
          )}
        `;
      }

      html += `
        <div style="
          background:#fff7e6;
          padding:14px;
          border-radius:9px;
          margin-top:18px;
          line-height:1.9
        ">
          <strong>تنبيه مهم</strong>
          <p>
            هذه التفاصيل محسوبة من بيانات الأسعار المتاحة.
            سعر الدخول والأهداف ووقف الخسارة ونسبة الثقة
            لم يتم حسابها بعد في محرك التوصيات.
            لا تعتبر هذه البيانات أمر شراء أو بيع.
          </p>
        </div>
      `;

      detailBox.innerHTML = html;

      document.getElementById('detailBack2').onclick =
        backToRecommendations;

    } catch (error) {
      detailBox.innerHTML = `
        <button type="button" id="detailBack3" class="sec">
          رجوع للتوصيات
        </button>

        <p style="color:#b33">
          تعذر تحميل التفاصيل:
          ${escapeHTML(error.message || error)}
        </p>
      `;

      document.getElementById('detailBack3').onclick =
        backToRecommendations;
    }
  }

  document.getElementById('recoBack').onclick = function () {
    if (typeof window.showHome === 'function') {
      window.showHome();
    } else {
      window.panel('homeGrid');
    }
  };

  document.getElementById('recoRefresh').onclick = showReco;

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
        <p>تحليل الأسهم النشطة وأفضل الفرص للجلسة القادمة</p>
        <button type="button">عرض التوصيات</button>
      </div>
    `;

    card.addEventListener('click', showReco);
    grid.appendChild(card);
  }

  async function showReco() {
    window.panel('recoPanel');

    detailBox.classList.add('hidden');
    listBox.classList.remove('hidden');
    listBox.innerHTML = '';
    currentRows = [];

    const refreshButton = document.getElementById('recoRefresh');

    if (refreshButton) refreshButton.disabled = true;

    showMessage('جارٍ تحميل الأسهم والأسعار...', false);

    try {
      const db = window.sb;

      if (!db) {
        throw new Error('اتصال قاعدة البيانات غير متاح.');
      }

      if (typeof window.scoreAll !== 'function') {
        throw new Error('دالة التحليل غير موجودة. تأكد من تحميل reco.js.');
      }

      const { data, error } = await db.functions.invoke(
        'egx-ai-analysis',
        { body: {} }
      );

      if (error) {
        throw new Error('تعذر تشغيل محرك التحليل الموحد: ' + error.message);
      }

      if (!data || data.error) {
        throw new Error(data && data.error ? data.error : 'لم تصل نتيجة التحليل.');
      }

      const latestDate = data.latest_session || '';

      const sourceRows = [
        ...(Array.isArray(data.recommendations) ? data.recommendations : []),
        ...(Array.isArray(data.watchlist) ? data.watchlist : [])
      ];

      const validRows = sourceRows.map(function (item) {
        return {
          ...item,
          lastPrice: item.lastPrice ?? item.close ?? null,
          changePct: item.changePct ?? item.change_percent ?? null,
          rsi: item.rsi ?? item.rsi14 ?? null,
          date: latestDate,
          why: item.why || item.reasons || []
        };
      }).filter(function (item) {
        return item && item.symbol;
      });

      if (!validRows.length) {
        throw new Error(
          'لا توجد أسهم ذات بيانات مكتملة في آخر جلسة: ' + latestDate
        );
      }

      showMessage(
        'محرك التحليل الموحد: آخر جلسة ' + latestDate +
        ' — تم تحليل ' + (data.analyzed ?? validRows.length) +
        ' سهم. جارٍ تجهيز النتائج...',
        false
      );

      const sorted = validRows.slice().sort(
        (a, b) => getScore(b) - getScore(a)
      );

      const best = sorted.slice(0, 10);
      const weak = sorted.slice().reverse().slice(0, 5);

      currentRows = validRows;

      listBox.innerHTML =
        renderRows('أفضل 10 فرص حسب نتيجة التحليل', best, '#16834a') +
        renderRows('أقل 5 أسهم حسب نتيجة التحليل', weak, '#c62828');

      showMessage(
        'اكتمل التحليل بنجاح. عدد الأسهم التي ظهرت: ' +
        validRows.length +
        ' — آخر تاريخ أسعار في قاعدة البيانات: ' + latestDate +
        ' — اضغط على اسم أي سهم لعرض التفاصيل.',
        false
      );

    } catch (error) {
      console.error('Reco error:', error);

      listBox.innerHTML = `
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
      if (refreshButton) refreshButton.disabled = false;
    }
  }

  window.showReco = showReco;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createRecoCard);
  } else {
    createRecoCard();
  }

})();
