import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getAbrechnung, saveAbrechnung, saveAbrechnungTag, deleteAbrechnungTag, deleteAbrechnung, updateAbrechnungStatus, getUserById, getAbrechnungTagOwner } from '@/lib/data';
import { sendAbrechnungBezahltEmail } from '@/lib/email';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || (payload.role !== 'admin' && payload.role !== 'finanzvorstand' && payload.role !== 'springerin')) {
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
    } catch {
        return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || (payload.role !== 'admin' && payload.role !== 'finanzvorstand' && payload.role !== 'springerin')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { action, jahr, monat, tag, userId } = body;
        const targetUserId = ((payload.role === 'admin' || payload.role === 'finanzvorstand') && userId) || payload.userId;

        if (action === 'save_tag') {
            if (!jahr || !monat || !tag) {
                return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
            }

            // Ensure the main Abrechnung exists
            let { abrechnung } = await getAbrechnung(targetUserId, jahr, monat);

            const isNew = !abrechnung;
            if (!abrechnung) {
                abrechnung = await saveAbrechnung({
                    user_id: targetUserId,
                    jahr,
                    monat,
                    status: 'entwurf',
                });
                if (isNew) {
                    await logAudit(payload.userId, payload.name, 'abrechnung_erstellt', { monat, jahr });
                }
            }

            // Save the tag
            const savedTag = await saveAbrechnungTag({
                ...tag,
                abrechnung_id: abrechnung.id,
            });

            return NextResponse.json({ abrechnung, tag: savedTag });
        }

        if (action === 'update_status') {
            const { id, status, sendEmail } = body;
            if (!id || !status) {
                return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
            }

            // Springerin darf nur auf 'eingereicht' setzen
            if (payload.role === 'springerin' && status !== 'eingereicht') {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            // Admin/Finanzvorstand darf auf 'eingereicht' und 'bezahlt' setzen
            if ((payload.role === 'admin' || payload.role === 'finanzvorstand') && !['eingereicht', 'bezahlt'].includes(status)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            const updated = await updateAbrechnungStatus(id, status);

            if (status === 'eingereicht') {
                await logAudit(payload.userId, payload.name, 'abrechnung_eingereicht', {
                    monat: updated.monat, jahr: updated.jahr,
                });
            } else if (status === 'bezahlt') {
                await logAudit(payload.userId, payload.name, 'abrechnung_bezahlt', {
                    monat: updated.monat, jahr: updated.jahr, user_name: (await getUserById(updated.user_id))?.name,
                });
            }

            if (status === 'bezahlt' && sendEmail !== false) {
                try {
                    const { tage } = await getAbrechnung(updated.user_id, updated.jahr, updated.monat);
                    const user = await getUserById(updated.user_id);
                    if (user && user.email) {
                        const gesamtbetrag = tage.reduce((sum, t) => sum + (t.betrag || 0), 0);
                        const monatsnamen = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
                        await sendAbrechnungBezahltEmail(
                            user.email,
                            user.name,
                            monatsnamen[updated.monat - 1] || String(updated.monat),
                            String(updated.jahr),
                            gesamtbetrag.toFixed(2).replace('.', ','),
                            user.iban || 'hinterlegtes Konto',
                        );
                    }
                } catch (mailErr) {
                    console.error('Bezahlt-Mail konnte nicht gesendet werden:', mailErr);
                }
            }

            return NextResponse.json({ abrechnung: updated });
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

    } catch {
        return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || (payload.role !== 'admin' && payload.role !== 'finanzvorstand' && payload.role !== 'springerin')) {
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
            if (payload.role !== 'admin' && payload.role !== 'finanzvorstand') {
                const ownerUserId = await getAbrechnungTagOwner(tagId);
                if (ownerUserId !== payload.userId) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
            }
            await deleteAbrechnungTag(tagId);
        } else if (id) {
            // Only admin/finanzvorstand can delete whole abrechnung
            if (payload.role !== 'admin' && payload.role !== 'finanzvorstand') {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            await deleteAbrechnung(id);
        }
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 });
    }
}
