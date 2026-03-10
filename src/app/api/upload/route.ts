import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { addTransactions } from '@/lib/data';
import { Transaction } from '@/lib/data';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
    try {
        const token = req.cookies.get('token')?.value;
        const payload = token ? await verifyToken(token) : null;
        if (!payload || (payload.role !== 'admin' && payload.role !== 'finanzvorstand')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
        const body = await req.json();
        const { transactions } = body;

        if (!Array.isArray(transactions) || transactions.length === 0) {
            return NextResponse.json({ error: 'Keine Transaktionen übergeben' }, { status: 400 });
        }

        const mapped: Transaction[] = transactions.map((t: Partial<Transaction>) => ({
            id: uuidv4(),
            date: t.date || new Date().toISOString().split('T')[0],
            description: t.description || '',
            counterparty: t.counterparty || '',
            amount: Number(t.amount) || 0,
            category: t.category || 'Sonstige',
            type: Number(t.amount) >= 0 ? 'income' : 'expense',
            balance: Number(t.balance) || 0,
        }));

        const uniqueImportedCount = await addTransactions(mapped);

        await logAudit(payload.userId, payload.name, 'csv_import', { count: uniqueImportedCount });

        // Revalidate the pages so the new data shows up immediately
        revalidatePath('/dashboard');
        revalidatePath('/kontoauszug');

        return NextResponse.json({ imported: uniqueImportedCount });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 });
    }
}
