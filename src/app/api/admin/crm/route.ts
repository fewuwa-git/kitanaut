import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySuperAdminToken } from '@/lib/auth';
import { supabase } from '@/lib/db';

async function requireAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    return token ? await verifySuperAdminToken(token) : null;
}

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source') || '';
    const status = searchParams.get('status') || '';
    const q = searchParams.get('q') || '';
    const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10));

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
        .from('crm_prospects')
        .select('*', { count: 'exact' })
        .order('name')
        .range(from, to);

    if (source) query = query.eq('source', source);
    if (status) query = query.eq('status', status);
    if (q) query = query.or(
        `name.ilike.%${q}%,ort.ilike.%${q}%,bezirk.ilike.%${q}%,telefon.ilike.%${q}%,email.ilike.%${q}%,traeger.ilike.%${q}%,strasse.ilike.%${q}%`
    );

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
        data: data ?? [],
        total: count ?? 0,
        page,
        pageSize: PAGE_SIZE,
        pageCount: Math.ceil((count ?? 0) / PAGE_SIZE),
    });
}
