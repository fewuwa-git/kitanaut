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

export async function GET(req: NextRequest) {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source') || '';
    const status = searchParams.get('status') || '';
    const q = searchParams.get('q') || '';

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (source) {
        conditions.push(`source = $${idx++}`);
        params.push(source);
    }
    if (status) {
        conditions.push(`status = $${idx++}`);
        params.push(status);
    }
    if (q) {
        conditions.push(`(
            name ILIKE $${idx} OR
            ort ILIKE $${idx} OR
            bezirk ILIKE $${idx} OR
            telefon ILIKE $${idx} OR
            email ILIKE $${idx} OR
            traeger ILIKE $${idx} OR
            strasse ILIKE $${idx}
        )`);
        params.push(`%${q}%`);
        idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM crm_prospects ${where} ORDER BY name ASC`;

    const client = getClient();
    try {
        await client.connect();
        const result = await client.query(sql, params);
        return NextResponse.json(result.rows);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    } finally {
        await client.end().catch(() => {});
    }
}
