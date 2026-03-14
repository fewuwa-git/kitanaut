import { NextResponse } from 'next/server';
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
    adresse?: {
        strasse?: string;
        hausnummer?: string;
        plz?: string;
        ort?: string;
    };
}

interface ListResponse {
    anzahlErgebnisse: number;
    anzahlSeiten: number;
    seite: number;
    einrichtungen: ListItem[];
}

interface DetailResponse {
    einrichtungsauszug?: ListItem;
    kontaktdaten?: {
        telefonnummer?: string;
        emailadresse?: string;
        webadresse?: string;
    };
    betreuung?: {
        anzahlKinder?: number;
    };
}

async function runInBatches<T>(items: T[], concurrency: number, fn: (item: T) => Promise<unknown>) {
    for (let i = 0; i < items.length; i += concurrency) {
        await Promise.allSettled(items.slice(i, i + concurrency).map(fn));
    }
}

export async function POST() {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Gesamtanzahl ermitteln
    const countData = await fetchJson<{ amount: number }>(`${API_BASE}/kitas/namensucheAnzahl?Q=`);
    if (!countData) return NextResponse.json({ error: 'Kita-Navigator API nicht erreichbar.' }, { status: 502 });

    const total = countData.amount;
    const pageSize = 200;
    const pageCount = Math.ceil(total / pageSize);

    // 2. Alle IDs über Listenendpunkt sammeln
    const allIds: number[] = [];
    const pagePromises = Array.from({ length: pageCount }, (_, i) =>
        fetchJson<ListResponse>(`${API_BASE}/kitas/namensuche?Q=&seite=${i}&max=${pageSize}`)
            .then(data => {
                if (data?.einrichtungen) {
                    for (const e of data.einrichtungen) allIds.push(e.id);
                }
            })
    );
    await Promise.all(pagePromises);

    // 3. Details für jede Kita laden
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

    const kitas: KitaRecord[] = [];
    await runInBatches(allIds, CONCURRENCY, async (id) => {
        const detail = await fetchJson<DetailResponse>(`${API_BASE}/kitas/${id}`);
        if (!detail) return;

        const auszug = detail.einrichtungsauszug;
        const addr = auszug?.adresse;
        const kontakt = detail.kontaktdaten;
        const betreuung = detail.betreuung;

        const strasse = [addr?.strasse, addr?.hausnummer].filter(Boolean).join(' ');

        kitas.push({
            source_url: `https://kita-navigator.berlin.de/einrichtungen/${id}`,
            name: (auszug?.name ?? '').trim(),
            strasse,
            plz: addr?.plz ?? '',
            ort: addr?.ort ?? '',
            bezirk: '',
            telefon: kontakt?.telefonnummer ?? '',
            email: kontakt?.emailadresse ?? '',
            webseite: kontakt?.webadresse ?? '',
            traeger: '',
            plaetze: betreuung?.anzahlKinder ?? null,
            source: 'kita-navigator',
        });
    });

    if (kitas.length === 0) return NextResponse.json({ error: 'Keine Kitas gefunden.' }, { status: 502 });

    const { error } = await supabase
        .from('crm_prospects')
        .upsert(kitas, { onConflict: 'source,source_url', ignoreDuplicates: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { count } = await supabase
        .from('crm_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'kita-navigator');

    return NextResponse.json({ total: kitas.length, dbTotal: count ?? 0 });
}
