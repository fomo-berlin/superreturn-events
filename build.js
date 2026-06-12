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
      ? new Date(datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';

    const zeitraum = start && ende ? `${start} — ${ende}` : start || '';

    html += `
    <div class="event-card">
      <div class="event-meta">
        ${wochentag ? `<span class="event-tag">${wochentag}</span>` : ''}
        ${datumFormatiert ? `<span class="event-date">${datumFormatiert}</span>` : ''}
        ${zeitraum ? `<span class="event-time">${zeitraum}</span>` : ''}
      </div>
      <h3 class="event-title">${name}</h3>
      ${ort ? `<div class="event-location">📍 ${ort}</div>` : ''}
      ${kategorie ? `<div class="event-category">${kategorie}</div>` : ''}
      ${status ? `<div class="event-status">${status}</div>` : ''}
      ${beschreibung ? `<p class="event-desc">${beschreibung}</p>` : ''}
      ${veranstalter ? `<div class="event-host">Host: ${veranstalter}</div>` : ''}
      ${link ? `<a href="${link}" target="_blank" class="event-link">Zum Event →</a>` : ''}
    </div>`;
  }

  const template = fs.readFileSync('index.html', 'utf8');
  const output = template.replace('<!-- EVENT_LISTE -->', html);
  fs.mkdirSync('public', { recursive: true });
  fs.writeFileSync('public/index.html', output);
  console.log('🎉 Seite erfolgreich gebaut → public/index.html');
}

build().catch(err => {
  console.error('Fehler:', err);
  process.exit(1);
});
