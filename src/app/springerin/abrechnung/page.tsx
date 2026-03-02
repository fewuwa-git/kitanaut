import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { getAllAbrechnungen, getUserById } from '@/lib/data';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import PDFOverviewButton from '@/components/PDFOverviewButton';
import SpringerinFilter from '@/components/SpringerinFilter';
import DeleteAbrechnungButton from '@/components/DeleteAbrechnungButton';
import MarkAsBezahltButton from '@/components/MarkAsBezahltButton';
import { getSpringerinUsers } from '@/lib/data';

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

export default async function AbrechnungPage({
    searchParams
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) redirect('/login');

    const payload = await verifyToken(token);
    if (!payload) redirect('/login');

    // Allow both admin and springerin roles
    const isAuthorized = payload.role === 'admin' || payload.role === 'springerin';
    if (!isAuthorized) redirect('/dashboard');

    const searchParamsMap = await searchParams;
    const selectedSpringerinId = searchParamsMap?.springerinId as string | undefined;
    const selectedMonat = searchParamsMap?.monat ? parseInt(searchParamsMap.monat as string) : undefined;
    const selectedJahr = searchParamsMap?.jahr ? parseInt(searchParamsMap.jahr as string) : undefined;

    const [abrechnungenRaw, currentUser, springerinnen] = await Promise.all([
        payload.role === 'admin'
            ? getAllAbrechnungen(selectedSpringerinId)
            : getAllAbrechnungen(payload.userId),
        getUserById(payload.userId),
        payload.role === 'admin' ? getSpringerinUsers() : Promise.resolve([])
    ]);

    const availableJahre = [...new Set(abrechnungenRaw.map((ab: any) => ab.jahr as number))].sort((a, b) => b - a);

    const abrechnungen = abrechnungenRaw.filter((ab: any) => {
        if (selectedJahr && ab.jahr !== selectedJahr) return false;
        if (selectedMonat && ab.monat !== selectedMonat) return false;
        return true;
    });

    if (!currentUser) redirect('/login');

    const getMonthName = (monthNum: number) => {
        return new Date(2000, monthNum - 1).toLocaleString('de-DE', { month: 'long' });
    };

    return (
        <div className="app-layout">
            <Sidebar user={{ name: payload.name, email: payload.email, role: payload.role }} />
            <main className="main-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Abrechnung</h1>
                        <p>Deine monatlichen Abrechnungen in der Übersicht</p>
                    </div>
                    <div className="page-header-actions">
                        <Link href="/springerin/abrechnung/neu" className="btn btn-primary">
                            ➕ Neue Abrechnung
                        </Link>
                    </div>
                </div>
                <div className="page-body">
                    <SpringerinFilter
                        springerinnen={springerinnen}
                        availableJahre={availableJahre}
                        isAdmin={payload.role === 'admin'}
                    />
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title">📋 Alle Abrechnungen</h2>
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
                                        ) : (() => {
                                            // Group by jahr+monat
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
                                            return groups.map(group => (
                                                <>
                                                    <tr key={`header-${group.key}`}>
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
                                                                        {payload.role === 'admin' && ab.status === 'entwurf' && (
                                                                            <MarkAsBezahltButton
                                                                                id={ab.id}
                                                                                label={`${ab.pankonauten_users?.name || 'Unbekannt'} (${ab.jahr}-${ab.monat})`}
                                                                                targetStatus="eingereicht"
                                                                            />
                                                                        )}
                                                                        {payload.role === 'admin' && ab.status === 'eingereicht' && (
                                                                            <MarkAsBezahltButton
                                                                                id={ab.id}
                                                                                label={`${ab.pankonauten_users?.name || 'Unbekannt'} (${ab.jahr}-${ab.monat})`}
                                                                                targetStatus="bezahlt"
                                                                            />
                                                                        )}
                                                                        {payload.role === 'admin' && (
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
                                                </>
                                            ));
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
