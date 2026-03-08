import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuditLog, AUDIT_LABELS, AuditAction } from '@/lib/audit';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = { title: 'Logfiles' };

const MONATSNAMEN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function formatDetails(action: AuditAction, details: Record<string, unknown> | null): string {
    if (!details) return '';
    if (action === 'csv_import') return `${details.count} Buchungen importiert`;
    if (action === 'beleg_erstellt' || action === 'beleg_eingereicht' || action === 'beleg_bezahlt' || action === 'beleg_abgelehnt') {
        const betrag = typeof details.betrag === 'number'
            ? details.betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
            : '';
        return [details.belegnummer && `Nr. ${details.belegnummer}`, details.titel, betrag].filter(Boolean).join(' · ');
    }
    if (action === 'abrechnung_erstellt' || action === 'abrechnung_eingereicht') {
        const monat = typeof details.monat === 'number' ? MONATSNAMEN[details.monat - 1] : details.monat;
        return `${monat} ${details.jahr}`;
    }
    if (action === 'abrechnung_bezahlt') {
        const monat = typeof details.monat === 'number' ? MONATSNAMEN[details.monat - 1] : details.monat;
        return [`${monat} ${details.jahr}`, details.user_name && `(${details.user_name})`].filter(Boolean).join(' ');
    }
    return '';
}

const ACTION_ICONS: Record<AuditAction, string> = {
    beleg_erstellt: '📄',
    beleg_eingereicht: '📤',
    beleg_bezahlt: '✅',
    beleg_abgelehnt: '❌',
    abrechnung_erstellt: '🧾',
    abrechnung_eingereicht: '📤',
    abrechnung_bezahlt: '✅',
    csv_import: '⬆️',
};

export default async function LogfilesPage() {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'member' | 'eltern' | 'springerin' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'admin') redirect('/dashboard');

    const log = await getAuditLog();

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-body">
                    <div className="card" style={{ padding: '16px 24px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="page-header-left">
                            <h1>Logfiles</h1>
                            <p>Protokoll aller relevanten Aktionen im System</p>
                        </div>
                    </div>
                    <div className="card">
                        {log.length === 0 ? (
                            <div className="card-body" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                                Noch keine Einträge vorhanden.
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Zeitpunkt</th>
                                            <th>Benutzer</th>
                                            <th>Aktion</th>
                                            <th>Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {log.map((entry) => {
                                            const dt = new Date(entry.created_at);
                                            const date = dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                            const time = dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                                            const details = formatDetails(entry.action, entry.details);
                                            const icon = ACTION_ICONS[entry.action] ?? '•';
                                            const label = AUDIT_LABELS[entry.action] ?? entry.action;
                                            return (
                                                <tr key={entry.id}>
                                                    <td style={{ fontSize: '13px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                                                        {date}, {time} Uhr
                                                    </td>
                                                    <td style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                                                        {entry.user_name}
                                                    </td>
                                                    <td style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                                                        {icon} {label}
                                                    </td>
                                                    <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                                        {details}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
