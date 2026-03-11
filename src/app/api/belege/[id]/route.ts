import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { saveBeleg, deleteBeleg, getBelegById } from '@/lib/data';
import { logAudit } from '@/lib/audit';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { id } = await params;
    const body = await req.json();

    const existing = await getBelegById(id, payload.orgId);
    if (!existing) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    const isAdmin = payload.role === 'admin' || payload.role === 'finanzvorstand' || payload.role === 'member';
    if (!isAdmin && existing.user_id !== payload.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const beleg = await saveBeleg({ ...existing, ...body }, payload.orgId);
        if (body.status === 'eingereicht' || body.status === 'bezahlt' || body.status === 'abgelehnt') {
            const actionMap: Record<string, 'beleg_eingereicht' | 'beleg_bezahlt' | 'beleg_abgelehnt'> = {
                eingereicht: 'beleg_eingereicht',
                bezahlt: 'beleg_bezahlt',
                abgelehnt: 'beleg_abgelehnt',
            };
            await logAudit(payload.userId, payload.name, actionMap[body.status], {
                titel: existing.titel,
                betrag: existing.betrag,
                belegnummer: existing.belegnummer,
            });
        }
        return NextResponse.json(beleg);
    } catch {
        return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { id } = await params;

    const existing = await getBelegById(id, payload.orgId);
    if (!existing) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    const isAdmin = payload.role === 'admin' || payload.role === 'finanzvorstand' || payload.role === 'member';
    if (!isAdmin && existing.user_id !== payload.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteBeleg(id);
    return NextResponse.json({ success: true });
}
