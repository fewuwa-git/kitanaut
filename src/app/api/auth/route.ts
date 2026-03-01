import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail, updateUserLastLogin } from '@/lib/data';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'E-Mail und Passwort erforderlich' }, { status: 400 });
        }

        const user = await getUserByEmail(email);
        if (!user) {
            return NextResponse.json({ error: 'Ungültige Anmeldedaten' }, { status: 401 });
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
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return response;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error('Login error detail:', {
            message: error.message,
            code: error.code,
            errno: error.errno,
            stack: error.stack
        });

        // Specific error for database connection issues
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return NextResponse.json(
                { error: 'Datenbank-Verbindung fehlgeschlagen. Bitte prüfe den SSH-Tunnel.' },
                { status: 503 }
            );
        }

        return NextResponse.json({ error: 'Server-Fehler: ' + (error.message || 'Unbekannt') }, { status: 500 });
    }
}

export async function DELETE() {
    const response = NextResponse.json({ success: true });
    response.cookies.delete('token');
    return response;
}
