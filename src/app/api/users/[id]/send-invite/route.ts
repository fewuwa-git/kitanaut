import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { sendInviteEmail } from '@/lib/email';
import { supabase } from '@/lib/db';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;

    const { data: user, error } = await supabase
        .from('pankonauten_users')
        .select('name, email, invite_token, status')
        .eq('id', id)
        .single();

    if (error || !user) {
        return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    if (!user.invite_token) {
        return NextResponse.json({ error: 'Kein Einladungstoken vorhanden' }, { status: 400 });
    }

    const host = req.headers.get('host') || '';
    const hostname = host.split(':')[0];
    const baseUrl = hostname === 'localhost' || hostname === '127.0.0.1'
        ? `http://${host}`
        : `https://${hostname}`;
    const inviteUrl = `${baseUrl}/einladen/${user.invite_token}`;

    try {
        await sendInviteEmail(user.email, user.name, inviteUrl, payload.orgId);
    } catch {
        return NextResponse.json({ error: 'E-Mail konnte nicht gesendet werden' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
