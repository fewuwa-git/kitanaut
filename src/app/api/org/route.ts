import { NextRequest, NextResponse } from 'next/server';
import { getOrgById, updateOrg } from '@/lib/data';

const ALLOWED_FIELDS = [
    'name', 'from_email', 'address_street', 'address_zip', 'address_city',
    'phone', 'website', 'iban', 'bic', 'bank_name', 'legal_form', 'tax_number', 'contact_person',
] as const;

export async function GET(req: NextRequest) {
    const orgId = req.headers.get('x-org-id');
    if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 });

    const org = await getOrgById(orgId);
    if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(org);
}

export async function PATCH(req: NextRequest) {
    const role = req.headers.get('x-user-role');
    if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const orgId = req.headers.get('x-org-id');
    if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 });

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
        if (field in body) updates[field] = body[field];
    }

    await updateOrg(orgId, updates);
    return NextResponse.json({ ok: true });
}
