
(function(){
  const av = document.getElementById('approvedView');
  if (!av) return;

  const d = document.createElement('div');
  d.id = 'ipoPanel';
  d.className = 'hidden';

  d.innerHTML = `
    <section class="card">
      <div class="row">
        <h2 style="margin:0">📅 الاكتتابات وزيادات رأس المال</h2>
        <button class="sec" onclick="showHome()">رجوع</button>
      </div>
      <div id="ipoBox"></div>
      <div id="ipoAdmin"></div>
    </section>`;

  av.append(d);

  const old = window.panel;
  window.panel = function(n){
    if (typeof old === 'function') old(n);
    d.classList.toggle('hidden', n !== 'ipoPanel');
  };

  // بطاقة الاكتتابات بعد حذف التوصيات اليومية
  const card = document.querySelectorAll('#homeGrid .grid .card')[2];

  if (card) {
    card.classList.add('click');
    card.style.cursor = 'pointer';
    card.onclick = () => showIpo();
  }
})();

window.showIpo = async function(){
  panel('ipoPanel');

  const box = document.getElementById('ipoBox');
  box.textContent = 'جاري تحميل الاكتتابات...';

  const { data, error } = await sb
    .from('corporate_events')
    .select('*');

  if (error) {
    box.textContent = 'تعذر التحميل: ' + error.message;
    return;
  }

  const today = new Date().toISOString().slice(0,10);

  const status = e => {
    if (e.end_date && e.end_date < today) return 'منتهي';
    if (e.start_date && e.start_date > today) return 'قادم';
    return 'مفتوح الآن';
  };

  const order = {
    'مفتوح الآن': 0,
    'قادم': 1,
    'منتهي': 2
  };

  box.innerHTML = '';

  if (!data || !data.length) {
    box.textContent = 'لا توجد بيانات حالياً.';
    return;
  }

  data.sort((a,b) =>
    order[status(a)] - order[status(b)] ||
    (a.start_date || '').localeCompare(b.start_date || '')
  );

  data.forEach(e => {
    const row = document.createElement('div');
    row.className = 'row';

    const info = document.createElement('div');
    info.style.flex = '1';
    info.style.minWidth = '200px';

    const title = document.createElement('strong');
    title.textContent = (e.company || 'شركة غير محددة') +
      (e.symbol ? ' (' + e.symbol + ')' : '');

    const kind = document.createElement('small');
    kind.textContent = ' — ' + (e.kind || '');

    const details = document.createElement('div');
    details.textContent = e.details || '';

    const dates = document.createElement('small');
    dates.style.color = '#718092';
    dates.textContent =
      (e.start_date ? 'من ' + e.start_date : '') +
      (e.end_date ? ' إلى ' + e.end_date : '') +
      (e.price ? ' | السعر ' + e.price : '');

    info.append(
      title,
      kind,
      document.createElement('br'),
      details,
      document.createElement('br'),
      dates
    );

    const state = document.createElement('div');
    state.textContent = status(e);

    if (state.textContent === 'مفتوح الآن') {
      state.className = 'up';
    }

    row.append(info, state);
    box.append(row);
  });

  if (window.ipoAdmin) {
    window.ipoAdmin();
  }
};
