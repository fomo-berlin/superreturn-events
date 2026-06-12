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

function getDayKey(datum) {
  if (!datum) return 'mon';
  const d = new Date(datum);
  return ['sun','mon','tue','wed','thu','fri','sat'][d.getUTCDay()];
}

function getDateLabel(datum, wochentag) {
  if (!datum) return '';
  const d = new Date(datum);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return `${days[d.getUTCDay()]} · ${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function getCatKey(kategorie) {
  if (!kategorie) return 'networking';
  const k = kategorie.toLowerCase();
  if (k.includes('activity') || k.includes('sport') || k.includes('run') || k.includes('yoga') || k.includes('fitness')) return 'activity';
  if (k.includes('wellness') || k.includes('meditation') || k.includes('yoga')) return 'wellness';
  if (k.includes('breakfast') || k.includes('brunch')) return 'breakfast';
  if (k.includes('drinks') || k.includes('reception') || k.includes('cocktail') || k.includes('aperitivo') || k.includes('sundowner')) return 'drinks';
  if (k.includes('dinner')) return 'dinner';
  if (k.includes('party')) return 'party';
  if (k.includes('lunch')) return 'lunch';
  if (k.includes('panel') || k.includes('roundtable') || k.includes('summit') || k.includes('conference')) return 'panel';
  return 'networking';
}

function getStatusKey(status) {
  if (!status) return 'open';
  const s = status.toLowerCase();
  if (s.includes('invite') || s.includes('invitation') || s.includes('private')) return 'invite';
  if (s.includes('waitlist') || s.includes('wait list')) return 'waitlist';
  if (s.includes('sold out')) return 'soldout';
  if (s.includes('paid')) return 'paid';
  return 'open';
}

async function build() {
  console.log('📡 Rufe Events aus Notion ab ...');
  const pages = await fetchAllEvents();
  console.log(`✅ ${pages.length} Events gefunden.`);

  const events = [];

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

    const dayKey = getDayKey(datum);
    const catKey = getCatKey(kategorie);
    const statusKey = getStatusKey(status);
    const timeStr = start && ende ? `${start} – ${ende}` : (start || '');

    events.push({
      day: dayKey,
      cat: catKey,
      catLabel: kategorie || 'Networking',
      title: name,
      host: veranstalter || '',
      desc: beschreibung || '',
      time: timeStr,
      location: ort || '',
      audience: kategorie || '',
      status: statusKey,
      statusLabel: status || 'Open registration',
      link: link || '',
      linkLabel: link ? 'Register ↗' : '',
      dateLabel: getDateLabel(datum, wochentag)
    });
  }

  const eventsJson = JSON.stringify(events, null, 2);

  const template = fs.readFileSync('index.html', 'utf8');
  const output = template.replace('/* FOMO_EVENTS_JSON */', eventsJson);
  fs.mkdirSync('public', { recursive: true });
  fs.writeFileSync('public/index.html', output);
  console.log(`🎉 Seite erfolgreich gebaut → public/index.html (${events.length} Events)`);
}

build().catch(err => { console.error('Fehler:', err); process.exit(1); });
