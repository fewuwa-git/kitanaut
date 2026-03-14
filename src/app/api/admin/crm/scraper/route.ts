import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySuperAdminToken } from '@/lib/auth';
import { Client } from 'pg';
import * as cheerio from 'cheerio';

export const maxDuration = 300;

async function requireAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    return token ? await verifySuperAdminToken(token) : null;
}

function getClient() {
    return new Client({
        host: 'db.mvlnkqgitafkamsujymi.supabase.co',
        user: 'postgres',
        password: 'xwd7bex2kby!xdb!CTK',
        database: 'postgres',
        ssl: { rejectUnauthorized: false },
        port: 5432,
    });
}

const BASE_URL = 'https://www.daks-berlin.de';
const LIST_URL = 'https://www.daks-berlin.de/mitglieder/suche/alle/alle/search';
const CONCURRENCY = 15;

async function fetchHtml(url: string): Promise<string | null> {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return null;
        return res.text();
    } catch {
        return null;
    }
}

function field($: cheerio.CheerioAPI, name: string): string {
    const el = $(`[class*="field--name-${name}"]`).first();
    if (!el.length) return '';
    const item = el.find('.field__item').first();
    return (item.length ? item : el).text().trim();
}

interface DaksKita {
    source_url: string;
    name: string;
    strasse: string;
    plz: string;
    ort: string;
    bezirk: string;
    telefon: string;
    email: string;
    webseite: string;
    traeger: string;
    plaetze: number | null;
}

function parseDetail(html: string, url: string): DaksKita {
    const $ = cheerio.load(html);
    const name = $('h1').first().text().trim();
    const strasse = field($, 'field-daks-rest-street');
    const plz = field($, 'field-daks-rest-zip');
    const ort = field($, 'field-daks-rest-city');
    const bezirk = field($, 'field-daks-rest-district');

    const telDiv = $('[class*="field--name-field-daks-rest-phone"]').first();
    const telefon = telDiv.find('a').first().text().trim() || telDiv.text().trim();

    const mailDiv = $('[class*="field--name-field-daks-rest-email"]').first();
    const email = mailDiv.text().trim();

    const webDiv = $('[class*="field--name-field-daks-rest-web"]').first();
    const webseite = webDiv.find('a').first().attr('href') || '';

    const traegerDiv = $('[class*="field--name-field-daks-rest-parent"]').first();
    const traeger = traegerDiv.find('.field__item').first().text().trim();

    const plaetzeDiv = $('[class*="field--name-field-daks-rest-places-total"]').first();
    const plaetzeText = plaetzeDiv.find('.field__item').first().text().trim();
    const plaetze = plaetzeText ? parseInt(plaetzeText, 10) || null : null;

    return { source_url: url, name, strasse, plz, ort, bezirk, telefon, email, webseite, traeger, plaetze };
}

async function runInBatches<T>(items: T[], concurrency: number, fn: (item: T) => Promise<unknown>) {
    const results: unknown[] = [];
    for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency);
        const batchResults = await Promise.allSettled(batch.map(fn));
        results.push(...batchResults);
    }
    return results;
}

export async function POST() {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const listHtml = await fetchHtml(LIST_URL);
    if (!listHtml) {
        return NextResponse.json({ error: 'Mitgliederliste konnte nicht geladen werden.' }, { status: 502 });
    }

    const $ = cheerio.load(listHtml);
    const links = new Set<string>();
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (href.includes('/mitglieder/suche/kita/') && href.includes('/view')) {
            links.add(href.startsWith('http') ? href : BASE_URL + href);
        }
    });

    const urls = Array.from(links).sort();
    const kitas: DaksKita[] = [];

    await runInBatches(urls, CONCURRENCY, async (url) => {
        const html = await fetchHtml(url);
        if (html) {
            kitas.push(parseDetail(html, url));
        }
    });

    const client = getClient();
    try {
        await client.connect();

        let imported = 0;
        let updated = 0;

        for (const k of kitas) {
            const result = await client.query(`
                INSERT INTO crm_prospects (name, strasse, plz, ort, bezirk, telefon, email, webseite, traeger, plaetze, source, source_url)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'daks', $11)
                ON CONFLICT (source, source_url) WHERE source_url <> '' DO UPDATE SET
                    name = EXCLUDED.name,
                    strasse = EXCLUDED.strasse,
                    plz = EXCLUDED.plz,
                    ort = EXCLUDED.ort,
                    bezirk = EXCLUDED.bezirk,
                    telefon = EXCLUDED.telefon,
                    email = EXCLUDED.email,
                    webseite = EXCLUDED.webseite,
                    traeger = EXCLUDED.traeger,
                    plaetze = EXCLUDED.plaetze,
                    updated_at = NOW()
                RETURNING (xmax = 0) AS inserted
            `, [k.name, k.strasse, k.plz, k.ort, k.bezirk, k.telefon, k.email,
                k.webseite, k.traeger, k.plaetze, k.source_url]);

            if (result.rows[0]?.inserted) {
                imported++;
            } else {
                updated++;
            }
        }

        const totalResult = await client.query(`SELECT COUNT(*) FROM crm_prospects WHERE source = 'daks'`);
        const total = parseInt(totalResult.rows[0].count, 10);

        return NextResponse.json({ imported, updated, total });
    } finally {
        await client.end();
    }
}
