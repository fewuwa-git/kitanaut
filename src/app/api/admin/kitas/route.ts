import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { verifySuperAdminToken } from '@/lib/auth';
import {
    getAllOrganizations,
    getOrgBySlug,
    createOrganization,
    saveUser,
    seedNewOrg,
} from '@/lib/data';
import { supabase } from '@/lib/db';
import { sendInviteEmail } from '@/lib/email';

export async function GET(req: NextRequest) {
    const token = req.cookies.get('admin_token')?.value;
    const payload = token ? await verifySuperAdminToken(token) : null;
    if (!payload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const orgs = await getAllOrganizations();
    return NextResponse.json(orgs);
}

export async function POST(req: NextRequest) {
    const token = req.cookies.get('admin_token')?.value;
    const payload = token ? await verifySuperAdminToken(token) : null;
    if (!payload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { name, slug, fromEmail, adminName, adminEmail } = await req.json();

        if (!name || !slug || !fromEmail || !adminName || !adminEmail) {
            return NextResponse.json(
                { error: 'Alle Felder sind erforderlich (name, slug, fromEmail, adminName, adminEmail)' },
                { status: 400 }
            );
        }

        // Block reserved slugs (DB-backed)
        const { data: reserved } = await supabase
            .from('reserved_slugs')
            .select('slug')
            .eq('slug', slug.toLowerCase())
            .single();
        if (reserved) {
            return NextResponse.json(
                { error: `Subdomain "${slug}" ist reserviert und kann nicht verwendet werden` },
                { status: 400 }
            );
        }

        // Check slug uniqueness
        const existing = await getOrgBySlug(slug);
        if (existing) {
            return NextResponse.json(
                { error: `Subdomain "${slug}" ist bereits vergeben` },
                { status: 409 }
            );
        }

        // Create org
        const org = await createOrganization(name, slug);

        // Update from_email
        await supabase
            .from('organizations')
            .update({ from_email: fromEmail })
            .eq('id', org.id);

        // Seed categories and email templates from source org
        await seedNewOrg(org.id, name);

        // Create first admin user with invite token
        const inviteToken = randomBytes(32).toString('hex');
        const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const host = req.headers.get('host') || '';
        const hostname = host.split(':')[0];
        const baseUrl = hostname === 'localhost' || hostname === '127.0.0.1'
            ? `http://${host}`
            : `https://${slug}.kitanaut.de`;
        const inviteUrl = `${baseUrl}/einladen/${inviteToken}`;

        const randomPassword = await bcrypt.hash(uuidv4(), 10);

        const newUser = {
            id: uuidv4(),
            name: adminName,
            email: adminEmail,
            password: randomPassword,
            role: 'admin' as const,
            status: 'invited',
            invite_token: inviteToken,
            invite_expires_at: inviteExpiresAt,
            created_at: new Date().toISOString(),
            organization_id: org.id,
        };
        await saveUser(newUser);

        // Send invite email
        await sendInviteEmail(adminEmail, adminName, inviteUrl, org.id);

        return NextResponse.json({ success: true, org, inviteUrl }, { status: 201 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
        return NextResponse.json({ error: 'Server-Fehler: ' + message }, { status: 500 });
    }
}
