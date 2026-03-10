import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getCategoryRules, createCategoryRule } from '@/lib/data';

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rules = await getCategoryRules();
    return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || (payload.role !== 'admin' && payload.role !== 'finanzvorstand'))
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { category_name, field, match_type, value, priority } = body;
    if (!category_name || !field || !match_type || !value) {
        return NextResponse.json({ error: 'Alle Felder sind erforderlich.' }, { status: 400 });
    }
    try {
        const rule = await createCategoryRule({ category_name, field, match_type, value, priority: priority ?? 10 });
        return NextResponse.json(rule);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
