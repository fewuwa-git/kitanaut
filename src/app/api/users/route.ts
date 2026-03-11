import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUsers, saveUser, getUserByEmail } from '@/lib/data';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (payload.role === 'admin') {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const users = (await getUsers(payload.orgId)).map(({ password: _p, invite_token: _t, invite_expires_at: _e, unterschrift: _u, ...u }) => u);
        return NextResponse.json(users);
    } else {
        const user = await getUserByEmail(payload.email, payload.orgId);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _p, invite_token: _t, invite_expires_at: _e, unterschrift: _u, ...u } = user;
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

        const { name, email, role } = await req.json();
        if (!name || !email) {
            return NextResponse.json({ error: 'Name und E-Mail erforderlich' }, { status: 400 });
        }
        const existing = await getUserByEmail(email, payload.orgId);
        if (existing) {
            return NextResponse.json({ error: 'E-Mail bereits vergeben' }, { status: 409 });
        }

        const inviteToken = randomBytes(32).toString('hex');
        const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://finanzen.pankonauten.de';
        const inviteUrl = `${baseUrl}/einladen/${inviteToken}`;

        // Use a random unusable password hash so the column is never empty
        const randomPassword = await bcrypt.hash(uuidv4(), 10);

        const newUser = {
            id: uuidv4(),
            name,
            email,
            password: randomPassword,
            role: role || 'member',
            status: 'invited',
            invite_token: inviteToken,
            invite_expires_at: inviteExpiresAt,
            created_at: new Date().toISOString(),
            organization_id: payload.orgId,
        };
        await saveUser(newUser);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _p, invite_token: _t, invite_expires_at: _e, ...userWithoutSecrets } = newUser;
        return NextResponse.json({ ...userWithoutSecrets, inviteUrl }, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 });
    }
}
