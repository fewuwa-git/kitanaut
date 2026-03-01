import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUsers, saveUser, getUserByEmail } from '@/lib/data';
import { v4 as uuidv4 } from 'uuid';

import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (payload.role === 'admin') {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const users = (await getUsers()).map(({ password: _p, ...u }) => u);
        return NextResponse.json(users);
    } else {
        const user = await getUserByEmail(payload.email);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _p, ...u } = user;
        return NextResponse.json([u]);
    }
}

export async function POST(req: NextRequest) {
    try {
        const token = req.cookies.get('token')?.value;
        const payload = token ? await verifyToken(token) : null;
        if (!payload || payload.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { name, email, password, role } = await req.json();
        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Name, E-Mail und Passwort erforderlich' }, { status: 400 });
        }
        const existing = await getUserByEmail(email);
        if (existing) {
            return NextResponse.json({ error: 'E-Mail bereits vergeben' }, { status: 409 });
        }
        const hashed = await bcrypt.hash(password, 10);
        const newUser = {
            id: uuidv4(),
            name,
            email,
            password: hashed,
            role: role || 'member',
            created_at: new Date().toISOString(),
        };
        await saveUser(newUser);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _p, ...userWithoutPassword } = newUser;
        return NextResponse.json(userWithoutPassword, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 });
    }
}
