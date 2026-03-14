'use client';

import { useState, useEffect } from 'react';
import type { DaksKita } from '@/app/api/admin/daks-scraper/route';

export default function DaksScraperPage() {
    const [kitas, setKitas] = useState<DaksKita[]>([]);
    const [filtered, setFiltered] = useState<DaksKita[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [scrapedAt, setScrapedAt] = useState('');

    useEffect(() => {
        const q = search.toLowerCase();
        setFiltered(
            kitas.filter(k =>
                [k.name, k.strasse, k.ort, k.bezirk, k.telefon, k.email, k.traeger]
                    .some(v => v.toLowerCase().includes(q))
            )
        );
    }, [search, kitas]);

    async function handleScrape() {
        setLoading(true);
        setError('');
        setKitas([]);
        try {
            const res = await fetch('/api/admin/daks-scraper', { method: 'POST' });
            if (!res.ok) {
                const d = await res.json();
                setError(d.error || 'Fehler beim Scrapen.');
                return;
            }
            const data = await res.json();
            setKitas(data.kitas);
            setScrapedAt(new Date(data.scrapedAt).toLocaleString('de-DE'));
        } catch {
            setError('Netzwerkfehler. Bitte erneut versuchen.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setSearch('');
        }
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, []);

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ marginTop: 0, marginBottom: '0.25rem' }}>DaKS Berlin – Kita-Recherche</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                        Scrapt alle Mitglieds-Kitas von daks-berlin.de
                        {scrapedAt && <> · Stand: <strong>{scrapedAt}</strong></>}
                    </p>
                </div>
                <button
                    onClick={handleScrape}
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ flexShrink: 0, minWidth: '160px' }}
                >
                    {loading ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                                width: '14px', height: '14px', borderRadius: '50%',
                                border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                                display: 'inline-block', animation: 'spin 0.7s linear infinite',
                            }} />
                            Scraping läuft…
                        </span>
                    ) : kitas.length > 0 ? 'Neu scrapen' : 'Jetzt scrapen'}
                </button>
            </div>

            {error && (
                <div style={{
                    background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)',
                    borderRadius: '8px', padding: '12px 16px', color: '#dc2626',
                    fontSize: '14px', marginBottom: '1.5rem',
                }}>
                    {error}
                </div>
            )}

            {loading && (
                <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        border: '3px solid var(--border-color)', borderTopColor: 'var(--accent)',
                        animation: 'spin 0.7s linear infinite', margin: '0 auto 16px',
                    }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                        Lade Kita-Daten von daks-berlin.de… Das kann 30–60 Sekunden dauern.
                    </p>
                </div>
            )}

            {!loading && kitas.length > 0 && (
                <>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Suche nach Name, Adresse, Träger…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ maxWidth: '340px' }}
                        />
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {filtered.length} von {kitas.length} Kitas
                        </span>
                    </div>

                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        {['Name', 'Adresse', 'Bezirk', 'Telefon', 'E-Mail', 'Träger', 'Plätze'].map(h => (
                                            <th key={h} style={{
                                                padding: '10px 14px', textAlign: 'left',
                                                fontSize: '11px', fontWeight: 600,
                                                color: 'var(--text-muted)', whiteSpace: 'nowrap',
                                            }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 && (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                Keine Ergebnisse für „{search}"
                                            </td>
                                        </tr>
                                    )}
                                    {filtered.map((k, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '10px 14px', fontWeight: 500, maxWidth: '220px' }}>
                                                <a href={k.url} target="_blank" rel="noopener noreferrer"
                                                    style={{ color: 'var(--accent)', textDecoration: 'none' }}
                                                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                                                >
                                                    {k.name || '–'}
                                                </a>
                                            </td>
                                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)', maxWidth: '180px' }}>
                                                {k.strasse && <>{k.strasse}<br /></>}
                                                {(k.plz || k.ort) && <>{[k.plz, k.ort].filter(Boolean).join(' ')}</>}
                                                {!k.strasse && !k.plz && !k.ort && '–'}
                                            </td>
                                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                {k.bezirk || '–'}
                                            </td>
                                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                {k.telefon || '–'}
                                            </td>
                                            <td style={{ padding: '10px 14px', maxWidth: '180px' }}>
                                                {k.email
                                                    ? <a href={`mailto:${k.email}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{k.email}</a>
                                                    : '–'}
                                            </td>
                                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)', maxWidth: '160px' }}>
                                                {k.traeger || '–'}
                                            </td>
                                            <td style={{ padding: '10px 14px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                                                {k.plaetze || '–'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {!loading && kitas.length === 0 && !error && (
                <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
                    <p style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                        Noch keine Daten geladen. Klicke auf „Jetzt scrapen" um die DaKS-Mitgliederliste abzurufen.
                    </p>
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
