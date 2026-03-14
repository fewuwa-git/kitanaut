import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { updateOrg } from '@/lib/data';

const BUCKET = 'kita-logos';

export async function POST(req: NextRequest) {
    const role = req.headers.get('x-user-role');
    if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const orgId = req.headers.get('x-org-id');
    if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${orgId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: file.type, upsert: true });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    await updateOrg(orgId, { logo_url: publicUrl });

    return NextResponse.json({ logo_url: publicUrl });
}
