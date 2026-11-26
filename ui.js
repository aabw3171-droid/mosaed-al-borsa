
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
    .section-title{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);

  const av = document.getElementById('approvedView');
  if (!av) return;

  const home = document.createElement('div');
  home.id = 'homeGrid';

  while (av.firstChild) {
    home.append(av.firstChild);
  }
  av.append(home);

  function makePanel(id, title, bodyId) {
    if (document.getElementById(id)) return;

    const panel = document.createElement('div');
    panel.id = id;
    panel.className = 'hidden';

    panel.innerHTML = `
      <section class="card">
        <div class="section-title">
          <h2 id="${bodyId}T" style="margin:0">${title}</h2>
          <button class="sec" type="button" onclick="showHome()">رجوع للرئيسية</button>
        </div>
        <div id="${bodyId}"></div>
      </section>
    `;

    av.append(panel);
  }

  makePanel('marketPanel', '📊 السوق المصري', 'marketBox');
  makePanel('stockPanel', '📈 تحليل الأسهم', 'stBox');
  makePanel('indicatorsPanel', '📊 المؤشرات', 'indicatorsBox');

  window.fmt = function (n, d = 2) {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
    return Number(n).toLocaleString('en-US', {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    });
  };

  window.cls = function (n) {
    return n > 0 ? 'up' : n < 0 ? 'dn' : '';
  };

  window.panel = function (name) {
    av.querySelectorAll(':scope > div').forEach(el => {
      el.classList.toggle('hidden', el.id !== name);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.showHome = function () {
    window.panel('homeGrid');
  };

  const grid = home.querySelector('.grid');

  if (grid) {
    const cards = Array.from(grid.querySelectorAll('.card'));

    if (cards[0]) {
      cards[0].classList.add('click');
      cards[0].onclick = () => {
        if (typeof window.showMarket === 'function') window.showMarket();
      };
    }

    if (cards[1]) {
      cards[1].classList.add('click');
      cards[1].onclick = () => {
        window.panel('stockPanel');
        const box = document.getElementById('stBox');
        if (box) {
          box.innerHTML = `
            <p>لفتح تحليل سهم محدد، انتقل إلى السوق واختر السهم من القائمة.</p>
            <button type="button" onclick="showMarket()">اختيار سهم من السوق</button>
          `;
        }
      };
    }

    const indicatorCard = document.createElement('div');
    indicatorCard.className = 'card click';
    indicatorCard.innerHTML = `
      <h3>📊 المؤشرات</h3>
      <p>متابعة EGX30 وEGX33 الشرعي وEGX70 وEGX100.</p>
      <button type="button">عرض المؤشرات</button>
    `;
    indicatorCard.onclick = () => {
      if (typeof window.showIndicators === 'function') window.showIndicators();
    };
    grid.append(indicatorCard);
  }

  window.goToStock = function (symbol, name) {
    if (typeof window.showStock === 'function') {
      window.showStock(symbol, name);
    }
  };

})();
