const { Client } = require('@notionhq/client');
const fs = require('fs');

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_API_KEY || !DATABASE_ID) {
  console.error('❌ NOTION_API_KEY und NOTION_DATABASE_ID müssen gesetzt sein.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_API_KEY });

function getText(prop) {
  if (!prop) return '';
  if (prop.title) return prop.title.map(t => t.plain_text).join('');
  if (prop.rich_text) return prop.rich_text.map(t => t.plain_text).join('');
  if (prop.select) return prop.select.name || '';
  if (prop.multi_select) return prop.multi_select.map(s => s.name).join(', ');
  if (prop.date) return prop.date.start || '';
  if (prop.url) return prop.url || '';
  return '';
}

async function fetchAllEvents() {
  let allResults = [];
  let hasMore = true;
  let startCursor = undefined;
  while (hasMore) {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      sorts: [
        { property: 'Datum', direction: 'ascending' },
        { property: 'Start', direction: 'ascending' }
      ],
      start_cursor: startCursor,
      page_size: 100
    });
    allResults = allResults.concat(response.results);
    hasMore = response.has_more;
    startCursor = response.next_cursor;
  }
  return allResults;
}

async function build() {
  console.log('📡 Rufe Events aus Notion ab ...');
  const pages = await fetchAllEvents();
  console.log(`✅ ${pages.length} Events gefunden.`);

  let html = '';

  for (const page of pages) {
    const p = page.properties;
    const name         = getText(p['Event Name']);
    const datum        = getText(p['Datum']);
    const start        = getText(p['Start']);
    const ende         = getText(p['Ende']);
    const wochentag    = getText(p['Wochentag']);
    const kategorie    = getText(p['Kategorie']);
    const status       = getText(p['Status']);
    const ort          = getText(p['Veranstaltungsort']);
    const beschreibung = getText(p['Beschreibung']);
    const veranstalter = getText(p['Veranstalter']);
    const link         = getText(p['Link']);

    if (!name) continue;

    const datumFormatiert = datum
      ? new Date(datum).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
      : '';

    const zeitraum = start && ende ? `${start} — ${ende}` : start || '';
    const metaLine = [wochentag, datumFormatiert, zeitraum].filter(Boolean).join(' · ');
    const subLine  = [kategorie, status].filter(Boolean).join(' · ');

    html += `
<div style="padding:24px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
  ${metaLine ? `<div style="font-size:12px;font-weight:600;letter-spacing:0.08em;color:#965bf2;margin-bottom:8px;text-transform:uppercase;">${metaLine}</div>` : ''}
  <h3 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 10px;line-height:1.3;">${name}</h3>
  ${ort ? `<div style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:6px;">📍 ${ort}</div>` : ''}
  ${subLine ? `<div style="font-size:13px;color:rgba(255,255,255,0.4);margin-bottom:8px;">${subLine}</div>` : ''}
  ${beschreibung ? `<p style="font-size:14px;color:rgba(255,255,255,0.6);margin:0 0 8px;line-height:1.6;">${beschreibung}</p>` : ''}
  ${veranstalter ? `<div style="font-size:13px;color:rgba(255,255,255,0.4);margin-bottom:8px;">Host: ${veranstalter}</div>` : ''}
  ${link ? `<a href="${link}" target="_blank" style="font-size:13px;color:#965bf2;text-decoration:none;font-weight:600;">Zum Event →</a>` : ''}
</div>`;
  }

  const template = fs.readFileSync('index.html', 'utf8');
  const output = template.replace('<!-- EVENT_LISTE -->', html);
  fs.mkdirSync('public', { recursive: true });
  fs.writeFileSync('public/index.html', output);
  console.log('🎉 Seite erfolgreich gebaut → public/index.html');
}

build().catch(err => { console.error('Fehler:', err); process.exit(1); });
