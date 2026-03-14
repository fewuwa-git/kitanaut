import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySuperAdminToken } from '@/lib/auth';
import { supabase } from '@/lib/db';
import * as cheerio from 'cheerio';

export const maxDuration = 300;

async function requireAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    return token ? await verifySuperAdminToken(token) : null;
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
    source: string;
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
    return { source_url: url, name, strasse, plz, ort, bezirk, telefon, email, webseite, traeger, plaetze, source: 'daks' };
}

async function runInBatches<T>(items: T[], concurrency: number, fn: (item: T) => Promise<unknown>) {
    for (let i = 0; i < items.length; i += concurrency) {
        await Promise.allSettled(items.slice(i, i + concurrency).map(fn));
    }
}

export async function POST() {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const listHtml = await fetchHtml(LIST_URL);
    if (!listHtml) return NextResponse.json({ error: 'Mitgliederliste konnte nicht geladen werden.' }, { status: 502 });

    const $ = cheerio.load(listHtml);
    const links = new Set<string>();
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (href.includes('/mitglieder/suche/kita/') && href.includes('/view')) {
            links.add(href.startsWith('http') ? href : BASE_URL + href);
        }
    });

    const kitas: DaksKita[] = [];
    await runInBatches(Array.from(links).sort(), CONCURRENCY, async (url) => {
        const html = await fetchHtml(url);
        if (html) kitas.push(parseDetail(html, url));
    });

    // Bestehende Einträge laden (für Neu/Update-Unterscheidung)
    const { data: existing } = await supabase
        .from('crm_prospects')
        .select('id, source_url')
        .eq('source', 'daks');

    const existingUrls = new Map((existing ?? []).map(e => [e.source_url, e.id]));

    const newKitas = kitas.filter(k => !existingUrls.has(k.source_url));
    const updateKitas = kitas.filter(k => existingUrls.has(k.source_url));

    // Neue Kitas einfügen
    let insertError: string | null = null;
    if (newKitas.length > 0) {
        const { error } = await supabase.from('crm_prospects').insert(newKitas);
        if (error) insertError = error.message;
    }

    // Bestehende nur mit Kontaktdaten aktualisieren – status/notizen/extra_sources bleiben erhalten
    await runInBatches(updateKitas, CONCURRENCY, async (kita) => {
        const id = existingUrls.get(kita.source_url);
        if (!id) return;
        await supabase.from('crm_prospects').update({
            name: kita.name,
            strasse: kita.strasse,
            plz: kita.plz,
            ort: kita.ort,
            bezirk: kita.bezirk,
            telefon: kita.telefon,
            email: kita.email,
            webseite: kita.webseite,
            traeger: kita.traeger,
            plaetze: kita.plaetze,
            updated_at: new Date().toISOString(),
        }).eq('id', id);
    });

    if (insertError) return NextResponse.json({ error: insertError }, { status: 500 });

    const { count } = await supabase
        .from('crm_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'daks');

    return NextResponse.json({ total: kitas.length, new: newKitas.length, updated: updateKitas.length, dbTotal: count ?? 0 });
}
