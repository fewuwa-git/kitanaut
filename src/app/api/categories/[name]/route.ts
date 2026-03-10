import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { updateCategory, deleteCategory } from '@/lib/data';

async function checkAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;
    const payload = await verifyToken(token);
    if (!payload || (payload.role !== 'admin' && payload.role !== 'finanzvorstand')) return null;
    return payload;
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ name: string }> }
) {
    const admin = await checkAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { name: oldName } = await params;
    const decodedOldName = decodeURIComponent(oldName);
    const body = await req.json();
    const { name, color, type } = body;
    if (!name || !color || !type) {
        return NextResponse.json({ error: 'name, color und type sind erforderlich.' }, { status: 400 });
    }
    try {
        await updateCategory(decodedOldName, { name, color, type });
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ name: string }> }
) {
    const admin = await checkAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { name } = await params;
    const decodedName = decodeURIComponent(name);
    try {
        await deleteCategory(decodedName);
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
