import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

const BUCKET = 'transaction-receipts';

// Get signed URL for a receipt
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { data } = await supabase
        .from('pankonauten_transaction_receipts')
        .select('file_path')
        .eq('id', id)
        .single();
    if (!data) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    const { data: urlData } = await supabase.storage.from(BUCKET).createSignedUrl(data.file_path, 3600);
    return NextResponse.json({ url: urlData?.signedUrl ?? null });
}

// Link receipt to a transaction
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { transaction_id, method } = await req.json();
    const linkedBy = req.headers.get('x-user-name') || req.headers.get('x-user-email') || 'Unbekannt';
    const linkedAt = new Date().toISOString();
    const linkedMethod = method === 'ki' ? 'ki' : 'manual';

    const { data: receipt } = await supabase
        .from('pankonauten_transaction_receipts')
        .select('file_path')
        .eq('id', id)
        .single();

    if (!receipt) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    const linkFields = { transaction_id, linked_method: linkedMethod, linked_at: linkedAt, linked_by: linkedBy };

    // Move file from unlinked/ to transaction folder if needed
    if (receipt.file_path.startsWith('unlinked/')) {
        const fileName = receipt.file_path.split('/').pop();
        const newPath = `${transaction_id}/${fileName}`;
        const { error: moveError } = await supabase.storage.from(BUCKET).move(receipt.file_path, newPath);
        if (!moveError) {
            await supabase.from('pankonauten_transaction_receipts').update({ file_path: newPath, ...linkFields }).eq('id', id);
            return NextResponse.json({ ok: true });
        }
    }

    const { error } = await supabase
        .from('pankonauten_transaction_receipts')
        .update(linkFields)
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}

// Delete unlinked receipt
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const { data } = await supabase
        .from('pankonauten_transaction_receipts')
        .select('file_path')
        .eq('id', id)
        .single();

    if (!data) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    await supabase.storage.from(BUCKET).remove([data.file_path]);
    await supabase.from('pankonauten_transaction_receipts').delete().eq('id', id);

    return NextResponse.json({ ok: true });
}
