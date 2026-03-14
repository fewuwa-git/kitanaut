import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySuperAdminToken } from '@/lib/auth';
import { Client } from 'pg';

async function requireAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    return token ? await verifySuperAdminToken(token) : null;
}

function getClient() {
    return new Client({
        host: 'db.mvlnkqgitafkamsujymi.supabase.co',
        user: 'postgres',
        password: 'xwd7bex2kby!xdb!CTK',
        database: 'postgres',
        ssl: { rejectUnauthorized: false },
        port: 5432,
    });
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { status, notizen } = body;

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (status !== undefined) {
        updates.push(`status = $${idx++}`);
        values.push(status);
    }
    if (notizen !== undefined) {
        updates.push(`notizen = $${idx++}`);
        values.push(notizen);
    }

    if (updates.length === 0) {
        return NextResponse.json({ error: 'Keine Felder zum Aktualisieren' }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const client = getClient();
    try {
        await client.connect();
        const result = await client.query(
            `UPDATE crm_prospects SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );
        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
        }
        return NextResponse.json(result.rows[0]);
    } finally {
        await client.end();
    }
}
