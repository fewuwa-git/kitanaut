import { cookies } from 'next/headers';
import { verifySuperAdminToken } from '@/lib/auth';
import { supabase } from '@/lib/db';
import * as XLSX from 'xlsx';

export const maxDuration = 300;

async function requireAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    return token ? await verifySuperAdminToken(token) : null;
}

const XLSX_URL = 'https://www.berlin.de/sen/bildung/service/daten/kitaliste-nov-2025.xlsx';
const CONCURRENCY = 20;

interface SenatsRow {
    einrichtungsnummer: string;
    name: string;
    strasse: string;
    plz: string;
    bezirk: string;
    telefon: string;
    traeger: string;
    plaetze: number | null;
    typ: string;
}

export interface SenatsExtraSource {
    source: 'senatsliste';
    einrichtungsnummer: string;
    typ: string;
    plaetze: number | null;
    telefon: string;
    traeger: string;
}

function normalizePhone(tel: string): string {
    if (!tel) return '';
    const digits = tel.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('030')) return '030 / ' + digits.slice(3);
    if (/^01[5-7]/.test(digits)) return digits.slice(0, 4) + ' / ' + digits.slice(4);
    if (digits.startsWith('03')) return digits.slice(0, 4) + ' / ' + digits.slice(4);
    // no area code prefix – prepend 030
    if (digits.length === 7 || digits.length === 8) return '030 / ' + digits;
    return digits;
}

function matchKey(plz: string, strasse: string): string {
    const s = strasse.toLowerCase().replace(/\s+/g, '').substring(0, 12);
    return `${plz.trim()}|${s}`;
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
                send({ type: 'progress', message: 'Lade Kitaliste des Berliner Senats…' });

                const res = await fetch(XLSX_URL, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    signal: AbortSignal.timeout(30000),
                });
                if (!res.ok) {
                    send({ type: 'error', message: `Datei konnte nicht geladen werden (${res.status}).` });
                    return;
                }

                const arrayBuffer = await res.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

                send({ type: 'progress', message: `${raw.length} Einträge in der Excel-Datei. Lade bestehende Kontakte…` });

                // Load all existing prospects for matching (paginated)
                const existing: { id: number; plz: string; strasse: string; extra_sources: SenatsExtraSource[] }[] = [];
                const PAGE = 1000;
                let from = 0;
                while (true) {
                    const { data } = await supabase
                        .from('crm_prospects')
                        .select('id, plz, strasse, extra_sources')
                        .range(from, from + PAGE - 1);
                    if (!data || data.length === 0) break;
                    existing.push(...data);
                    if (data.length < PAGE) break;
                    from += PAGE;
                }

                send({ type: 'progress', message: `${existing.length} bestehende Einträge geladen. Parse Excel…` });

                // Build lookup
                const lookup = new Map<string, { id: number; extra_sources: SenatsExtraSource[] }>();
                for (const p of existing) {
                    if (p.plz && p.strasse) {
                        lookup.set(matchKey(p.plz, p.strasse), {
                            id: p.id,
                            extra_sources: (p.extra_sources as SenatsExtraSource[]) ?? [],
                        });
                    }
                }

                // Parse rows
                const kitas: SenatsRow[] = raw.map(r => {
                    const strasse = [String(r['Straße'] ?? '').trim(), String(r['Hausnummer'] ?? '').trim()].filter(Boolean).join(' ');
                    const plzRaw = r['PLZ'];
                    const plz = plzRaw != null ? String(plzRaw).padStart(5, '0').trim() : '';
                    return {
                        einrichtungsnummer: String(r['Einrichtungsnummer'] ?? '').trim(),
                        name: String(r['Einrichtungsname'] ?? '').trim(),
                        strasse,
                        plz,
                        bezirk: String(r['Einrichtungsbezirk Name'] ?? '').trim(),
                        telefon: normalizePhone(String(r['Telefon'] ?? '').trim()),
                        traeger: String(r['Trägername'] ?? '').trim(),
                        plaetze: r['Erlaubte Plätze (BE)'] != null ? Number(r['Erlaubte Plätze (BE)']) || null : null,
                        typ: String(r['Einrichtungstyp'] ?? '').trim(),
                    };
                }).filter(k => k.name);

                send({ type: 'progress', message: `${kitas.length} Kitas geparst, gleiche mit Datenbank ab…`, current: 0, total: kitas.length });

                const newKitas: object[] = [];
                const matchedUpdates: { id: number; extra_sources: SenatsExtraSource[] }[] = [];
                let current = 0;

                for (const kita of kitas) {
                    const senatsData: SenatsExtraSource = {
                        source: 'senatsliste',
                        einrichtungsnummer: kita.einrichtungsnummer,
                        typ: kita.typ,
                        plaetze: kita.plaetze,
                        telefon: kita.telefon,
                        traeger: kita.traeger,
                    };

                    const match = kita.plz && kita.strasse ? lookup.get(matchKey(kita.plz, kita.strasse)) : undefined;

                    if (match) {
                        const newExtraSources = [
                            ...match.extra_sources.filter(e => e.source !== 'senatsliste'),
                            senatsData,
                        ];
                        matchedUpdates.push({ id: match.id, extra_sources: newExtraSources });
                    } else {
                        newKitas.push({
                            source: 'senatsliste',
                            source_url: kita.einrichtungsnummer
                                ? `https://www.berlin.de/sen/bildung/service/daten/kitas/?id=${kita.einrichtungsnummer}`
                                : '',
                            name: kita.name,
                            strasse: kita.strasse,
                            plz: kita.plz,
                            ort: 'Berlin',
                            bezirk: kita.bezirk,
                            telefon: kita.telefon,
                            email: '',
                            webseite: '',
                            traeger: kita.traeger,
                            plaetze: kita.plaetze,
                        });
                    }

                    current++;
                    if (current % 100 === 0 || current === kitas.length) {
                        send({ type: 'progress', message: `${current} / ${kitas.length} verarbeitet…`, current, total: kitas.length });
                    }
                }

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
                    .eq('source', 'senatsliste');

                send({ type: 'done', new: newKitas.length, matched: matchedUpdates.length, total: kitas.length, dbTotal: count ?? 0 });

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
