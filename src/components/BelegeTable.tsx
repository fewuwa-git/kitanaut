'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Beleg, User } from '@/lib/data';

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
    entwurf:     { bg: 'var(--orange-bg)', color: 'var(--orange)' },
    eingereicht: { bg: 'var(--blue-bg)',   color: 'var(--blue)' },
    genehmigt:   { bg: 'var(--green-bg)',  color: '#16a34a' },
    abgelehnt:   { bg: '#fee2e2',          color: '#dc2626' },
};

interface BelegeTableProps {
    belege: Beleg[];
    allUsers: User[];
    isAdmin: boolean;
    selectedUserId?: string;
    selectedStatus?: string;
    statusLabels: Record<string, string>;
}

export default function BelegeTable({
    belege,
    allUsers,
    isAdmin,
    selectedUserId,
    selectedStatus,
    statusLabels,
}: BelegeTableProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const updateParam = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) { params.set(key, value); } else { params.delete(key); }
        router.push(`?${params.toString()}`);
    };

    return (
        <>
            {/* Filter */}
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                {isAdmin && (
                    <select
                        value={selectedUserId || ''}
                        onChange={(e) => updateParam('userId', e.target.value)}
                        className="form-control"
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--card-bg)', minWidth: '200px' }}
                    >
                        <option value="">Alle Benutzer</option>
                        {allUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                )}
                <select
                    value={selectedStatus || ''}
                    onChange={(e) => updateParam('status', e.target.value)}
                    className="form-control"
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--card-bg)', minWidth: '160px' }}
                >
                    <option value="">Alle Status</option>
                    {Object.entries(statusLabels).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                    ))}
                </select>
            </div>

            {/* Tabelle */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">📋 Alle Belege</h2>
                </div>
                <div className="card-body" style={{ padding: 0, marginTop: '0.5rem' }}>
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    {isAdmin && <th>Name</th>}
                                    <th>Titel</th>
                                    <th>Datum</th>
                                    <th style={{ textAlign: 'right' }}>Betrag €</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {belege.length === 0 ? (
                                    <tr>
                                        <td colSpan={isAdmin ? 5 : 4} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                                            <div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div>
                                            Keine Belege gefunden.
                                        </td>
                                    </tr>
                                ) : belege.map(b => {
                                    const badge = STATUS_BADGE[b.status] || STATUS_BADGE.entwurf;
                                    return (
                                        <tr key={b.id}>
                                            {isAdmin && (
                                                <td style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                                                    {b.pankonauten_users?.name || '–'}
                                                </td>
                                            )}
                                            <td style={{ fontWeight: 500 }}>{b.titel}</td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                                                {new Date(b.datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--navy)', fontSize: '15px' }}>
                                                {b.betrag.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
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
                                                    {statusLabels[b.status] || b.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}
