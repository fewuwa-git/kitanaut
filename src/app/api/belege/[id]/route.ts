import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { saveBeleg, deleteBeleg, getBelegById } from '@/lib/data';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { id } = await params;
    const body = await req.json();

    const existing = await getBelegById(id);
    if (!existing) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    try {
        const beleg = await saveBeleg({ ...existing, ...body });
        return NextResponse.json(beleg);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { id } = await params;
    await deleteBeleg(id);
    return NextResponse.json({ success: true });
}
