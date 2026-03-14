import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

const BUCKET = 'transaction-receipts';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; receiptId: string }> }) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { receiptId } = await params;

    const { data, error: fetchError } = await supabase
        .from('kitanaut_transaction_receipts')
        .select('file_path')
        .eq('id', receiptId)
        .single();

    if (fetchError || !data) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    await supabase.storage.from(BUCKET).remove([data.file_path]);

    const { error } = await supabase
        .from('kitanaut_transaction_receipts')
        .delete()
        .eq('id', receiptId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
}
