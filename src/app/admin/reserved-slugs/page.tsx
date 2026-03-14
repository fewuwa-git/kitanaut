'use client';

import { useState, useEffect } from 'react';

interface ReservedSlug {
    slug: string;
    reason: string | null;
    created_at: string;
}

export default function ReservedSlugsPage() {
    const [slugs, setSlugs] = useState<ReservedSlug[]>([]);
    const [newSlug, setNewSlug] = useState('');
    const [newReason, setNewReason] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function load() {
        const res = await fetch('/api/admin/reserved-slugs');
        if (res.ok) setSlugs(await res.json());
    }

    useEffect(() => { load(); }, []);

    async function handleAdd(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        const res = await fetch('/api/admin/reserved-slugs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: newSlug, reason: newReason }),
        });
        if (res.ok) {
            setNewSlug('');
            setNewReason('');
            await load();
        } else {
            const d = await res.json();
            setError(d.error || 'Fehler');
        }
        setLoading(false);
    }

    async function handleDelete(slug: string) {
        await fetch('/api/admin/reserved-slugs', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug }),
        });
        await load();
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
            <h1 style={{ marginTop: 0, marginBottom: '0.25rem' }}>Gesperrte Subdomains</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '2rem' }}>
                Diese Subdomains können beim Anlegen einer neuen Kita nicht verwendet werden.
            </p>

            {/* Add form */}
            <div className="card" style={{ padding: '20px 24px', marginBottom: '16px' }}>
                <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ flex: '1', minWidth: '120px', margin: 0 }}>
                        <label className="form-label">Subdomain</label>
                        <input
                            className="form-input"
                            placeholder="z.B. test"
                            value={newSlug}
                            onChange={e => setNewSlug(e.target.value.toLowerCase())}
                            required
                            style={{ fontFamily: 'monospace' }}
                        />
                    </div>
                    <div className="form-group" style={{ flex: '2', minWidth: '180px', margin: 0 }}>
                        <label className="form-label">Grund (optional)</label>
                        <input
                            className="form-input"
                            placeholder="z.B. Internes System"
                            value={newReason}
                            onChange={e => setNewReason(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ flexShrink: 0 }}>
                        + Hinzufügen
                    </button>
                </form>
                {error && (
                    <div style={{ marginTop: '10px', color: '#dc2626', fontSize: '13px' }}>{error}</div>
                )}
            </div>

            {/* List */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Subdomain</th>
                            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Grund</th>
                            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Hinzugefügt</th>
                            <th style={{ width: '60px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {slugs.length === 0 && (
                            <tr>
                                <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                                    Keine gesperrten Subdomains.
                                </td>
                            </tr>
                        )}
                        {slugs.map(s => (
                            <tr key={s.slug} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '14px', fontWeight: 500 }}>
                                    {s.slug}.kitanaut.de
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                    {s.reason || '–'}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                    {new Date(s.created_at).toLocaleDateString('de-DE')}
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                    <button
                                        onClick={() => handleDelete(s.slug)}
                                        className="btn btn-secondary btn-sm"
                                        style={{ fontSize: '12px', padding: '3px 10px', color: '#dc2626' }}
                                    >
                                        Entfernen
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
