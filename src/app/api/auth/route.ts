import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail, updateUserLastLogin, getOrgBySlug } from '@/lib/data';
import { signToken } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

function extractSubdomain(host: string): string | null {
    const hostname = host.split(':')[0];
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return process.env.DEV_ORG_SLUG || 'pankonauten';
    }
    const parts = hostname.split('.');
    if (parts.length < 3) return null;
    return parts[0];
}

export async function POST(req: NextRequest) {
    const limited = rateLimit(req, 'login', 10, 15 * 60 * 1000);
    if (limited) return limited;

    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'E-Mail und Passwort erforderlich' }, { status: 400 });
        }

        // Org aus Subdomain ermitteln
        const host = req.headers.get('host') || '';
        const slug = extractSubdomain(host);
        if (!slug) {
            return NextResponse.json({ error: 'Unbekannte Organisation' }, { status: 400 });
        }

        const org = await getOrgBySlug(slug);
        if (!org) {
            return NextResponse.json({ error: 'Organisation nicht gefunden' }, { status: 404 });
        }

        const user = await getUserByEmail(email, org.id);
        if (!user) {
            return NextResponse.json({ error: 'Ungültige Anmeldedaten' }, { status: 401 });
        }

        if (user.status === 'invited') {
            return NextResponse.json(
                { error: 'Bitte nimm zuerst die Einladung an – prüfe deine E-Mails.' },
                { status: 403 }
            );
        }

        if (user.status === 'pending') {
            return NextResponse.json(
                { error: 'Dein Account wird noch geprüft. Du erhältst eine E-Mail, sobald er freigeschaltet wurde.' },
                { status: 403 }
            );
        }

        if (user.status === 'inactive') {
            return NextResponse.json(
                { error: 'Dein Account wurde deaktiviert. Bitte wende dich an einen Administrator.' },
                { status: 403 }
            );
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return NextResponse.json({ error: 'Ungültige Anmeldedaten' }, { status: 401 });
        }

        updateUserLastLogin(user.id, new Date().toISOString()).catch(err => {
            console.error('Failed to update last_login_at:', err);
        });

        const token = await signToken({
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            orgId: org.id,
            orgSlug: org.slug,
        });

        const response = NextResponse.json({
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
        });
        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24,
            path: '/',
        });

        return response;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error('Login error:', error.code || error.message);

        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return NextResponse.json({ error: 'Dienst vorübergehend nicht verfügbar.' }, { status: 503 });
        }

        return NextResponse.json({ error: 'Anmeldung fehlgeschlagen.' }, { status: 500 });
    }
}

export async function DELETE() {
    const response = NextResponse.json({ success: true });
    response.cookies.delete('token');
    return response;
}
