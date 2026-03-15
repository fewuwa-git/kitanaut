import { cookies } from 'next/headers';
import { verifySuperAdminToken } from '@/lib/auth';
import { supabase } from '@/lib/db';

export const maxDuration = 300;

async function requireAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    return token ? await verifySuperAdminToken(token) : null;
}

const KZ_URL = 'https://umlerzkpcoflbrrhhdlw.supabase.co/rest/v1';
const KZ_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtbGVyemtwY29mbGJycmhoZGx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTAwNjQyODcsImV4cCI6MjAyNTY0MDI4N30.rzJMSPzgY9hZOU48UDEmNFVB45IVtrpwak8FtleTgK0';
const CONCURRENCY = 20;

interface KzKita {
    id: number;
    name: string;
    address: string;
    district: string;
    postcode: number;
    city: string;
    phone_number: string;
    email: string;
    website: string | null;
    type: string;
    capacity: number | null;
    under_three_capacity: number | null;
    over_three_capacity: number | null;
    lat: number | null;
    lon: number | null;
    slug: string;
    parent_id: number | null;
    active: boolean;
    number: number | null;
}

interface KzParent { id: number; name: string; type: string; }

export interface KietzeeExtraSource {
    source: 'kietzee';
    source_url: string;
    email: string;
    telefon: string;
    webseite: string;
    plaetze: number | null;
    plaetze_unter3: number | null;
    plaetze_ueber3: number | null;
    traeger: string;
    typ: string;
}

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

async function kzFetch<T>(path: string): Promise<T | null> {
    try {
        const res = await fetch(`${KZ_URL}${path}`, {
            headers: { 'apikey': KZ_KEY, 'Authorization': `Bearer ${KZ_KEY}` },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return null;
        return res.json() as Promise<T>;
    } catch { return null; }
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
                send({ type: 'progress', message: 'Lade Träger von kietzee.com…' });

                const parents = await kzFetch<KzParent[]>('/parents?select=id,name,type&limit=2000');
                const parentMap = new Map<number, string>((parents ?? []).map(p => [p.id, p.name]));
                send({ type: 'progress', message: `${parentMap.size} Träger geladen. Lade Kitas…` });

                // Alle Kitas in Seiten laden
                const allKitas: KzKita[] = [];
                const PAGE = 1000;
                let offset = 0;
                while (true) {
                    const batch = await kzFetch<KzKita[]>(
                        `/kitas?select=id,name,address,district,postcode,phone_number,email,website,type,capacity,under_three_capacity,over_three_capacity,lat,lon,slug,parent_id,active,number&active=eq.true&limit=${PAGE}&offset=${offset}`
                    );
                    if (!batch || batch.length === 0) break;
                    allKitas.push(...batch);
                    send({ type: 'progress', message: `${allKitas.length} Kitas geladen…` });
                    if (batch.length < PAGE) break;
                    offset += PAGE;
                }

                const total = allKitas.length;
                send({ type: 'progress', message: `${total} Kitas gefunden. Lade bestehende Kontakte…` });

                // Bestehende DB-Einträge laden
                const existing: { id: number; plz: string; strasse: string; extra_sources: KietzeeExtraSource[] }[] = [];
                let from = 0;
                while (true) {
                    const { data } = await supabase.from('crm_prospects').select('id, plz, strasse, extra_sources').range(from, from + 999);
                    if (!data || data.length === 0) break;
                    existing.push(...data);
                    if (data.length < 1000) break;
                    from += 1000;
                }

                const lookup = new Map<string, { id: number; extra_sources: KietzeeExtraSource[] }>();
                for (const p of existing) {
                    if (p.plz && p.strasse) {
                        lookup.set(matchKey(p.plz, p.strasse), {
                            id: p.id,
                            extra_sources: (p.extra_sources as KietzeeExtraSource[]) ?? [],
                        });
                    }
                }

                send({ type: 'progress', message: `${existing.length} bestehende Einträge geladen. Verarbeite…`, current: 0, total });

                const newKitas: object[] = [];
                const matchedUpdates: { id: number; extra_sources: KietzeeExtraSource[] }[] = [];
                const newKeys = new Set<string>();
                let current = 0;

                for (const kita of allKitas) {
                    const plz = String(kita.postcode).padStart(5, '0');
                    const strasse = kita.address ?? '';
                    const telefon = normalizePhone(kita.phone_number ?? '');
                    const traeger = kita.parent_id ? (parentMap.get(kita.parent_id) ?? '') : '';

                    const kzData: KietzeeExtraSource = {
                        source: 'kietzee',
                        source_url: `https://www.kietzee.com/de/kitas/${kita.slug}`,
                        email: kita.email ?? '',
                        telefon,
                        webseite: kita.website ?? '',
                        plaetze: kita.capacity ?? null,
                        plaetze_unter3: kita.under_three_capacity ?? null,
                        plaetze_ueber3: kita.over_three_capacity ?? null,
                        traeger,
                        typ: kita.type ?? '',
                    };

                    const match = plz && strasse ? lookup.get(matchKey(plz, strasse)) : undefined;

                    const key = plz && strasse ? matchKey(plz, strasse) : null;

                    if (match) {
                        const newExtraSources = [
                            ...match.extra_sources.filter(e => e.source !== 'kietzee'),
                            kzData,
                        ];
                        matchedUpdates.push({ id: match.id, extra_sources: newExtraSources });
                    } else if (key && !newKeys.has(key)) {
                        newKeys.add(key);
                        newKitas.push({
                            source: 'kietzee',
                            source_url: kzData.source_url,
                            name: kita.name ?? '',
                            strasse,
                            plz,
                            ort: 'Berlin',
                            bezirk: kita.district ?? '',
                            telefon,
                            email: kita.email ?? '',
                            webseite: kita.website ?? '',
                            traeger,
                            plaetze: kita.capacity ?? null,
                        });
                    }

                    current++;
                    if (current % 100 === 0 || current === total) {
                        send({ type: 'progress', message: `${current} / ${total} verarbeitet…`, current, total });
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
                    .eq('source', 'kietzee');

                send({ type: 'done', new: newKitas.length, matched: matchedUpdates.length, total, dbTotal: count ?? 0 });

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
