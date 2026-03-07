import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail, updateUserLastLogin } from '@/lib/data';
import { signToken } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
    const limited = rateLimit(req, 'login', 10, 15 * 60 * 1000);
    if (limited) return limited;

    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'E-Mail und Passwort erforderlich' }, { status: 400 });
        }

        const user = await getUserByEmail(email);
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

        // Update the user's last login timestamp without waiting to block the response
        updateUserLastLogin(user.id, new Date().toISOString()).catch(err => {
            console.error('Failed to update last_login_at:', err);
        });


        const token = await signToken({
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        });

        const response = NextResponse.json({
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
        });
        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 24 Stunden (Inactivity Timeout via Middleware)
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
