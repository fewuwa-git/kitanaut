import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getCategories, createCategory } from '@/lib/data';

export async function GET() {
    const categories = await getCategories();
    return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { name, color, type } = body;
    if (!name || !color || !type) {
        return NextResponse.json({ error: 'name, color und type sind erforderlich.' }, { status: 400 });
    }
    try {
        await createCategory({ name, color, type });
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
