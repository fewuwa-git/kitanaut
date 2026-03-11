import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUsers } from '@/lib/data';

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
};

export async function GET(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const impersonateCookie = req.cookies.get('impersonate')?.value;
    let impersonatedUser = null;
    if (impersonateCookie) {
        try { impersonatedUser = JSON.parse(impersonateCookie); } catch { /* ignore */ }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const users = (await getUsers(payload.orgId))
        .filter(u => u.status === 'active' && u.id !== payload.userId)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ password: _p, invite_token: _t, invite_expires_at: _e, unterschrift: _u, ...u }) => u);

    return NextResponse.json({ impersonating: !!impersonatedUser, impersonatedUser, users });
}

export async function POST(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { userId } = await req.json();
    if (!userId) {
        return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 });
    }

    const allUsers = await getUsers(payload.orgId);
    const target = allUsers.find(u => u.id === userId && u.status === 'active');
    if (!target) {
        return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set('impersonate', JSON.stringify({ userId: target.id, name: target.name, email: target.email, role: target.role }), COOKIE_OPTIONS);
    return response;
}

export async function DELETE(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.delete('impersonate');
    return response;
}
