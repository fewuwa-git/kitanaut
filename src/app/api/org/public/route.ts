import { NextRequest, NextResponse } from 'next/server';
import { getOrgBySlug } from '@/lib/data';

function extractSlug(host: string): string {
    const hostname = host.split(':')[0];
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return process.env.DEV_ORG_SLUG || 'pankonauten';
    }
    const parts = hostname.split('.');
    return parts.length >= 3 ? parts[0] : 'pankonauten';
}

export async function GET(req: NextRequest) {
    const host = req.headers.get('host') || '';
    const slug = extractSlug(host);
    const org = await getOrgBySlug(slug);
    if (!org) return NextResponse.json({ name: 'Kitanaut', logo_url: null });
    return NextResponse.json({ name: org.name, logo_url: org.logo_url });
}
