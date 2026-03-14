'use client';

import { useState } from 'react';

interface ScrapeResult {
    imported: number;
    updated: number;
    total: number;
}

export default function CrmScraperPage() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ScrapeResult | null>(null);
    const [error, setError] = useState('');

    async function handleScrape() {
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const res = await fetch('/api/admin/crm/scraper', { method: 'POST' });
            if (!res.ok) {
                const d = await res.json();
                setError(d.error || 'Fehler beim Scrapen.');
                return;
            }
            const data = await res.json();
            setResult(data);
        } catch {
            setError('Netzwerkfehler. Bitte erneut versuchen.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
            <h1 style={{ marginTop: 0, marginBottom: '0.25rem' }}>DaKS Import</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '2rem' }}>
                Scrapt alle Mitglieds-Kitas von daks-berlin.de und importiert sie in das CRM.
                Bestehende Einträge werden aktualisiert.
            </p>

            <div className="card" style={{ padding: '28px 24px' }}>
                <button
                    onClick={handleScrape}
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ minWidth: '200px' }}
                >
                    {loading ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                            <span style={{
                                width: '14px', height: '14px', borderRadius: '50%',
                                border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                                display: 'inline-block', animation: 'spin 0.7s linear infinite',
                            }} />
                            Scraping läuft…
                        </span>
                    ) : 'DaKS jetzt scrapen'}
                </button>

                {loading && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '14px', marginBottom: 0 }}>
                        Bitte warten – lädt alle Kita-Profile von daks-berlin.de.
                        Kann <strong>30–60 Sekunden</strong> dauern.
                    </p>
                )}

                {error && (
                    <div style={{
                        marginTop: '16px',
                        background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)',
                        borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '14px',
                    }}>
                        {error}
                    </div>
                )}

                {result && (
                    <div style={{ marginTop: '16px' }}>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <span style={{
                                background: 'rgba(34,197,94,0.12)', color: '#22c55e',
                                border: '1px solid rgba(34,197,94,0.25)',
                                borderRadius: '20px', padding: '5px 14px', fontSize: '13px', fontWeight: 600,
                            }}>
                                {result.imported} neu importiert
                            </span>
                            <span style={{
                                background: 'rgba(59,130,246,0.12)', color: '#3b82f6',
                                border: '1px solid rgba(59,130,246,0.25)',
                                borderRadius: '20px', padding: '5px 14px', fontSize: '13px', fontWeight: 600,
                            }}>
                                {result.updated} aktualisiert
                            </span>
                            <span style={{
                                background: 'rgba(148,163,184,0.1)', color: 'var(--text-muted)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '20px', padding: '5px 14px', fontSize: '13px', fontWeight: 500,
                            }}>
                                {result.total} gesamt im CRM
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ marginTop: '16px' }}>
                <a href="/admin/crm" style={{
                    color: 'var(--accent)', fontSize: '13px', textDecoration: 'none',
                }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                    ← Zurück zu Alle Kontakte
                </a>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
