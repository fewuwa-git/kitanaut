import { NextRequest, NextResponse } from 'next/server';
import { getUserById, deleteUser, getUsers, saveUser, getUserByEmail } from '@/lib/data';
import { verifyToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const user = await getUserById(id);
    if (!user) {
        return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    }
    user.status = 'inactive';
    await saveUser(user);
    return NextResponse.json({ success: true, message: 'User deaktiviert' });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const user = await getUserById(id);
    if (!user) {
        return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    }

    const isAdmin = payload.role === 'admin';
    const isSelf = user.email === payload.email;

    if (!isAdmin && !isSelf) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Admin kann Name, Rolle, Status ändern
    if (isAdmin) {
        if (body.name !== undefined) user.name = body.name;
        if (body.role !== undefined) user.role = body.role;
        if (body.status !== undefined) user.status = body.status;
    }

    // Springerin kann zusätzlich folgende Felder ändern (auch Admin kann sie ändern, falls nötig)
    if (isAdmin || (isSelf && user.role === 'springerin')) {
        if (body.name !== undefined) user.name = body.name;
        if (body.strasse !== undefined) user.strasse = body.strasse;
        if (body.ort !== undefined) user.ort = body.ort;
        if (body.iban !== undefined) user.iban = body.iban;
        if (body.steuerid !== undefined) user.steuerid = body.steuerid;
        if (body.handynummer !== undefined) user.handynummer = body.handynummer;
        if (body.stundensatz !== undefined) user.stundensatz = body.stundensatz;
    }

    // Alle (die Berechtigung haben = isSelf oder isAdmin) dürfen Email und Passwort ändern
    if (body.email && body.email !== user.email) {
        const existing = await getUserByEmail(body.email);
        if (existing) {
            return NextResponse.json({ error: 'E-Mail bereits vergeben' }, { status: 409 });
        }
        user.email = body.email;
    }

    if (body.password) {
        user.password = await bcrypt.hash(body.password, 10);
    }

    await saveUser(user);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _p, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword);
}
