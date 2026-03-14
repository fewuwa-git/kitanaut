import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, signToken, verifySuperAdminToken, signSuperAdminToken } from '@/lib/auth';

const INACTIVITY_TIMEOUT = 60 * 60 * 24;

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: INACTIVITY_TIMEOUT,
    path: '/',
};

function extractSubdomain(host: string): string | null {
    const hostname = host.split(':')[0];
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return process.env.DEV_ORG_SLUG || 'pankonauten';
    }
    const parts = hostname.split('.');
    if (parts.length < 3) return null;
    return parts[0];
}

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const host = req.headers.get('host') || '';
    const subdomain = extractSubdomain(host);

    // ── Super-Admin (admin.kitanaut.de) ───────────────────────────────────────
    if (subdomain === 'admin') {
        if (
            pathname.startsWith('/admin/login') ||
            pathname.startsWith('/api/admin-auth')
        ) {
            return NextResponse.next();
        }

        const adminToken = req.cookies.get('admin_token')?.value;
        if (!adminToken) {
            if (pathname.startsWith('/api')) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            const loginUrl = new URL('/admin/login', req.url);
            if (pathname !== '/admin/login') loginUrl.searchParams.set('redirect', pathname);
            return NextResponse.redirect(loginUrl);
        }

        const adminPayload = await verifySuperAdminToken(adminToken);
        if (!adminPayload) {
            if (pathname.startsWith('/api')) {
                return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
            }
            const loginUrl = new URL('/admin/login', req.url);
            if (pathname !== '/admin/login') loginUrl.searchParams.set('redirect', pathname);
            const response = NextResponse.redirect(loginUrl);
            response.cookies.delete('admin_token');
            return response;
        }

        const newAdminToken = await signSuperAdminToken(adminPayload);
        const response = NextResponse.next();
        response.cookies.set('admin_token', newAdminToken, COOKIE_OPTIONS);
        return response;
    }

    // ── Öffentliche Routen ────────────────────────────────────────────────────
    if (
        pathname.startsWith('/login') ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/api/org/public') ||
        pathname.startsWith('/einladen') ||
        pathname.startsWith('/api/invite') ||
        pathname.startsWith('/registrieren') ||
        pathname.startsWith('/api/register-org') ||
        pathname.startsWith('/passwort-reset') ||
        pathname.startsWith('/api/password-reset')
    ) {
        return NextResponse.next();
    }

    // Keine Subdomain → Login
    if (!subdomain) {
        return NextResponse.redirect(new URL('/login', req.url));
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
        if (pathname.startsWith('/api')) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        const response = NextResponse.redirect(new URL('/login', req.url));
        response.cookies.delete('token');
        return response;
    }

    // Subdomain muss zur Org im JWT passen
    if (payload.orgSlug !== subdomain) {
        if (pathname.startsWith('/api')) {
            return NextResponse.json({ error: 'Forbidden: wrong organization' }, { status: 403 });
        }
        const response = NextResponse.redirect(new URL('/login', req.url));
        response.cookies.delete('token');
        return response;
    }

    // Token erneuern (Sliding Session)
    const newToken = await signToken({
        userId: payload.userId,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        orgId: payload.orgId,
        orgSlug: payload.orgSlug,
    });

    const requestHeaders = new Headers(req.headers);
    const impersonateCookie = req.cookies.get('impersonate')?.value;
    let effectiveUserId = payload.userId;
    let effectiveRole = payload.role;
    let effectiveName = payload.name;
    let effectiveEmail = payload.email;
    let isImpersonating = false;

    if (payload.role === 'admin' && impersonateCookie) {
        try {
            const imp = JSON.parse(impersonateCookie);
            if (imp.userId && imp.name && imp.email && imp.role) {
                effectiveUserId = imp.userId;
                effectiveRole = imp.role;
                effectiveName = imp.name;
                effectiveEmail = imp.email;
                isImpersonating = true;
            }
        } catch { /* ungültiger Cookie → ignorieren */ }
    }

    requestHeaders.set('x-user-id', effectiveUserId);
    requestHeaders.set('x-user-role', effectiveRole);
    requestHeaders.set('x-user-name', effectiveName);
    requestHeaders.set('x-user-email', effectiveEmail);
    requestHeaders.set('x-org-id', payload.orgId);
    requestHeaders.set('x-org-slug', payload.orgSlug);
    if (isImpersonating) {
        requestHeaders.set('x-real-admin-name', payload.name);
    } else {
        requestHeaders.delete('x-real-admin-name');
    }

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.cookies.set('token', newToken, COOKIE_OPTIONS);
    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
