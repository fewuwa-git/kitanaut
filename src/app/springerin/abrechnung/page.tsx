import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { getAllAbrechnungen, getUserById } from '@/lib/data';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import PDFOverviewButton from '@/components/PDFOverviewButton';
import SpringerinFilter from '@/components/SpringerinFilter';
import DeleteAbrechnungButton from '@/components/DeleteAbrechnungButton';
import { getSpringerinUsers } from '@/lib/data';

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

    const [abrechnungen, currentUser, springerinnen] = await Promise.all([
        payload.role === 'admin'
            ? getAllAbrechnungen(selectedSpringerinId)
            : getAllAbrechnungen(payload.userId),
        getUserById(payload.userId),
        payload.role === 'admin' ? getSpringerinUsers() : Promise.resolve([])
    ]);

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
                    {payload.role === 'admin' && (
                        <SpringerinFilter springerinnen={springerinnen} />
                    )}
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title">📋 Alle Abrechnungen</h2>
                        </div>
                        <div className="card-body" style={{ padding: 0, marginTop: '0.5rem' }}>
                            <div className="table-responsive">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Jahr / Monat</th>
                                            <th>Name</th>
                                            <th style={{ textAlign: 'right' }}>Anzahl der Stunden</th>
                                            <th style={{ textAlign: 'right' }}>Betrag €</th>
                                            <th style={{ width: '180px' }}></th>
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
                                        ) : (
                                            abrechnungen.map(ab => (
                                                <tr key={ab.id}>
                                                    <td style={{ fontWeight: '600' }}>
                                                        {ab.jahr} – {getMonthName(ab.monat)}
                                                    </td>
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
                                                            <Link
                                                                href={`/springerin/abrechnung/neu?jahr=${ab.jahr}&monat=${ab.monat}&springerinId=${ab.user_id}`}
                                                                className="btn btn-sm btn-secondary"
                                                                style={{ padding: '4px 10px' }}
                                                            >
                                                                Bearbeiten
                                                            </Link>
                                                            {payload.role === 'admin' && (
                                                                <DeleteAbrechnungButton
                                                                    id={ab.id}
                                                                    label={`${ab.pankonauten_users?.name || 'Unbekannt'} (${ab.jahr}-${ab.monat})`}
                                                                />
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
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
