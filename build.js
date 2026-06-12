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
  return '';
}

async function fetchEvents() {
  console.log('📡 Rufe Events aus Notion ab ...');
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    sorts: [
      { property: 'Datum', direction: 'ascending' },
      { property: 'Start', direction: 'ascending' }
    ]
  });

  console.log(`✅ ${response.results.length} Events gefunden.`);
  let html = '';

  for (const page of response.results) {
    const p = page.properties;
    const eventName     = getText(p['Event Name']) || 'Ohne Titel';
    const datum         = getText(p['Datum']);
    const start         = getText(p['Start']);
    const ende          = getText(p['Ende']);
    const wochentag     = getText(p['Wochentag']);
    const kategorie     = getText(p['Kategorie']);
    const status        = getText(p['Status']);
    const ort           = getText(p['Veranstaltungsort']);
    const beschreibung  = getText(p['Beschreibung']);
    const veranstalter  = getText(p['Veranstalter']);
    const quelle        = getText(p['Quelle']);
    const link          = p['Link']?.url || '';

    let datumFormatiert = datum;
    if (datum && datum.length === 10) {
      const [j, m, t] = datum.split('-');
      const monate = ['JAN','FEB','MÄR','APR','MAI','JUN','JUL','AUG','SEP','OKT','NOV','DEZ'];
      datumFormatiert = `${t}. ${monate[parseInt(m)-1]} ${j}`;
    }

    const zeit = start && ende ? `${start} — ${ende}` : start || '';

    html += `
    <div style="margin-bottom:28px;padding:18px;background:rgba(255,255,255,0.04);border-radius:10px;border:1px solid rgba(150,91,242,0.2);">
      <p style="margin:0 0 4px 0;font:12px 'Helvetica Neue';color:#965bf2;letter-spacing:1px;text-transform:uppercase;">${wochentag}${datumFormatiert ? ' · ' + datumFormatiert : ''}${zeit ? ' · ' + zeit : ''}</p>
      <h3 style="margin:0 0 8px 0;font:bold 18px 'Helvetica Neue';color:#ffffff;">${eventName}</h3>
      ${ort ? `<p style="margin:0 0 4px 0;font:13px 'Helvetica Neue';color:rgba(255,255,255,0.6);">📍 ${ort}</p>` : ''}
      ${kategorie ? `<p style="margin:0 0 4px 0;font:12px 'Helvetica Neue';color:rgba(255,255,255,0.4);">🏷 ${kategorie}${status ? ' · ' + status : ''}</p>` : ''}
      ${beschreibung ? `<p style="margin:8px 0;font:13px 'Helvetica Neue';color:rgba(255,255,255,0.55);line-height:1.5;">${beschreibung}</p>` : ''}
      ${veranstalter ? `<p style="margin:4px 0;font:12px 'Helvetica Neue';color:rgba(255,255,255,0.35);">Host: ${veranstalter}${quelle ? ' · ' + quelle : ''}</p>` : ''}
      ${link ? `<a href="${link}" target="_blank" style="display:inline-block;margin-top:10px;font:13px 'Helvetica Neue';color:#965bf2;text-decoration:none;">Zum Event →</a>` : ''}
    </div>`;
  }

  const template = fs.readFileSync('index.html', 'utf8');
  const output = template.replace('<!-- EVENT_LISTE -->', html);
  fs.mkdirSync('public', { recursive: true });
  fs.writeFileSync('public/index.html', output);
  console.log('🎉 Seite erfolgreich gebaut → public/index.html');
}

fetchEvents().catch(err => {
  console.error('Fehler:', err);
  process.exit(1);
});
