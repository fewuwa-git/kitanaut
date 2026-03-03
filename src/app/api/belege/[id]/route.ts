import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { saveBeleg, deleteBeleg } from '@/lib/data';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const beleg = await saveBeleg({ id, ...body });
    return NextResponse.json(beleg);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { id } = await params;
    await deleteBeleg(id);
    return NextResponse.json({ success: true });
}
