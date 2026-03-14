import { cookies } from 'next/headers';
import { verifySuperAdminToken } from '@/lib/auth';
import { supabase } from '@/lib/db';

export const maxDuration = 300;

async function requireAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    return token ? await verifySuperAdminToken(token) : null;
}

const API_BASE = 'https://kita-navigator.berlin.de/api/v1';
const CONCURRENCY = 20;

function normalizePhone(tel: string): string {
    if (!tel) return '';
    tel = tel.trim();
    if (!tel.startsWith('+49')) return tel;
    const digits = tel.replace('+49', '').replace(/\D/g, '');
    const local = '0' + digits;
    if (local.startsWith('030')) return '030 / ' + local.slice(3);
    if (/^01[5-7]/.test(local)) return local.slice(0, 4) + ' / ' + local.slice(4);
    if (local.startsWith('03')) return local.slice(0, 4) + ' / ' + local.slice(4);
    return local;
}

async function fetchJson<T>(url: string): Promise<T | null> {
    try {
        const res = await fetch(url, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return null;
        return res.json() as Promise<T>;
    } catch {
        return null;
    }
}

interface ListItem {
    id: number;
    name: string;
    adresse?: { strasse?: string; hausnummer?: string; plz?: string; ort?: string };
}

interface ListResponse {
    anzahlErgebnisse: number;
    einrichtungen: ListItem[];
}

interface DetailResponse {
    einrichtungsauszug?: ListItem;
    kontaktdaten?: { telefonnummer?: string; emailadresse?: string; webadresse?: string };
    betreuung?: { anzahlKinder?: number };
}

export interface KnExtraSource {
    source: 'kita-navigator';
    source_url: string;
    telefon: string;
    email: string;
    webseite: string;
    plaetze: number | null;
}

interface KitaRecord {
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

async function runInBatches<T>(items: T[], concurrency: number, fn: (item: T) => Promise<unknown>) {
    for (let i = 0; i < items.length; i += concurrency) {
        await Promise.allSettled(items.slice(i, i + concurrency).map(fn));
    }
}

function matchKey(plz: string, strasse: string): string {
    const s = strasse.toLowerCase().replace(/\s+/g, '').substring(0, 12);
    return `${plz.trim()}|${s}`;
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
                send({ type: 'progress', message: 'Lade bestehende Kontakte aus der Datenbank…' });

                const { data: existing, error: existingError } = await supabase
                    .from('crm_prospects')
                    .select('id, plz, strasse, extra_sources');
                if (existingError) {
                    send({ type: 'error', message: existingError.message });
                    return;
                }

                const lookup = new Map<string, { id: number; extra_sources: KnExtraSource[] }>();
                for (const p of existing ?? []) {
                    if (p.plz && p.strasse) {
                        lookup.set(matchKey(p.plz, p.strasse), {
                            id: p.id,
                            extra_sources: (p.extra_sources as KnExtraSource[]) ?? [],
                        });
                    }
                }
                send({ type: 'progress', message: `${existing?.length ?? 0} bestehende Einträge geladen. Verbinde mit Kita-Navigator…` });

                const countData = await fetchJson<{ amount: number }>(`${API_BASE}/kitas/namensucheAnzahl?Q=`);
                if (!countData) {
                    send({ type: 'error', message: 'Kita-Navigator API nicht erreichbar.' });
                    return;
                }

                const total = countData.amount;
                send({ type: 'progress', message: `${total} Kitas gefunden, lade IDs…` });

                const pageSize = 200;
                const pageCount = Math.ceil(total / pageSize);
                const allIds: number[] = [];

                await Promise.all(
                    Array.from({ length: pageCount }, (_, i) =>
                        fetchJson<ListResponse>(`${API_BASE}/kitas/namensuche?Q=&seite=${i}&max=${pageSize}`)
                            .then(data => { if (data?.einrichtungen) allIds.push(...data.einrichtungen.map(e => e.id)); })
                    )
                );

                send({ type: 'progress', message: `${allIds.length} IDs geladen, lade Kontaktdaten…`, current: 0, total: allIds.length });

                const newKitas: KitaRecord[] = [];
                const matchedUpdates: { id: number; extra_sources: KnExtraSource[] }[] = [];
                let current = 0;

                await runInBatches(allIds, CONCURRENCY, async (id) => {
                    const detail = await fetchJson<DetailResponse>(`${API_BASE}/kitas/${id}`);
                    if (!detail) { current++; return; }

                    const auszug = detail.einrichtungsauszug;
                    const addr = auszug?.adresse;
                    const kontakt = detail.kontaktdaten;
                    const betreuung = detail.betreuung;

                    const strasse = [addr?.strasse, addr?.hausnummer].filter(Boolean).join(' ');
                    const plz = addr?.plz ?? '';
                    const knData: KnExtraSource = {
                        source: 'kita-navigator',
                        source_url: `https://kita-navigator.berlin.de/einrichtungen/${id}`,
                        telefon: normalizePhone(kontakt?.telefonnummer ?? ''),
                        email: kontakt?.emailadresse ?? '',
                        webseite: kontakt?.webadresse ?? '',
                        plaetze: betreuung?.anzahlKinder ?? null,
                    };

                    const match = plz && strasse ? lookup.get(matchKey(plz, strasse)) : undefined;

                    if (match) {
                        const newExtraSources = [
                            ...match.extra_sources.filter(e => e.source !== 'kita-navigator'),
                            knData,
                        ];
                        matchedUpdates.push({ id: match.id, extra_sources: newExtraSources });
                    } else {
                        newKitas.push({
                            source_url: knData.source_url,
                            name: (auszug?.name ?? '').trim(),
                            strasse, plz,
                            ort: addr?.ort ?? '',
                            bezirk: '',
                            telefon: knData.telefon,
                            email: knData.email,
                            webseite: knData.webseite,
                            traeger: '',
                            plaetze: knData.plaetze,
                            source: 'kita-navigator',
                        });
                    }

                    current++;
                    const name = (auszug?.name ?? '').trim() || `Kita #${id}`;
                    send({ type: 'progress', message: name, current, total: allIds.length });
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
                    .eq('source', 'kita-navigator');

                send({ type: 'done', new: newKitas.length, matched: matchedUpdates.length, total: allIds.length, dbTotal: count ?? 0 });

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
