import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getAbrechnung, saveAbrechnung, saveAbrechnungTag, deleteAbrechnungTag, deleteAbrechnung } from '@/lib/data';

export async function GET(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || (payload.role !== 'admin' && payload.role !== 'springerin')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jahr = parseInt(searchParams.get('jahr') || '0', 10);
    const monat = parseInt(searchParams.get('monat') || '0', 10);
    const targetUserId = (payload.role === 'admin' && searchParams.get('userId')) || payload.userId;

    if (!jahr || !monat) {
        return NextResponse.json({ error: 'Missing jahr or monat' }, { status: 400 });
    }

    try {
        const data = await getAbrechnung(targetUserId, jahr, monat);
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || (payload.role !== 'admin' && payload.role !== 'springerin')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { action, jahr, monat, tag, userId } = body;
        const targetUserId = (payload.role === 'admin' && userId) || payload.userId;

        if (action === 'save_tag') {
            if (!jahr || !monat || !tag) {
                return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
            }

            // Ensure the main Abrechnung exists
            let { abrechnung } = await getAbrechnung(targetUserId, jahr, monat);

            if (!abrechnung) {
                abrechnung = await saveAbrechnung({
                    user_id: targetUserId,
                    jahr,
                    monat,
                    status: 'entwurf',
                });
            }

            // Save the tag
            const savedTag = await saveAbrechnungTag({
                ...tag,
                abrechnung_id: abrechnung.id,
            });

            return NextResponse.json({ abrechnung, tag: savedTag });
        }

        if (action === 'recalculate_rates') {
            if (!jahr || !monat) {
                return NextResponse.json({ error: 'Missing jahr or monat' }, { status: 400 });
            }

            const { recalculateAbrechnungRates } = await import('@/lib/data');
            await recalculateAbrechnungRates(targetUserId, jahr, monat);

            const data = await getAbrechnung(targetUserId, jahr, monat);
            return NextResponse.json(data);
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || (payload.role !== 'admin' && payload.role !== 'springerin')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get('tagId');
    const id = searchParams.get('id');

    if (!tagId && !id) {
        return NextResponse.json({ error: 'Missing tagId or id' }, { status: 400 });
    }

    try {
        if (tagId) {
            await deleteAbrechnungTag(tagId);
        } else if (id) {
            // Only admin can delete whole abrechnung
            if (payload.role !== 'admin') {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            await deleteAbrechnung(id);
        }
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
