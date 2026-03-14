import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySuperAdminToken } from '@/lib/auth';
import { supabase } from '@/lib/db';

async function requireAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    return token ? await verifySuperAdminToken(token) : null;
}

export async function GET() {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data } = await supabase.from('reserved_slugs').select('*').order('slug');
    return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { slug, reason } = await req.json();
    if (!slug) return NextResponse.json({ error: 'Slug erforderlich' }, { status: 400 });
    const clean = slug.toLowerCase().trim();
    const { error } = await supabase.from('reserved_slugs').insert({ slug: clean, reason: reason || null });
    if (error) return NextResponse.json({ error: 'Slug bereits vorhanden' }, { status: 409 });
    return NextResponse.json({ slug: clean });
}

export async function DELETE(req: NextRequest) {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { slug } = await req.json();
    await supabase.from('reserved_slugs').delete().eq('slug', slug);
    return NextResponse.json({ success: true });
}
