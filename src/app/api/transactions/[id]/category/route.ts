import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyToken } from '@/lib/auth';
import { updateTransactionCategory } from '@/lib/data';

export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const token = req.cookies.get('token')?.value;
        const payload = token ? await verifyToken(token) : null;

        if (!payload || payload.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();
        const { category } = body;

        if (!category) {
            return NextResponse.json({ error: 'Kategorie fehlt' }, { status: 400 });
        }

        await updateTransactionCategory(id, category);

        // Revalidate the pages
        revalidatePath('/dashboard');
        revalidatePath('/kontoauszug');
        revalidatePath('/kategorien');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update category error:', error);
        return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 });
    }
}
