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

// Bundesland-Übersichtsseiten – diese verlinken auf Bezirke/Kreise, die wiederum auf Kitas zeigen
const BUNDESLAND_PAGES = [
    'https://www.kitanetz.de/berlin/berlin.php',
    'https://www.kitanetz.de/brandenburg/brandenburg.php',
    'https://www.kitanetz.de/sachsen/sachsen.php',
    'https://www.kitanetz.de/sachsen-anhalt/sachsen-anhalt.php',
    'https://www.kitanetz.de/thueringen/thueringen.php',
    'https://www.kitanetz.de/mecklenburg-vorpommern/mecklenburg-vorpommern.php',
    'https://www.kitanetz.de/hamburg/hamburg.php',
    'https://www.kitanetz.de/schleswig-holstein/schleswig-holstein.php',
    'https://www.kitanetz.de/niedersachsen/niedersachsen.php',
    'https://www.kitanetz.de/nordrhein-westfalen/nordrhein-westfalen.php',
    'https://www.kitanetz.de/hessen/hessen.php',
    'https://www.kitanetz.de/rheinland-pfalz/rheinland-pfalz.php',
    'https://www.kitanetz.de/saarland/saarland.php',
    'https://www.kitanetz.de/baden-wuerttemberg/baden-wuerttemberg.php',
    'https://www.kitanetz.de/bayern/bayern.php',
    'https://www.kitanetz.de/bremen/bremen.php',
];
const SITEMAP_URL = 'https://www.kitanetz.de/5751743_index.xml';
const CONCURRENCY = 15;

export interface KitanetzExtraSource {
    source: 'kitanetz';
    source_url: string;
    telefon: string;
    email: string;
    traeger: string;
    plaetze: number | null;
    bundesland: string;
    lat: number | null;
    lng: number | null;
}

function normalizePhone(tel: string): string {
    if (!tel) return '';
    // kitanetz format: "030 - 89 04 81 38" → "030 / 8904818"
    const digits = tel.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('030')) return '030 / ' + digits.slice(3);
    if (/^01[5-7]/.test(digits)) return digits.slice(0, 4) + ' / ' + digits.slice(4);
    if (digits.startsWith('03')) return digits.slice(0, 4) + ' / ' + digits.slice(4);
    if (digits.length === 7 || digits.length === 8) return '030 / ' + digits;
    return digits;
}

function normalizeStrasse(s: string): string {
    return s.toLowerCase()
        .replace(/str\.\s*/g, 'straße')
        .replace(/\bstr\b/g, 'straße')
        .replace(/\d+\s*[a-z]?/gi, '')
        .replace(/\s+/g, '')
        .replace(/[.\-/]/g, '')
        .substring(0, 15);
}

function matchKey(plz: string, strasse: string): string {
    return `${plz.trim()}|${normalizeStrasse(strasse)}`;
}

async function fetchHtml(url: string): Promise<string | null> {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return null;
        return res.text();
    } catch { return null; }
}

interface KitaData {
    source_url: string;
    name: string;
    strasse: string;
    plz: string;
    ort: string;
    bundesland: string;
    telefon: string;
    email: string;
    traeger: string;
    plaetze: number | null;
    lat: number | null;
    lng: number | null;
}

