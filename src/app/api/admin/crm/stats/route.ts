import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySuperAdminToken } from '@/lib/auth';
import { supabase } from '@/lib/db';

async function requireAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    return token ? await verifySuperAdminToken(token) : null;
}

export async function GET() {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
        .from('crm_prospects')
        .select('source, status, plaetze, traeger, bezirk');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = data ?? [];
    const total = rows.length;

    // By source
    const bySource: Record<string, number> = {};
    for (const r of rows) {
        const s = r.source ?? 'unbekannt';
        bySource[s] = (bySource[s] ?? 0) + 1;
    }

    // By status
    const byStatus: Record<string, number> = {};
    for (const r of rows) {
        const s = r.status ?? 'neu';
        byStatus[s] = (byStatus[s] ?? 0) + 1;
    }

    // Plätze stats
    const plaetzeValues = rows.map(r => r.plaetze).filter((v): v is number => typeof v === 'number' && v > 0);
    const plaetzeNull = rows.filter(r => r.plaetze == null || r.plaetze === 0).length;
    const plaetzeAvg = plaetzeValues.length > 0 ? Math.round(plaetzeValues.reduce((a, b) => a + b, 0) / plaetzeValues.length * 10) / 10 : 0;
    const plaetzeMin = plaetzeValues.length > 0 ? Math.min(...plaetzeValues) : 0;
    const plaetzeMax = plaetzeValues.length > 0 ? Math.max(...plaetzeValues) : 0;

    // Plätze distribution in 10-step buckets
    const buckets: { range: string; count: number }[] = [];
    const bucketSize = 10;
    const maxBucket = Math.ceil(plaetzeMax / bucketSize) * bucketSize;
    for (let lo = 0; lo < Math.max(maxBucket, 100); lo += bucketSize) {
        const hi = lo + bucketSize - 1;
        const count = plaetzeValues.filter(v => v >= lo + 1 && v <= hi + 1).length;
        if (lo < 100 || count > 0) {
            buckets.push({ range: `${lo + 1}–${hi + 1}`, count });
        }
    }

    // Top Träger (top 15)
    const traegerMap: Record<string, number> = {};
    for (const r of rows) {
        const t = (r.traeger ?? '').trim();
        if (t) traegerMap[t] = (traegerMap[t] ?? 0) + 1;
    }
    const topTraeger = Object.entries(traegerMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([name, count]) => ({ name, count }));

    // Top Bezirke (top 12)
    const bezirkMap: Record<string, number> = {};
    for (const r of rows) {
        const b = (r.bezirk ?? '').trim();
        if (b) bezirkMap[b] = (bezirkMap[b] ?? 0) + 1;
    }
    const topBezirke = Object.entries(bezirkMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([name, count]) => ({ name, count }));

    return NextResponse.json({
        total,
        bySource,
        byStatus,
        plaetze: { avg: plaetzeAvg, min: plaetzeMin, max: plaetzeMax, withData: plaetzeValues.length, withoutData: plaetzeNull },
        plaetzeBuckets: buckets,
        topTraeger,
        topBezirke,
    });
}
