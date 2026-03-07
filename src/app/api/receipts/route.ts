import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabase } from '@/lib/db';
import { compressIfImage } from '@/lib/compressImage';
import { verifyToken } from '@/lib/auth';

const BUCKET = 'transaction-receipts';

export async function POST(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const fileHash = createHash('sha256').update(Buffer.from(bytes)).digest('hex');

    // Duplicate check
    const { data: existing } = await supabase
        .from('pankonauten_transaction_receipts')
        .select('id, file_name, uploaded_at, transaction_id')
        .eq('file_hash', fileHash)
        .maybeSingle();
    if (existing) {
        return NextResponse.json({ duplicate: true, existing }, { status: 409 });
    }

    const { data: fileData, contentType, compressed } = await compressIfImage(bytes, file.type);

    const uuid = crypto.randomUUID();
    const ext = compressed ? 'webp' : (file.name.split('.').pop() ?? 'bin');
    const fileName = compressed ? file.name.replace(/\.[^.]+$/, '.webp') : file.name;
    const filePath = `unlinked/${uuid}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, fileData, { contentType });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data, error } = await supabase
        .from('pankonauten_transaction_receipts')
        .insert({ transaction_id: null, file_path: filePath, file_name: fileName, file_size: fileData.length, file_hash: fileHash })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
