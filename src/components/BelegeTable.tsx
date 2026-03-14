'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { fmtDate } from '@/lib/formatDate';
import { Beleg, User } from '@/lib/data';
import { generateBelegPDF } from '@/lib/belegPdf';
import BelegStatusButton from '@/components/BelegStatusButton';
import DeleteBelegButton from '@/components/DeleteBelegButton';

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
    entwurf:     { bg: 'var(--orange-bg)', color: 'var(--orange)' },
    eingereicht: { bg: 'var(--blue-bg)',   color: 'var(--blue)' },
    bezahlt:   { bg: 'var(--green-bg)',  color: '#16a34a' },
    abgelehnt:   { bg: '#fee2e2',          color: '#dc2626' },
};

interface BelegeTableProps {
    belege: Beleg[];
    allUsers: User[];
    isAdmin: boolean;
    role: string;
    currentUserId: string;
    selectedUserId?: string;
    selectedStatus?: string;
    statusLabels: Record<string, string>;
}

function PDFButton({ beleg }: { beleg: Beleg }) {
    const [loading, setLoading] = useState(false);
    const handleClick = async () => {
        setLoading(true);
        const win = window.open('', '_blank');
        try {
            const url = await generateBelegPDF(beleg);
            if (win) win.location.href = url;
        } catch {
            if (win) win.close();
        } finally {
            setLoading(false);
        }
    };
    return (
        <button onClick={handleClick} disabled={loading} className="btn btn-sm"
            style={{ padding: '4px 10px', backgroundColor: 'var(--navy)', color: 'white' }}>
            {loading ? '...' : '📄 PDF'}
        </button>
    );
}

export default function BelegeTable({
    belege, allUsers, isAdmin, role, currentUserId, selectedUserId, selectedStatus, statusLabels,
}: BelegeTableProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [search, setSearch] = useState('');

    const updateParam = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) { params.set(key, value); } else { params.delete(key); }
        router.push(`?${params.toString()}`);
    };

    const colCount = isAdmin ? 6 : 5;

    const filteredBelege = search.trim()
        ? belege.filter(b =>
            b.titel.toLowerCase().includes(search.toLowerCase()) ||
            (b.beschreibung || '').toLowerCase().includes(search.toLowerCase()) ||
            (b.kitanaut_users?.name || '').toLowerCase().includes(search.toLowerCase())
        )
        : belege;

    return (
        <>
            {/* Admin User-Filter */}
            {isAdmin && (
                <div style={{ marginBottom: '1.5rem' }}>
                    <select value={selectedUserId || ''} onChange={(e) => updateParam('userId', e.target.value)}
                        className="form-control"
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--card-bg)', minWidth: '200px' }}>
                        <option value="">Alle Benutzer</option>
                        {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                </div>
            )}

            {/* Tabelle */}
            <div className="card">
                <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
                    <div className="card-title">📋 Alle Belege</div>
                    <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            placeholder="Suche..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--card-bg)', fontSize: '14px', minWidth: '180px' }}
                        />
                        <select value={selectedStatus || ''} onChange={(e) => updateParam('status', e.target.value)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--card-bg)', fontSize: '14px' }}>
                            <option value="">Alle Status</option>
                            {Object.entries(statusLabels).map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                            ))}
                        </select>
                        <Link href="/eltern/belege/neu" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                            ➕ Beleg erstellen
                        </Link>
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ whiteSpace: 'nowrap' }}>Datum</th>
                                    {isAdmin && <th>Name</th>}
                                    <th>Titel</th>
                                    <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Betrag €</th>
                                    <th>Status</th>
                                    <th style={{ width: '220px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBelege.length === 0 ? (
                                    <tr>
                                        <td colSpan={colCount} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                                            <div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div>
                                            Keine Belege gefunden.
                                        </td>
                                    </tr>
                                ) : filteredBelege.map(b => {
                                    const badge = STATUS_BADGE[b.status] || STATUS_BADGE.entwurf;
                                    const isEntwurf = b.status === 'entwurf';
                                    const isEingereicht = b.status === 'eingereicht';
                                    const isAbgelehnt = b.status === 'abgelehnt';
                                    const canEdit = (isEntwurf || isAbgelehnt) && (isAdmin || b.user_id === currentUserId);
                                    const canSubmit = (isEntwurf || isAbgelehnt) && (isAdmin || b.user_id === currentUserId);
                                    const canDelete = isEntwurf && (isAdmin || b.user_id === currentUserId);
                                    return (
                                        <tr key={b.id}>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '14px', whiteSpace: 'nowrap' }}>
                                                {fmtDate(b.datum)}
                                            </td>
                                            {isAdmin && (
                                                <td style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                                                    {b.kitanaut_users?.name || '–'}
                                                </td>
                                            )}
                                            <td style={{ fontWeight: 500 }}>{b.titel}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--navy)', fontSize: '15px', whiteSpace: 'nowrap' }}>
                                                {b.betrag.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                                            </td>
                                            <td>
                                                <span style={{
                                                    display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
                                                    fontSize: '12px', fontWeight: 600, background: badge.bg, color: badge.color,
                                                }}>
                                                    {statusLabels[b.status] || b.status}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <PDFButton beleg={b} />
                                                    {canEdit && (
                                                        <Link href={`/eltern/belege/${b.id}/bearbeiten`}
                                                            className="btn btn-sm btn-secondary"
                                                            style={{ padding: '4px 10px' }}>
                                                            Bearbeiten
                                                        </Link>
                                                    )}
                                                    {canSubmit && (
                                                        <BelegStatusButton id={b.id} label={b.titel} targetStatus="eingereicht" />
                                                    )}
                                                    {isAdmin && isEingereicht && (
                                                        <BelegStatusButton id={b.id} label={b.titel} targetStatus="bezahlt" beleg={b} />
                                                    )}
                                                    {isAdmin && isEingereicht && (
                                                        <BelegStatusButton id={b.id} label={b.titel} targetStatus="abgelehnt" />
                                                    )}
                                                    {canDelete && (
                                                        <DeleteBelegButton id={b.id} label={b.titel} />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                </div>
            </div>
        </>
    );
}
