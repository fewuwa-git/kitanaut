import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

const BUCKET = 'transaction-receipts';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { data, error } = await supabase
        .from('pankonauten_transaction_receipts')
        .select('*')
        .eq('transaction_id', id)
        .order('uploaded_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const receipts = await Promise.all(
        (data || []).map(async (r) => {
            const { data: urlData } = await supabase.storage
                .from(BUCKET)
                .createSignedUrl(r.file_path, 3600);
            return { ...r, url: urlData?.signedUrl ?? null };
        })
    );

    return NextResponse.json(receipts);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 });

    const ext = file.name.split('.').pop();
    const uuid = crypto.randomUUID();
    const filePath = `${id}/${uuid}.${ext}`;

    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, bytes, { contentType: file.type });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data, error } = await supabase
        .from('pankonauten_transaction_receipts')
        .insert({ transaction_id: id, file_path: filePath, file_name: file.name, file_size: file.size })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: urlData } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 3600);
    return NextResponse.json({ ...data, url: urlData?.signedUrl ?? null });
}
