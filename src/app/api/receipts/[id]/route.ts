import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

const BUCKET = 'transaction-receipts';

// Get signed URL for a receipt
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { data } = await supabase
        .from('kitanaut_transaction_receipts')
        .select('file_path')
        .eq('id', id)
        .single();
    if (!data) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    const { data: urlData } = await supabase.storage.from(BUCKET).createSignedUrl(data.file_path, 3600);
    return NextResponse.json({ url: urlData?.signedUrl ?? null });
}

// Link or unlink receipt from a transaction
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const { data: receipt } = await supabase
        .from('kitanaut_transaction_receipts')
        .select('file_path, file_name')
        .eq('id', id)
        .single();

    if (!receipt) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    // Unlink: remove transaction association, move file back to unlinked/
    if (body.unlink === true) {
        const fileName = receipt.file_path.split('/').pop();
        const newPath = `unlinked/${fileName}`;
        if (!receipt.file_path.startsWith('unlinked/')) {
            const { error: moveError } = await supabase.storage.from(BUCKET).move(receipt.file_path, newPath);
            if (!moveError) {
                await supabase.from('kitanaut_transaction_receipts')
                    .update({ file_path: newPath, transaction_id: null, linked_method: null, linked_at: null, linked_by: null })
                    .eq('id', id);
                return NextResponse.json({ ok: true, file_path: newPath });
            }
        }
        await supabase.from('kitanaut_transaction_receipts')
            .update({ transaction_id: null, linked_method: null, linked_at: null, linked_by: null })
            .eq('id', id);
        return NextResponse.json({ ok: true, file_path: receipt.file_path });
    }

    // Link: set transaction association
    const { transaction_id, method } = body;
    const linkedBy = payload.name || payload.email;
    const linkedAt = new Date().toISOString();
    const linkedMethod = method === 'ki' ? 'ki' : 'manual';
    const linkFields = { transaction_id, linked_method: linkedMethod, linked_at: linkedAt, linked_by: linkedBy };

    // Move file from unlinked/ to transaction folder if needed
    if (receipt.file_path.startsWith('unlinked/')) {
        const fileName = receipt.file_path.split('/').pop();
        const newPath = `${transaction_id}/${fileName}`;
        const { error: moveError } = await supabase.storage.from(BUCKET).move(receipt.file_path, newPath);
        if (!moveError) {
            await supabase.from('kitanaut_transaction_receipts').update({ file_path: newPath, ...linkFields }).eq('id', id);
            return NextResponse.json({ ok: true });
        }
    }

    const { error } = await supabase
        .from('kitanaut_transaction_receipts')
        .update(linkFields)
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}

// Delete unlinked receipt
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const { data } = await supabase
        .from('kitanaut_transaction_receipts')
        .select('file_path')
        .eq('id', id)
        .single();

    if (!data) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    await supabase.storage.from(BUCKET).remove([data.file_path]);
    await supabase.from('kitanaut_transaction_receipts').delete().eq('id', id);

    return NextResponse.json({ ok: true });
}
