import { NextRequest, NextResponse } from 'next/server';
import { resetDemoData } from '@/lib/demo-seed';

export async function POST(req: NextRequest) {
    const secret = req.headers.get('authorization');
    if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        await resetDemoData();
        return NextResponse.json({ success: true, reset_at: new Date().toISOString() });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
