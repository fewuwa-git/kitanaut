import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const maxDuration = 300;

const BASE_URL = 'https://www.daks-berlin.de';
const LIST_URL = 'https://www.daks-berlin.de/mitglieder/suche/alle/alle/search';
const CONCURRENCY = 15;

export interface DaksKita {
    url: string;
    name: string;
    strasse: string;
    plz: string;
    ort: string;
    bezirk: string;
    telefon: string;
    email: string;
    webseite: string;
    traeger: string;
    plaetze: string;
}

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
    const plaetze = plaetzeDiv.find('.field__item').first().text().trim();

    return { url, name, strasse, plz, ort, bezirk, telefon, email, webseite, traeger, plaetze };
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

    kitas.sort((a, b) => a.name.localeCompare(b.name, 'de'));

    return NextResponse.json({ kitas, total: kitas.length, scrapedAt: new Date().toISOString() });
}
