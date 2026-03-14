'use client';

import { useState } from 'react';

interface ScrapeResult {
    total: number;
    dbTotal: number;
}

type Source = 'daks' | 'kita-navigator';

const SOURCES: { id: Source; label: string; endpoint: string; description: string }[] = [
    {
        id: 'daks',
        label: 'DaKS',
        endpoint: '/api/admin/crm/scraper',
        description: 'Scrapt alle Mitglieds-Kitas von daks-berlin.de.',
    },
    {
        id: 'kita-navigator',
        label: 'Kita-Navigator Berlin',
        endpoint: '/api/admin/crm/kita-navigator',
        description: 'Importiert alle ~2.900 Kitas aus dem Berliner Kita-Navigator über die offizielle API.',
    },
];

export default function CrmScraperPage() {
    const [loading, setLoading] = useState<Source | null>(null);
    const [results, setResults] = useState<Partial<Record<Source, ScrapeResult>>>({});
    const [errors, setErrors] = useState<Partial<Record<Source, string>>>({});

    async function handleScrape(source: Source, endpoint: string) {
        setLoading(source);
        setErrors(prev => { const c = { ...prev }; delete c[source]; return c; });
        setResults(prev => { const c = { ...prev }; delete c[source]; return c; });
        try {
            const res = await fetch(endpoint, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                setErrors(prev => ({ ...prev, [source]: data.error || 'Fehler beim Importieren.' }));
                return;
            }
            setResults(prev => ({ ...prev, [source]: data }));
        } catch {
            setErrors(prev => ({ ...prev, [source]: 'Netzwerkfehler. Bitte erneut versuchen.' }));
        } finally {
            setLoading(null);
        }
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
            <h1 style={{ marginTop: 0, marginBottom: '0.25rem' }}>CRM Import</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '2rem' }}>
                Kita-Daten aus verschiedenen Quellen ins CRM importieren. Bestehende Einträge werden aktualisiert.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {SOURCES.map(src => (
                    <div key={src.id} className="card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{src.label}</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{src.description}</div>
                            </div>
                            <button
                                onClick={() => handleScrape(src.id, src.endpoint)}
                                disabled={loading !== null}
                                className="btn btn-primary"
                                style={{ minWidth: '160px', flexShrink: 0 }}
                            >
                                {loading === src.id ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                        <span style={{
                                            width: '13px', height: '13px', borderRadius: '50%',
                                            border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                                            display: 'inline-block', animation: 'spin 0.7s linear infinite',
                                        }} />
                                        Läuft…
                                    </span>
                                ) : `${src.label} importieren`}
                            </button>
                        </div>

                        {loading === src.id && (
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '12px', marginBottom: 0 }}>
                                {src.id === 'kita-navigator'
                                    ? 'Lädt ~2.900 Kitas inkl. Kontaktdaten – kann 60–120 Sekunden dauern.'
                                    : 'Bitte warten – kann 30–60 Sekunden dauern.'}
                            </p>
                        )}

                        {errors[src.id] && (
                            <div style={{
                                marginTop: '12px',
                                background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)',
                                borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '13px',
                            }}>
                                {errors[src.id]}
                            </div>
                        )}

                        {results[src.id] && (
                            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{
                                    background: 'rgba(34,197,94,0.12)', color: '#22c55e',
                                    border: '1px solid rgba(34,197,94,0.25)',
                                    borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600,
                                }}>
                                    {results[src.id]!.total} importiert
                                </span>
                                <span style={{
                                    background: 'rgba(148,163,184,0.1)', color: 'var(--text-muted)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 500,
                                }}>
                                    {results[src.id]!.dbTotal} gesamt in DB
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '20px' }}>
                <a href="/admin/crm" style={{ color: 'var(--accent)', fontSize: '13px', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                    ← Zurück zu Alle Kontakte
                </a>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