function parseKita(html: string, url: string): KitaData | null {
    const $ = cheerio.load(html);

    const name = $('h1').first().text().trim();
    if (!name) return null;

    // Adresse: erstes <p> mit PLZ-Muster
    let plz = '', ort = '', strasse = '';
    $('p').each((_, el) => {
        const text = $(el).text();
        const m = text.match(/(\d{5})\s+([^\n\r]+)/);
        if (m && !plz) {
            plz = m[1];
            ort = m[2].split('\n')[0].trim();
            // Straße ist im HTML als eigener Knoten nach dem BR
            const html2 = $(el).html() ?? '';
            const parts = html2.split('<br>');
            if (parts.length >= 2) {
                strasse = cheerio.load(parts[1]).text().trim();
            }
        }
    });

    // Felder nach .titel-Divs
    let telefon = '', email = '', traeger = '';
    let plaetze: number | null = null;
    let lat: number | null = null;
    let lng: number | null = null;

    $('.titel').each((_, el) => {
        const label = $(el).text().toLowerCase();
        const next = $(el).parent().text().replace($(el).text(), '').trim();

        if (label.includes('tel')) {
            const t = normalizePhone(next.split('\n')[0].trim());
            if (t && !telefon) telefon = t;
        } else if (label.includes('träger') || label.includes('trager')) {
            traeger = next.split('\n')[0].trim();
        } else if (label.includes('betreuung')) {
            const m = next.match(/(\d+)\s*Kinder/i);
            if (m) plaetze = parseInt(m[1], 10);
        }
    });

    // E-Mail
    const mailEl = $('a[href^="mailto:"]').first();
    if (mailEl.length) email = mailEl.text().trim();

    // Bundesland aus URL-Pfad
    const urlMatch = url.match(/kitanetz\.de\/([^/]+)\//);
    const bundesland = urlMatch ? urlMatch[1].charAt(0).toUpperCase() + urlMatch[1].slice(1) : '';

    // Koordinaten aus Seitenquelltext
    const latM = html.match(/lat[=:]\s*([\d.]+)/i);
    const lngM = html.match(/l[no]g[=:]\s*([\d.]+)/i);
    if (latM) lat = parseFloat(latM[1]);
    if (lngM) lng = parseFloat(lngM[1]);

    return { source_url: url, name, strasse, plz, ort, bundesland, telefon, email, traeger, plaetze, lat, lng };
}

async function runInBatches<T>(items: T[], concurrency: number, fn: (item: T) => Promise<unknown>) {
    for (let i = 0; i < items.length; i += concurrency) {
        await Promise.allSettled(items.slice(i, i + concurrency).map(fn));
    }
}

export async function POST() {
    if (!await requireAdmin()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (event: object) => {
                controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
            };

            try {
                send({ type: 'progress', message: 'Sammle Kita-URLs über Bundesland-Seiten…' });

                const kitaUrlSet = new Set<string>();

                // Schritt 1: Bundesland-Seiten laden → Bezirk/Kreis-Links finden
                const bezirkUrls = new Set<string>();
                await runInBatches(BUNDESLAND_PAGES, 8, async (blUrl) => {
                    const html = await fetchHtml(blUrl);
                    if (!html) return;
                    const matches = html.match(/href="(\/[a-z-]+\/[^"]+\.php)"/g) ?? [];
                    for (const m of matches) {
                        const path = m.replace(/href="|"/g, '');
                        // Bezirk-Seiten: /{bundesland}/{bezirk}.php (ohne PLZ)
                        if (/^\/[a-z-]+\/[a-z-]+\.php$/.test(path) && !path.includes('platzangebote') && !path.includes('stellenboerse')) {
                            bezirkUrls.add('https://www.kitanetz.de' + path);
                        }
                    }
                });

                send({ type: 'progress', message: `${bezirkUrls.size} Bezirks-/Kreisseiten gefunden. Lade Kita-Listen…` });

                // Schritt 2: Bezirk-Seiten laden → Kita-Detailseiten-Links
                await runInBatches([...bezirkUrls], CONCURRENCY, async (bzUrl) => {
                    const html = await fetchHtml(bzUrl);
                    if (!html) return;
                    const matches = html.match(/href="(\/[a-z-]+\/\d{5}\/[^"]+\.php)"/g) ?? [];
                    for (const m of matches) {
                        const path = m.replace(/href="|"/g, '');
                        if (!path.includes('platzangebote') && !path.includes('stellenboerse')) {
                            kitaUrlSet.add('https://www.kitanetz.de' + path);
                        }
                    }
                });

                // Schritt 3: Sitemap als Ergänzung
                const sitemapHtml = await fetchHtml(SITEMAP_URL);
                if (sitemapHtml) {
                    const urlMatches = sitemapHtml.match(/https?:\/\/www\.kitanetz\.de\/[a-z-]+\/\d{5}\/[^<"]+\.php/g) ?? [];
                    for (const u of urlMatches) {
                        if (!u.includes('platzangebote')) kitaUrlSet.add(u);
                    }
                }

                const kitaUrls = [...kitaUrlSet];
                send({ type: 'progress', message: `${kitaUrls.length} Kita-URLs gefunden. Lade bestehende Kontakte…` });

                if (kitaUrls.length === 0) {
                    send({ type: 'error', message: 'Keine Kita-URLs in der Sitemap gefunden.' });
                    return;
                }

                // Bestehende DB-Einträge laden
                const existing: { id: number; plz: string; strasse: string; extra_sources: KitanetzExtraSource[] }[] = [];
                let from = 0;
                while (true) {
                    const { data } = await supabase.from('crm_prospects').select('id, plz, strasse, extra_sources').range(from, from + 999);
                    if (!data || data.length === 0) break;
                    existing.push(...data);
                    if (data.length < 1000) break;
                    from += 1000;
                }

                const lookup = new Map<string, { id: number; extra_sources: KitanetzExtraSource[] }>();
                for (const p of existing) {
                    if (p.plz && p.strasse) {
                        lookup.set(matchKey(p.plz, p.strasse), {
                            id: p.id,
                            extra_sources: (p.extra_sources as KitanetzExtraSource[]) ?? [],
                        });
                    }
                }

                send({ type: 'progress', message: `${existing.length} bestehende Einträge geladen. Scrape Kitas…`, current: 0, total: kitaUrls.length });

                const newKitas: object[] = [];
                const matchedUpdates: { id: number; extra_sources: KitanetzExtraSource[] }[] = [];
                const newKeys = new Set<string>();
                let current = 0;

                await runInBatches(kitaUrls, CONCURRENCY, async (url) => {
                    const html = await fetchHtml(url);
                    current++;

                    if (!html) {
                        send({ type: 'progress', message: `${current} / ${kitaUrls.length}`, current, total: kitaUrls.length });
                        return;
                    }

                    const kita = parseKita(html, url);
                    if (!kita) {
                        send({ type: 'progress', message: `${current} / ${kitaUrls.length}`, current, total: kitaUrls.length });
                        return;
                    }

                    const kzData: KitanetzExtraSource = {
                        source: 'kitanetz',
                        source_url: kita.source_url,
                        telefon: kita.telefon,
                        email: kita.email,
                        traeger: kita.traeger,
                        plaetze: kita.plaetze,
                        bundesland: kita.bundesland,
                        lat: kita.lat,
                        lng: kita.lng,
                    };

                    const key = kita.plz && kita.strasse ? matchKey(kita.plz, kita.strasse) : null;
                    const match = key ? lookup.get(key) : undefined;

                    if (match) {
                        const newExtraSources = [
                            ...match.extra_sources.filter(e => e.source !== 'kitanetz'),
                            kzData,
                        ];
                        matchedUpdates.push({ id: match.id, extra_sources: newExtraSources });
                    } else if (!key || !newKeys.has(key)) {
                        if (key) newKeys.add(key);
                        newKitas.push({
                            source: 'kitanetz',
                            source_url: kita.source_url,
                            name: kita.name,
                            strasse: kita.strasse,
                            plz: kita.plz,
                            ort: kita.ort,
                            bezirk: '',
                            telefon: kita.telefon,
                            email: kita.email,
                            webseite: '',
                            traeger: kita.traeger,
                            plaetze: kita.plaetze,
                        });
                    }

                    send({ type: 'progress', message: kita.name, current, total: kitaUrls.length });
                });

                send({ type: 'progress', message: `Speichere ${newKitas.length} neue Kitas…` });
                await runInBatches(newKitas, CONCURRENCY, async (kita) => {
                    await supabase.from('crm_prospects').insert(kita);
                });

                send({ type: 'progress', message: `Aktualisiere ${matchedUpdates.length} gematchte Einträge…` });
                await runInBatches(matchedUpdates, CONCURRENCY, async ({ id, extra_sources }) => {
                    await supabase.from('crm_prospects')
                        .update({ extra_sources, updated_at: new Date().toISOString() })
                        .eq('id', id);
                });

                const { count } = await supabase
                    .from('crm_prospects')
                    .select('*', { count: 'exact', head: true })
                    .eq('source', 'kitanetz');

                send({ type: 'done', new: newKitas.length, matched: matchedUpdates.length, total: kitaUrls.length, dbTotal: count ?? 0 });

            } catch (err) {
                send({ type: 'error', message: err instanceof Error ? err.message : 'Unbekannter Fehler' });
            } finally {
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' },
    });
}
