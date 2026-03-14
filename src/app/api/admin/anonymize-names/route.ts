import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { supabase } from '@/lib/db';

const DEFAULTS = ['Annett Kirchner', 'Marlene Brecht', 'Cornelis Heemskerk'];
const KEY = 'anonymize_names';

export async function GET(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data } = await supabase
        .from('kitanaut_settings')
        .select('value')
        .eq('key', KEY)
        .single();

    const names = data?.value ? JSON.parse(data.value) : DEFAULTS;
    return NextResponse.json({ names });
}

export async function PATCH(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { names } = await req.json();
    if (!Array.isArray(names)) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 });

    const { error } = await supabase
        .from('kitanaut_settings')
        .upsert({ key: KEY, value: JSON.stringify(names) }, { onConflict: 'key' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
