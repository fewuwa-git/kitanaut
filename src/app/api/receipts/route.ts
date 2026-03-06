import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

const BUCKET = 'transaction-receipts';

// Upload without transaction
export async function POST(req: NextRequest) {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 });

    const ext = file.name.split('.').pop();
    const uuid = crypto.randomUUID();
    const filePath = `unlinked/${uuid}.${ext}`;

    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, bytes, { contentType: file.type });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data, error } = await supabase
        .from('pankonauten_transaction_receipts')
        .insert({ transaction_id: null, file_path: filePath, file_name: file.name, file_size: file.size })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
