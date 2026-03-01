import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
    const { data: txs, error } = await supabase.from('pankonauten_transactions').select('*').limit(5);
    return NextResponse.json({ transactions: txs, error });
}
