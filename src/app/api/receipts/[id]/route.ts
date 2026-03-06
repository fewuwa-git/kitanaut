import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

const BUCKET = 'transaction-receipts';

// Link receipt to a transaction
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { transaction_id } = await req.json();

    const { data: receipt } = await supabase
        .from('pankonauten_transaction_receipts')
        .select('file_path')
        .eq('id', id)
        .single();

    if (!receipt) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    // Move file from unlinked/ to transaction folder if needed
    if (receipt.file_path.startsWith('unlinked/')) {
        const fileName = receipt.file_path.split('/').pop();
        const newPath = `${transaction_id}/${fileName}`;
        const { error: moveError } = await supabase.storage.from(BUCKET).move(receipt.file_path, newPath);
        if (!moveError) {
            await supabase.from('pankonauten_transaction_receipts').update({ file_path: newPath, transaction_id }).eq('id', id);
            return NextResponse.json({ ok: true });
        }
    }

    const { error } = await supabase
        .from('pankonauten_transaction_receipts')
        .update({ transaction_id })
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
