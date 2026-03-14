import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/db';

const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000002';

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;

    const { data: user, error } = await supabase
        .from('pankonauten_users')
        .select('id, name, email, invite_token, invite_expires_at, status')
        .eq('invite_token', token)
        .single();

    if (error || !user) {
        return NextResponse.json({ valid: false, error: 'Ungültiger Link' }, { status: 404 });
    }

    if (user.status === 'invited') {
        return NextResponse.json({ valid: false, error: 'Ungültiger Link' }, { status: 404 });
    }

    if (!user.invite_expires_at || new Date(user.invite_expires_at) < new Date()) {
        return NextResponse.json({ valid: false, error: 'Der Link ist abgelaufen. Bitte fordere einen neuen an.' }, { status: 410 });
    }

    return NextResponse.json({ valid: true });
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;
    const { password } = await req.json();

    if (!password || password.length < 8) {
        return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen haben' }, { status: 400 });
    }

    const { data: user, error } = await supabase
        .from('pankonauten_users')
        .select('id, invite_expires_at, status, organization_id')
        .eq('invite_token', token)
        .single();

    if (error || !user) {
        return NextResponse.json({ error: 'Ungültiger Link' }, { status: 404 });
    }

    if (user.status === 'invited') {
        return NextResponse.json({ error: 'Ungültiger Link' }, { status: 404 });
    }

    if (user.organization_id === DEMO_ORG_ID) {
        return NextResponse.json({ error: 'Passwort kann in der Demo nicht geändert werden' }, { status: 403 });
    }

    if (!user.invite_expires_at || new Date(user.invite_expires_at) < new Date()) {
        return NextResponse.json({ error: 'Der Link ist abgelaufen. Bitte fordere einen neuen an.' }, { status: 410 });
    }

    const hashed = await bcrypt.hash(password, 10);

    const { error: updateError } = await supabase
        .from('pankonauten_users')
        .update({
            password: hashed,
            invite_token: null,
            invite_expires_at: null,
        })
        .eq('id', user.id);

    if (updateError) {
        return NextResponse.json({ error: 'Fehler beim Speichern des Passworts' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
