import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getUserByEmail, saveUser, getOrgBySlug } from '@/lib/data';
import { sendPasswordResetEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rateLimit';

function extractSubdomain(host: string): string {
    const hostname = host.split(':')[0];
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return process.env.DEV_ORG_SLUG || 'pankonauten';
    }
    const parts = hostname.split('.');
    return parts.length >= 3 ? parts[0] : 'pankonauten';
}

export async function POST(req: NextRequest) {
    const limited = rateLimit(req, 'password-reset', 5, 60 * 60 * 1000);
    if (limited) return limited;

    try {
        const { email } = await req.json();
        if (!email) {
            return NextResponse.json({ error: 'E-Mail erforderlich' }, { status: 400 });
        }

        const host = req.headers.get('host') || '';
        const slug = extractSubdomain(host);
        const org = await getOrgBySlug(slug);

        // Immer gleiche Antwort zurückgeben – kein User-Enumeration
        if (!org) {
            return NextResponse.json({ success: true });
        }

        const user = await getUserByEmail(email, org.id);

        if (!user || user.status === 'invited') {
            return NextResponse.json({ success: true });
        }

        const resetToken = randomBytes(32).toString('hex');
        const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 Stunde

        await saveUser({
            ...user,
            organization_id: org.id,
            invite_token: resetToken,
            invite_expires_at: resetExpiresAt,
        });

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${slug}.kitanaut.de`;
        const resetUrl = `${baseUrl}/passwort-reset/${resetToken}`;

        try {
            await sendPasswordResetEmail(email, user.name, resetUrl, org.id);
        } catch (emailErr) {
            console.error('Password reset email failed:', emailErr);
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 });
    }
}
