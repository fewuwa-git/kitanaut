import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload || (payload.role !== 'admin' && payload.role !== 'finanzvorstand')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const filePath = join(process.cwd(), 'docs', 'ki-workflow-log.md');
        const content = readFileSync(filePath, 'utf-8');
        return NextResponse.json({ content });
    } catch {
        return NextResponse.json({ content: 'Log-Datei nicht gefunden.' }, { status: 404 });
    }
}
