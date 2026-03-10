import type { Metadata } from 'next';
import React from 'react';
import { headers } from 'next/headers';

export const metadata: Metadata = { title: 'Abrechnung' };
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getAllAbrechnungen, getUserById, getSpringerinUsers } from '@/lib/data';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import PDFOverviewButton from '@/components/PDFOverviewButton';
import SpringerinFilter from '@/components/SpringerinFilter';
import DeleteAbrechnungButton from '@/components/DeleteAbrechnungButton';
import MarkAsBezahltButton from '@/components/MarkAsBezahltButton';

const STATUS_LABELS: Record<string, string> = {
    entwurf: 'Entwurf',
    eingereicht: 'Eingereicht',
    bezahlt: 'Bezahlt',
};

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
    entwurf: { bg: 'var(--orange-bg)', color: 'var(--orange)' },
    eingereicht: { bg: 'var(--blue-bg)', color: 'var(--blue)' },
    bezahlt: { bg: 'var(--green-bg)', color: '#16a34a' },
};

const getMonthName = (monthNum: number) =>
    new Date(2000, monthNum - 1).toLocaleString('de-DE', { month: 'long' });

async function AbrechnungTable({
    role,
    userId,
    selectedSpringerinId,
    selectedMonat,
    selectedJahr,
    selectedStatus,
}: {
    role: string;
    userId: string;
    selectedSpringerinId?: string;
    selectedMonat?: number;
    selectedJahr?: number;
    selectedStatus?: string;
}) {
    const [abrechnungenRaw, currentUser, springerinnen] = await Promise.all([
        role === 'admin' ? getAllAbrechnungen(selectedSpringerinId) : getAllAbrechnungen(userId),
        getUserById(userId),
        role === 'admin' ? getSpringerinUsers() : Promise.resolve([]),
    ]);

    if (!currentUser) redirect('/login');

    const availableJahre = [...new Set(abrechnungenRaw.map((ab: any) => ab.jahr as number))].sort((a, b) => b - a);

    const abrechnungen = abrechnungenRaw.filter((ab: any) => {
        if (selectedJahr && ab.jahr !== selectedJahr) return false;
        if (selectedMonat && ab.monat !== selectedMonat) return false;
        if (selectedStatus && ab.status !== selectedStatus) return false;
        return true;
    });

    const groups: { key: string; jahr: number; monat: number; items: typeof abrechnungen }[] = [];
    for (const ab of abrechnungen) {
        const key = `${ab.jahr}-${String(ab.monat).padStart(2, '0')}`;
        const last = groups[groups.length - 1];
        if (last?.key === key) {
            last.items.push(ab);
        } else {
            groups.push({ key, jahr: ab.jahr, monat: ab.monat, items: [ab] });
        }
    }

    return (
        <>
            <SpringerinFilter
                springerinnen={springerinnen}
                availableJahre={availableJahre}
                isAdmin={role === 'admin'}
            />
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">📋 Alle Abrechnungen</h2>
                    <Link href="/springerin/abrechnung/neu" className="btn btn-primary" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                        ➕ Neue Abrechnung
                    </Link>
                </div>
                <div className="card-body" style={{ padding: 0, marginTop: '0.5rem' }}>
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th style={{ textAlign: 'right' }}>Anzahl der Stunden</th>
                                    <th style={{ textAlign: 'right' }}>Betrag €</th>
                                    <th>Status</th>
                                    <th style={{ width: '220px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {abrechnungen.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                                            <div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div>
                                            Bisher wurden keine Abrechnungen angelegt.
                                        </td>
                                    </tr>
                                ) : groups.map(group => (
                                    <React.Fragment key={group.key}>
                                        <tr>
                                            <td colSpan={5} style={{
                                                background: 'var(--bg)',
                                                padding: '8px 16px',
                                                fontWeight: 700,
                                                fontSize: '13px',
                                                color: 'var(--navy)',
                                                borderTop: '2px solid var(--border)',
                                                letterSpacing: '0.02em',
                                            }}>
                                                {getMonthName(group.monat)} {group.jahr}
                                                <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px', fontSize: '12px' }}>
                                                    {group.items.length} {group.items.length === 1 ? 'Eintrag' : 'Einträge'}
                                                </span>
                                            </td>
                                        </tr>
                                        {group.items.map(ab => {
                                            const badge = STATUS_BADGE[ab.status] || STATUS_BADGE.entwurf;
                                            const isLocked = ab.status === 'eingereicht' || ab.status === 'bezahlt';
                                            return (
                                                <tr key={ab.id}>
                                                    <td style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                                                        {ab.pankonauten_users?.name || 'Unbekannt'}
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <span className="badge" style={{ background: 'var(--bg)', padding: '4px 10px', borderRadius: '4px', fontWeight: '500' }}>
                                                            {ab.totalStunden.toFixed(2)} h
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--navy)', fontSize: '15px' }}>
                                                        {ab.totalBetrag.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                                                    </td>
                                                    <td>
                                                        <span style={{
                                                            display: 'inline-block',
                                                            padding: '3px 10px',
                                                            borderRadius: '20px',
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            background: badge.bg,
                                                            color: badge.color,
                                                        }}>
                                                            {STATUS_LABELS[ab.status] || ab.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                            <PDFOverviewButton
                                                                user={ab.pankonauten_users || currentUser}
                                                                monthLabel={`${ab.jahr} – ${getMonthName(ab.monat)}`}
                                                                tage={ab.pankonauten_abrechnung_tage || []}
                                                                totalStunden={ab.totalStunden}
                                                                totalBetrag={ab.totalBetrag}
                                                                abrechnungId={ab.id}
                                                                jahr={ab.jahr}
                                                                monat={ab.monat}
                                                            />
                                                            {!isLocked && (
                                                                <Link
                                                                    href={`/springerin/abrechnung/neu?jahr=${ab.jahr}&monat=${ab.monat}&springerinId=${ab.user_id}`}
                                                                    className="btn btn-sm btn-secondary"
                                                                    style={{ padding: '4px 10px' }}
                                                                >
                                                                    Bearbeiten
                                                                </Link>
                                                            )}
                                                            {role === 'admin' && ab.status === 'entwurf' && (
                                                                <MarkAsBezahltButton
                                                                    id={ab.id}
                                                                    label={`${ab.pankonauten_users?.name || 'Unbekannt'} (${ab.jahr}-${ab.monat})`}
                                                                    targetStatus="eingereicht"
                                                                />
                                                            )}
                                                            {role === 'admin' && ab.status === 'eingereicht' && (
                                                                <MarkAsBezahltButton
                                                                    id={ab.id}
                                                                    label={`${ab.pankonauten_users?.name || 'Unbekannt'} (${ab.jahr}-${ab.monat})`}
                                                                    targetStatus="bezahlt"
                                                                    pdfProps={ab.pankonauten_users ? {
                                                                        user: ab.pankonauten_users,
                                                                        monthLabel: `${ab.jahr} – ${getMonthName(ab.monat)}`,
                                                                        tage: ab.pankonauten_abrechnung_tage || [],
                                                                        totalStunden: ab.totalStunden,
                                                                        totalBetrag: ab.totalBetrag,
                                                                        abrechnungId: ab.id,
                                                                        jahr: ab.jahr,
                                                                        monat: ab.monat,
                                                                    } : undefined}
                                                                />
                                                            )}
                                                            {role === 'admin' && (
                                                                <DeleteAbrechnungButton
                                                                    id={ab.id}
                                                                    label={`${ab.pankonauten_users?.name || 'Unbekannt'} (${ab.jahr}-${ab.monat})`}
                                                                />
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}

function AbrechnungSkeleton() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ height: '48px', borderRadius: '8px', background: 'var(--bg-secondary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            {[...Array(6)].map((_, i) => (
                <div key={i} style={{ height: '52px', borderRadius: '8px', background: 'var(--bg-secondary)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.06}s` }} />
            ))}
        </div>
    );
}

export default async function AbrechnungPage({
    searchParams
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'finanzvorstand' | 'member' | 'eltern' | 'springerin' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'admin' && role !== 'finanzvorstand' && role !== 'springerin') redirect('/dashboard');

    const params = await searchParams;
    const selectedSpringerinId = params?.springerinId as string | undefined;
    const selectedMonat = params?.monat ? parseInt(params.monat as string) : undefined;
    const selectedJahr = params?.jahr ? parseInt(params.jahr as string) : undefined;
    const selectedStatus = params?.status as string | undefined;

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-body">
                    <Suspense fallback={<AbrechnungSkeleton />}>
                        <AbrechnungTable
                            role={role}
                            userId={userId}
                            selectedSpringerinId={selectedSpringerinId}
                            selectedMonat={selectedMonat}
                            selectedJahr={selectedJahr}
                            selectedStatus={selectedStatus}
                        />
                    </Suspense>
                </div>
            </main>
        </div>
    );
}
