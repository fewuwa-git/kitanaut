import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySuperAdminToken } from '@/lib/auth';
import { supabase } from '@/lib/db';

async function requireAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    return token ? await verifySuperAdminToken(token) : null;
}

export async function GET(req: NextRequest) {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source') || '';
    const status = searchParams.get('status') || '';
    const q = searchParams.get('q') || '';

    let query = supabase.from('crm_prospects').select('*').order('name');

    if (source) query = query.eq('source', source);
    if (status) query = query.eq('status', status);
    if (q) query = query.or(
        `name.ilike.%${q}%,ort.ilike.%${q}%,bezirk.ilike.%${q}%,telefon.ilike.%${q}%,email.ilike.%${q}%,traeger.ilike.%${q}%,strasse.ilike.%${q}%`
    );

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
}
