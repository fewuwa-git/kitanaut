import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getEmailTemplate, saveEmailTemplate } from '@/lib/data';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const { id } = await params;
    const template = await getEmailTemplate(id);
    if (!template) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    return NextResponse.json(template);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const { id } = await params;
    const { name, subject, body } = await req.json();
    if (!subject || !body) {
        return NextResponse.json({ error: 'Betreff und Inhalt erforderlich' }, { status: 400 });
    }
    try {
        await saveEmailTemplate(id, subject, body, name);
        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Server-Fehler' }, { status: 500 });
    }
}
