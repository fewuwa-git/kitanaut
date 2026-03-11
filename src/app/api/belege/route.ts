import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getBelege, saveBeleg, getNextBelegnummer } from '@/lib/data';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const isAdmin = payload.role === 'admin';
    const userId = isAdmin ? undefined : payload.userId;
    const belege = await getBelege(payload.orgId, userId);
    return NextResponse.json(belege);
}

export async function POST(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const body = await req.json();
    const belegnummer = await getNextBelegnummer(payload.orgId);
    const beleg = await saveBeleg({
        user_id: payload.userId,
        titel: body.titel,
        beschreibung: body.beschreibung,
        netto: Number(body.netto),
        mwst_satz: Number(body.mwst_satz ?? 0),
        betrag: Number(body.betrag),
        belegnummer,
        datum: body.datum,
        status: 'entwurf',
    }, payload.orgId);
    await logAudit(payload.userId, payload.name, 'beleg_erstellt', {
        titel: body.titel,
        betrag: Number(body.betrag),
        belegnummer,
    });
    return NextResponse.json(beleg);
}
