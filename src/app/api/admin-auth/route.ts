import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/db';
import { signSuperAdminToken, verifySuperAdminToken } from '@/lib/auth';

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24,
    path: '/',
};

// Login
export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();
        if (!email || !password) {
            return NextResponse.json({ error: 'E-Mail und Passwort erforderlich' }, { status: 400 });
        }

        const { data: admin } = await supabase
            .from('super_admins')
            .select('id, email, password_hash')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (!admin) {
            return NextResponse.json({ error: 'Ungültige Anmeldedaten' }, { status: 401 });
        }

        const valid = await bcrypt.compare(password, admin.password_hash);
        if (!valid) {
            return NextResponse.json({ error: 'Ungültige Anmeldedaten' }, { status: 401 });
        }

        const token = await signSuperAdminToken({ superAdmin: true, email: admin.email });
        const response = NextResponse.json({ success: true });
        response.cookies.set('admin_token', token, COOKIE_OPTIONS);
        return response;
    } catch {
        return NextResponse.json({ error: 'Anmeldung fehlgeschlagen' }, { status: 500 });
    }
}

// Logout
export async function DELETE() {
    const response = NextResponse.json({ success: true });
    response.cookies.delete('admin_token');
    return response;
}

// Passwort ändern
export async function PATCH(req: NextRequest) {
    const adminToken = req.cookies.get('admin_token')?.value;
    const adminPayload = adminToken ? await verifySuperAdminToken(adminToken) : null;
    if (!adminPayload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { currentPassword, newPassword } = await req.json();
        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: 'Alle Felder erforderlich' }, { status: 400 });
        }
        if (newPassword.length < 8) {
            return NextResponse.json({ error: 'Neues Passwort muss mindestens 8 Zeichen haben' }, { status: 400 });
        }

        const { data: admin } = await supabase
            .from('super_admins')
            .select('id, password_hash')
            .eq('email', adminPayload.email)
            .single();

        if (!admin) {
            return NextResponse.json({ error: 'Account nicht gefunden' }, { status: 404 });
        }

        const valid = await bcrypt.compare(currentPassword, admin.password_hash);
        if (!valid) {
            return NextResponse.json({ error: 'Aktuelles Passwort falsch' }, { status: 401 });
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        await supabase.from('super_admins').update({ password_hash: newHash }).eq('id', admin.id);

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 });
    }
}
