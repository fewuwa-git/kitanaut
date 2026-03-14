// Import DaKS kitas.html into crm_prospects
// Usage: node scripts/import-daks.js

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { Client } = require('pg');

const HTML_PATH = '/Users/fewuwa/Library/CloudStorage/Dropbox/Dropbox Felix/Privat/_felix/anti_/daks-scraper/kitas.html';

const client = new Client({
    host: 'db.mvlnkqgitafkamsujymi.supabase.co',
    user: 'postgres',
    password: 'xwd7bex2kby!xdb!CTK',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    port: 5432,
});

async function main() {
    const html = fs.readFileSync(HTML_PATH, 'utf-8');
    const $ = cheerio.load(html);

    const rows = [];
    $('#table tbody tr').each((_, tr) => {
        const tds = $(tr).find('td');
        if (tds.length < 7) return;

        // td[0]: Name with <a href>
        const nameEl = $(tds[0]).find('a').first();
        const name = nameEl.text().trim();
        const source_url = nameEl.attr('href') || '';

        // td[1]: Adresse: strasse <br> plz ort <br> <small>bezirk</small>
        const adresseTd = $(tds[1]);
        const bezirk = adresseTd.find('small').text().trim();
        adresseTd.find('small').remove();
        const adresseText = adresseTd.html() || '';
        const adresseParts = adresseText.split(/<br\s*\/?>/i).map(p => cheerio.load(p).text().trim()).filter(Boolean);
        const strasse = adresseParts[0] || '';
        const plzOrt = adresseParts[1] || '';
        const plzOrtMatch = plzOrt.match(/^(\d{5})\s+(.+)$/);
        const plz = plzOrtMatch ? plzOrtMatch[1] : '';
        const ort = plzOrtMatch ? plzOrtMatch[2] : plzOrt;

        // td[2]: Telefon
        const telefon = $(tds[2]).text().trim();

        // td[3]: Email – get href from mailto link or text
        const emailEl = $(tds[3]).find('a[href^="mailto:"]').first();
        const email = emailEl.length
            ? emailEl.attr('href').replace('mailto:', '').trim()
            : $(tds[3]).text().trim();

        // td[4]: Webseite
        const webseiteEl = $(tds[4]).find('a').first();
        const webseite = webseiteEl.length ? webseiteEl.attr('href') || webseiteEl.text().trim() : $(tds[4]).text().trim();

        // td[5]: Träger
        const traeger = $(tds[5]).text().trim();

        // td[6]: Plätze
        const plaetzeText = $(tds[6]).text().trim();
        const plaetze = plaetzeText && plaetzeText !== '–' ? parseInt(plaetzeText, 10) : null;

        if (!name) return;

        rows.push({ name, strasse, plz, ort, bezirk, telefon, email, webseite, traeger, plaetze, source_url });
    });

    console.log(`Parsed ${rows.length} rows from HTML`);

    await client.connect();

    let imported = 0;
    let skipped = 0;

    for (const r of rows) {
        const result = await client.query(`
            INSERT INTO crm_prospects (name, strasse, plz, ort, bezirk, telefon, email, webseite, traeger, plaetze, source, source_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'daks', $11)
            ON CONFLICT DO NOTHING
            RETURNING id
        `, [r.name, r.strasse, r.plz, r.ort, r.bezirk, r.telefon, r.email,
            r.webseite === '–' ? '' : r.webseite,
            r.traeger, r.plaetze, r.source_url]);

        if (result.rowCount > 0) {
            imported++;
        } else {
            skipped++;
        }
    }

    await client.end();
    console.log(`Import abgeschlossen: ${imported} importiert, ${skipped} übersprungen (Duplikate)`);
    console.log(`Gesamt in DB: ${imported + skipped} Einträge verarbeitet`);
}

main().catch(e => {
    console.error('Fehler:', e.message);
    process.exit(1);
});
