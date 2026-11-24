
(function () {
  'use strict';

  if (window.__portfolioLoaded) return;
  window.__portfolioLoaded = true;

  const root = document.getElementById('approvedView');
  if (!root || !window.sb) return;

  const grid = document.querySelector('#homeGrid .grid');
  if (!grid) {
    console.error('Portfolio: home grid not found');
    return;
  }

  // إضافة بطاقة المحفظة دون تكرار
  let card = document.getElementById('portfolioHomeCard');
  if (!card) {
    card = document.createElement('div');
    card.id = 'portfolioHomeCard';
    card.className = 'card';
    card.style.cursor = 'pointer';
    card.innerHTML =
      '<h3>💼 محفظتي</h3>' +
      '<p>متابعة الكميات ومتوسط التكلفة والربح والخسارة.</p>' +
      '<button type="button">فتح المحفظة</button>';
    grid.appendChild(card);
  }

  let panel = document.getElementById('portfolioPanel');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'portfolioPanel';
    panel.className = 'hidden';
    panel.innerHTML = `
      <section class="card">
        <button id="portBack" class="sec" type="button">رجوع</button>
        <h2>💼 محفظتي</h2>
        <div id="portMessage" class="msg"></div>
        <form id="portForm">
          <label>رمز السهم</label>
          <input id="portSymbol" required placeholder="مثال: COMI">
          <label>الكمية</label>
          <input id="portQty" type="number" min="0.0001" step="0.0001" required>
          <label>متوسط سعر الشراء</label>
          <input id="portAvg" type="number" min="0.0001" step="0.0001" required>
          <button id="portSave" type="submit">إضافة / تحديث السهم</button>
          <button id="portCancel" class="sec" type="button">إلغاء التعديل</button>
        </form>
      </section>
      <section class="card">
        <h3>ملخص المحفظة</h3>
        <div id="portSummary">جاري التحميل...</div>
      </section>
      <section class="card">
        <h3>الأسهم المملوكة</h3>
        <div id="portRows">جاري التحميل...</div>
      </section>`;
    root.appendChild(panel);
  }

  function el(id) {
    return document.getElementById(id);
  }

  function message(text, error) {
    const box = el('portMessage');
    box.textContent = text;
    box.className = 'msg ' + (error ? 'err' : 'ok');
  }

  function money(value) {
    return Number(value || 0).toLocaleString('ar-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function showPanel() {
    ['homeGrid', 'marketPanel', 'stockPanel', 'recoPanel']
      .forEach(id => {
        const node = el(id);
        if (node) node.classList.add('hidden');
      });
    panel.classList.remove('hidden');
    window.scrollTo({ top: 0 });
    loadPortfolio();
  }

  const oldPanel = window.panel;
  window.panel = function (name) {
    panel.classList.add('hidden');
    if (typeof oldPanel === 'function') oldPanel(name);
  };

  card.addEventListener('click', showPanel);
  el('portBack').addEventListener('click', function () {
    panel.classList.add('hidden');
    if (typeof window.showHome === 'function') {
      window.showHome();
    } else if (typeof oldPanel === 'function') {
      oldPanel('homeGrid');
    }
  });

  let editingSymbol = null;

  el('portCancel').addEventListener('click', resetForm);

  function resetForm() {
    editingSymbol = null;
    el('portForm').reset();
    el('portSave').textContent = 'إضافة / تحديث السهم';
  }

  async function loadPortfolio() {
    const { data: auth, error: authError } = await sb.auth.getUser();
    if (authError || !auth.user) {
      message('سجل الدخول أولاً لعرض محفظتك.', true);
      return;
    }

    el('portRows').textContent = 'جاري تحميل المحفظة...';

    const result = await sb.from('portfolio')
      .select('id,user_id,symbol,quantity,avg_price')
      .eq('user_id', auth.user.id)
      .order('symbol');

    if (result.error) {
      message('خطأ تحميل المحفظة: ' + result.error.message, true);
      el('portRows').textContent = 'تعذر تحميل البيانات.';
      return;
    }

    const holdings = result.data || [];
    let prices = {};

    if (holdings.length) {
      const symbols = holdings.map(x => x.symbol);
      const priceResult = await sb.from('prices')
        .select('symbol,trade_date,close')
        .in('symbol', symbols)
        .order('trade_date', { ascending: false })
        .limit(5000);

      if (priceResult.error) {
        message('تم تحميل الأسهم لكن تعذر تحميل أسعار الإغلاق: ' +
          priceResult.error.message, true);
      } else {
        (priceResult.data || []).forEach(row => {
          if (prices[row.symbol] == null) {
            prices[row.symbol] = Number(row.close);
          }
        });
      }
    }

    let totalCost = 0;
    let totalValue = 0;
    el('portRows').textContent = '';

    if (!holdings.length) {
      el('portRows').textContent = 'لم تضف أي أسهم إلى محفظتك بعد.';
    }

    holdings.forEach(item => {
      const qty = Number(item.quantity);
      const avg = Number(item.avg_price);
      const last = prices[item.symbol];
      const cost = qty * avg;
      const value = last == null ? null : qty * last;
      const profit = value == null ? null : value - cost;

      totalCost += cost;
      if (value != null) totalValue += value;

      const row = document.createElement('div');
      row.className = 'row';

      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = item.symbol;
      const details = document.createElement('div');
      details.style.cssText = 'font-size:13px;color:#718092;line-height:1.9';
      details.textContent =
        'الكمية: ' + qty +
        ' | متوسط الشراء: ' + money(avg) +
        ' | آخر إغلاق: ' + (last == null ? 'غير متاح' : money(last)) +
        ' | ' + (profit == null ? 'الربح/الخسارة: غير متاح' :
          (profit >= 0 ? 'ربح: ' : 'خسارة: ') + money(Math.abs(profit)));
      info.append(title, details);

      const actions = document.createElement('div');
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'sec';
      edit.textContent = 'تعديل';
      edit.addEventListener('click', () => {
        editingSymbol = item.symbol;
        el('portSymbol').value = item.symbol;
        el('portSymbol').disabled = true;
        el('portQty').value = qty;
        el('portAvg').value = avg;
        el('portSave').textContent = 'حفظ التعديل';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'danger';
      del.style.marginRight = '6px';
      del.textContent = 'حذف';
      del.addEventListener('click', async () => {
        if (!confirm('هل تريد حذف ' + item.symbol + ' من المحفظة؟')) return;
        const { error } = await sb.from('portfolio')
          .delete()
          .eq('id', item.id)
          .eq('user_id', auth.user.id);
        if (error) return message('تعذر الحذف: ' + error.message, true);
        message('تم حذف السهم.', false);
        loadPortfolio();
      });

      actions.append(edit, del);
      row.append(info, actions);
      el('portRows').append(row);
    });

    const knownValue = holdings.every(x => prices[x.symbol] != null);
    const profit = totalValue - totalCost;
    el('portSummary').textContent =
      'إجمالي التكلفة: ' + money(totalCost) +
      ' | القيمة الحالية: ' + (knownValue ? money(totalValue) : 'بعض الأسعار غير متاحة') +
      ' | الربح/الخسارة: ' + (knownValue ?
        (profit >= 0 ? 'ربح ' : 'خسارة ') + money(Math.abs(profit)) :
        'غير مكتمل بسبب أسعار غير متاحة');
  }

  el('portForm').addEventListener('submit', async function (event) {
    event.preventDefault();

    const { data: auth, error: authError } = await sb.auth.getUser();
    if (authError || !auth.user) {
      return message('انتهت الجلسة. سجل الدخول مرة أخرى.', true);
    }

    const symbol = el('portSymbol').value.trim().toUpperCase();
    const quantity = Number(el('portQty').value);
    const avg_price = Number(el('portAvg').value);

    if (!symbol || quantity <= 0 || avg_price <= 0) {
      return message('راجع رمز السهم والكمية ومتوسط الشراء.', true);
    }

    const button = el('portSave');
    button.disabled = true;

    const payload = {
      user_id: auth.user.id,
      symbol,
      quantity,
      avg_price,
      updated_at: new Date().toISOString()
    };

    const { error } = await sb.from('portfolio')
      .upsert(payload, { onConflict: 'user_id,symbol' });

    button.disabled = false;

    if (error) {
      return message('تعذر الحفظ: ' + error.message, true);
    }

    el('portSymbol').disabled = false;
    resetForm();
    message('تم حفظ السهم في محفظتك.', false);
    loadPortfolio();
  });

})();
