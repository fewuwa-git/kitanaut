import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, signToken } from '@/lib/auth';

const INACTIVITY_TIMEOUT = 60 * 60 * 24; // 24 Stunden in Sekunden

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: INACTIVITY_TIMEOUT,
    path: '/',
};

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Öffentliche Routen – kein Auth nötig
    if (
        pathname.startsWith('/login') ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/einladen') ||
        pathname.startsWith('/api/invite') ||
        pathname.startsWith('/api/debug-env')
    ) {
        return NextResponse.next();
    }

    const token = req.cookies.get('token')?.value;

    if (!token) {
        if (pathname.startsWith('/api')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/login', req.url));
    }

    const payload = await verifyToken(token);

    if (!payload) {
        // Token abgelaufen oder ungültig → ausloggen
        if (pathname.startsWith('/api')) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        const response = NextResponse.redirect(new URL('/login', req.url));
        response.cookies.delete('token');
        return response;
    }

    // Token gültig → Ablaufzeit erneuern (Sliding Session)
    const newToken = await signToken({
        userId: payload.userId,
        email: payload.email,
        name: payload.name,
        role: payload.role,
    });

    // Payload als Request-Header weitergeben → Pages müssen Token nicht nochmal verifizieren
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', payload.userId);
    requestHeaders.set('x-user-role', payload.role);
    requestHeaders.set('x-user-name', payload.name);
    requestHeaders.set('x-user-email', payload.email);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.cookies.set('token', newToken, COOKIE_OPTIONS);
    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
