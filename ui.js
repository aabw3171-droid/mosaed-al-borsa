(function () {
  const css = `
    .click{cursor:pointer;transition:.15s}
    .click:hover{border-color:#4dd6a3;transform:translateY(-2px)}
    table{width:100%;border-collapse:collapse;font-size:14px}
    th,td{padding:10px 6px;text-align:right;border-bottom:1px solid #e4eaf0}
    tr.stk{cursor:pointer}
    tr.stk:hover{background:#f2f5f8}
    .up{color:#167653;font-weight:bold}
    .dn{color:#c0392b;font-weight:bold}
    .kv{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:14px 0}
    .kv div{background:#f2f5f8;border-radius:10px;padding:12px}
    .kv small{color:#718092;display:block}
    .section-nav{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
    .section-nav button{font-size:13px;padding:9px 12px}
    .section-title{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
  `;

  const st = document.createElement('style');
  st.textContent = css;
  document.head.append(st);

  const av = document.getElementById('approvedView');
  if (!av) return;

  const home = document.createElement('div');
  home.id = 'homeGrid';

  while (av.firstChild) {
    home.append(av.firstChild);
  }

  av.append(home);

  function makePanel(id, title, bodyId) {
    let panel = document.getElementById(id);
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = id;
    panel.className = 'hidden';

    panel.innerHTML = `
      <section class="card">
        <div class="section-title">
          <h2 style="margin:0">${title}</h2>
          <button class="sec" type="button" onclick="showHome()">رجوع للرئيسية</button>
        </div>
        <div id="${bodyId}"></div>
      </section>
    `;

    av.append(panel);
    return panel;
  }

  makePanel('marketPanel', '📊 السوق المصري', 'marketBox');
  makePanel('stockPanel', '📈 تحليل الأسهم', 'stBox');
  makePanel('indicatorsPanel', '📊 المؤشرات', 'indicatorsBox');

  const grid = home.querySelector('.grid');

  if (grid) {
    const cards = Array.from(grid.querySelectorAll('.card'));

    cards.forEach((card, index) => {
      card.classList.add('click');

      if (index === 0) {
        card.onclick = () => showMarket();
      } else if (index === 1) {
        card.onclick = () => showMarket();
      } else if (index === 2) {
        card.onclick = () => showIpo();
      }
    });

    const indicatorCard = document.createElement('div');
    indicatorCard.className = 'card click';
    indicatorCard.innerHTML = `
      <h3>📈 المؤشرات</h3>
      <p>متابعة EGX30 وEGX33 الشرعي وEGX70 وEGX100 وتحليل أدائها.</p>
      <button type="button">عرض المؤشرات</button>
    `;
    indicatorCard.onclick = () => showIndicators();
    grid.append(indicatorCard);
  }

  window.fmt = function (n, d = 2) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('en-US', {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    });
  };

  window.cls = function (n) {
    return n > 0 ? 'up' : n < 0 ? 'dn' : '';
  };

  const panels = [
    'homeGrid',
    'marketPanel',
    'stockPanel',
    'indicatorsPanel',
    'ipoPanel'
  ];

  window.panel = function (name) {
    panels.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', id !== name);
    });

    // إخفاء أي لوحة إضافية عند الانتقال لقسم آخر
    document.querySelectorAll('#approvedView > div[id$="Panel"]').forEach(el => {
      if (!panels.includes(el.id)) {
        el.classList.add('hidden');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.showHome = function () {
    panel('homeGrid');
  };

  window.showMarket = function () {
    panel('marketPanel');

    if (typeof window.loadMarket === 'function') {
      window.loadMarket();
    }
  };

  window.showIndicators = function () {
    panel('indicatorsPanel');

    if (typeof window.loadIndicators === 'function') {
      window.loadIndicators();
    }
  };

  window.showStock = function (symbol) {
    window.selectedStockSymbol = symbol;

    panel('stockPanel');

    if (typeof window.loadStock === 'function') {
      window.loadStock(symbol);
    } else if (typeof window.showStockAnalysis === 'function') {
      window.showStockAnalysis(symbol);
    }
  };

  window.goToStock = window.showStock;

  window.goToSection = function (section) {
    const routes = {
      home: showHome,
      market: showMarket,
      indicators: showIndicators,
      stock: () => showStock(window.selectedStockSymbol),
      ipo: () => {
        if (typeof window.showIpo === 'function') window.showIpo();
      }
    };

    if (routes[section]) routes[section]();
  };

})();
