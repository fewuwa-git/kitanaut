import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getUserByEmail, saveUser } from '@/lib/data';
import { rateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
    const limited = rateLimit(req, 'register', 5, 60 * 60 * 1000);
    if (limited) return limited;

    try {
        const { name, email, password } = await req.json();

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Name, E-Mail und Passwort erforderlich' }, { status: 400 });
        }
        if (password.length < 8) {
            return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen haben' }, { status: 400 });
        }

        const existing = await getUserByEmail(email);
        if (existing) {
            return NextResponse.json({ error: 'Diese E-Mail-Adresse ist bereits registriert' }, { status: 409 });
        }

        const hashed = await bcrypt.hash(password, 10);
        const newUser = {
            id: uuidv4(),
            name,
            email,
            password: hashed,
            role: 'member' as const,
            status: 'pending',
            created_at: new Date().toISOString(),
        };
        await saveUser(newUser);

        return NextResponse.json({ success: true }, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 });
    }
}
