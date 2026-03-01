import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;

    if (!payload || (payload.role !== 'admin' && payload.role !== 'member')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jahr = searchParams.get('jahr');
    const monat = searchParams.get('monat');

    let query = supabase.from('pankonauten_springerin_notes').select('*');

    if (jahr) query = query.eq('jahr', parseInt(jahr));
    if (monat) query = query.eq('monat', parseInt(monat));

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;

    if (!payload || (payload.role !== 'admin' && payload.role !== 'member')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { jahr, monat, content, author_name } = body;

    if (!jahr || !monat || content === undefined || !author_name) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('pankonauten_springerin_notes')
        .upsert({
            jahr,
            monat,
            content,
            author_name,
            updated_at: new Date().toISOString()
        }, { onConflict: 'jahr,monat' })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
