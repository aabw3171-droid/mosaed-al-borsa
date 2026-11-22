const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;
const topics = {
  'اكتتاب': 'اكتتاب البورصة المصرية',
  'زيادة رأس المال': 'زيادة رأس المال شركة البورصة المصرية',
  'حقوق أولوية': 'حقوق الأولوية البورصة المصرية',
  'طرح عام': 'طرح عام أولي مصر'
};
const tag = (x, t) => (x.match(new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>')) || [])[1] || '';
const clean = s => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const rows = {};
for (const [topic, q] of Object.entries(topics)) {
  const u = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:30d') + '&hl=ar&gl=EG&ceid=EG:ar';
  const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) { console.log('FAIL', topic, r.status); continue; }
  for (const it of (await r.text()).split('<item>').slice(1)) {
    const link = clean(tag(it, 'link'));
    if (!link || rows[link]) continue;
    const t = new Date(clean(tag(it, 'pubDate')));
    rows[link] = { title: clean(tag(it, 'title')), link, source: clean(tag(it, 'source')), topic, published_at: isNaN(t) ? null : t.toISOString() };
  }
  console.log('OK', topic);
}
const list = Object.values(rows);
const w = await fetch(`${URL_}/rest/v1/market_news?on_conflict=link`, {
  method: 'POST',
  headers: { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(list)
});
console.log('saved', list.length, 'status', w.status, w.ok ? '' : await w.text());
if (!w.ok || !list.length) process.exit(1);
