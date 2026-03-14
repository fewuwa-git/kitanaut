'use client';

import { useRouter } from 'next/navigation';
import { Organization } from '@/lib/data';

function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
}

export default function AdminDashboardClient({ orgs }: { orgs: Organization[] }) {
    const router = useRouter();

    async function handleLogout() {
        await fetch('/api/admin-auth', { method: 'DELETE' });
        router.push('/admin/login');
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ margin: 0 }}>Kitanaut Admin – Alle Kitas</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '14px' }}>
                        {orgs.length} Organisation{orgs.length !== 1 ? 'en' : ''} registriert
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <a href="/admin/kitas/neu" className="btn btn-primary">
                        + Neue Kita anlegen
                    </a>
                    <a href="/admin/passwort" className="btn btn-secondary">
                        Passwort ändern
                    </a>
                    <button className="btn btn-secondary" onClick={handleLogout}>
                        Abmelden
                    </button>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Name</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Subdomain</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>E-Mail-Absender</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Erstellt am</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orgs.length === 0 && (
                            <tr>
                                <td colSpan={4} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                                    Noch keine Kitas vorhanden.
                                </td>
                            </tr>
                        )}
                        {orgs.map((org) => (
                            <tr key={org.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{org.name}</td>
                                <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '13px' }}>
                                    {org.slug}.kitanaut.de
                                </td>
                                <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '14px' }}>
                                    {org.from_email || '–'}
                                </td>
                                <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '14px' }}>
                                    {formatDate(org.created_at)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
