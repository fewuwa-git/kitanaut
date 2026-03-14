import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySuperAdminToken } from '@/lib/auth';
import { getAuditLog, AUDIT_LABELS, AuditAction } from '@/lib/audit';

export const metadata: Metadata = { title: 'Logfiles – Kitanaut Admin' };

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

export default async function AdminLogfilesPage() {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_token')?.value;
    const adminPayload = adminToken ? await verifySuperAdminToken(adminToken) : null;
    if (!adminPayload) redirect('/admin/login');

    const log = await getAuditLog();

    return (
        <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
            <h1 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Logfiles</h1>
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
    );
}
