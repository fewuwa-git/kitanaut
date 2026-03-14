'use client';

import { useState, useEffect } from 'react';

interface StatsData {
    total: number;
    bySource: Record<string, number>;
    byStatus: Record<string, number>;
    plaetze: { avg: number; min: number; max: number; withData: number; withoutData: number };
    plaetzeBuckets: { range: string; count: number }[];
    topTraeger: { name: string; count: number }[];
    topBezirke: { name: string; count: number }[];
}

const STATUS_LABELS: Record<string, string> = {
    neu: 'Neu',
    kontaktiert: 'Kontaktiert',
    interessiert: 'Interessiert',
    angebot: 'Angebot',
    gewonnen: 'Gewonnen',
    abgelehnt: 'Abgelehnt',
};

const STATUS_COLORS: Record<string, string> = {
    neu: '#64748b',
    kontaktiert: '#3b82f6',
    interessiert: '#f59e0b',
    angebot: '#8b5cf6',
    gewonnen: '#22c55e',
    abgelehnt: '#ef4444',
};

const SOURCE_COLORS: Record<string, string> = {
    daks: '#3b82f6',
    'kita-navigator': '#8b5cf6',
    senatsliste: '#16a34a',
    kietzee: '#f97316',
    unbekannt: '#94a3b8',
};

function KpiTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <div className="card" style={{ padding: '20px 24px', flex: 1, minWidth: '140px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>{label}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>}
        </div>
    );
}

function Bar({ pct, color }: { pct: number; color: string }) {
    return (
        <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden', flex: 1 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
        </div>
    );
}

export default function CrmStatistikPage() {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch('/api/admin/crm/stats')
            .then(r => r.json())
            .then(d => {
                if (d.error) setError(d.error);
                else setStats(d);
            })
            .catch(() => setError('Daten konnten nicht geladen werden.'));
    }, []);

    if (error) {
        return (
            <div style={{ padding: '2rem' }}>
                <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '14px' }}>
                    {error}
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: '14px' }}>Lade Statistiken…</div>
        );
    }

    const maxBucket = Math.max(...stats.plaetzeBuckets.map(b => b.count), 1);
    const maxTraeger = Math.max(...stats.topTraeger.map(t => t.count), 1);
    const maxBezirk = Math.max(...stats.topBezirke.map(b => b.count), 1);

    return (
        <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ marginTop: 0, marginBottom: '0.25rem' }}>Statistiken</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '2rem' }}>
                Auswertung aller {stats.total.toLocaleString('de-DE')} Kitas in der Datenbank.
            </p>

            {/* KPI Tiles */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
                <KpiTile label="Kitas gesamt" value={stats.total.toLocaleString('de-DE')} />
                <KpiTile label="Ø Plätze" value={stats.plaetze.avg} sub={`${stats.plaetze.withData.toLocaleString('de-DE')} mit Angabe`} />
                <KpiTile label="Kleinste Kita" value={stats.plaetze.min > 0 ? stats.plaetze.min : '–'} sub="Plätze" />
                <KpiTile label="Größte Kita" value={stats.plaetze.max > 0 ? stats.plaetze.max : '–'} sub="Plätze" />
                <KpiTile label="Ohne Angabe" value={stats.plaetze.withoutData.toLocaleString('de-DE')} sub="keine Platzzahl" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                {/* By Source */}
                <div className="card" style={{ padding: '20px 24px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '14px', fontSize: '14px' }}>Nach Quelle</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {Object.entries(stats.bySource).sort((a, b) => b[1] - a[1]).map(([src, count]) => {
                            const pct = Math.round((count / stats.total) * 100);
                            const color = SOURCE_COLORS[src] ?? '#94a3b8';
                            return (
                                <div key={src}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                                            {src === 'daks' ? 'DaKS' : src === 'kita-navigator' ? 'Kita-Navigator' : src === 'senatsliste' ? 'Senatsliste' : src === 'kietzee' ? 'Kietzee' : src}
                                        </span>
                                        <span style={{ color: 'var(--text-muted)' }}>{count.toLocaleString('de-DE')} <span style={{ opacity: 0.6 }}>({pct}%)</span></span>
                                    </div>
                                    <Bar pct={pct} color={color} />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* By Status */}
                <div className="card" style={{ padding: '20px 24px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '14px', fontSize: '14px' }}>Nach Status</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                            const pct = Math.round((count / stats.total) * 100);
                            const color = STATUS_COLORS[status] ?? '#94a3b8';
                            return (
                                <div key={status}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                                            {STATUS_LABELS[status] ?? status}
                                        </span>
                                        <span style={{ color: 'var(--text-muted)' }}>{count.toLocaleString('de-DE')} <span style={{ opacity: 0.6 }}>({pct}%)</span></span>
                                    </div>
                                    <Bar pct={pct} color={color} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Plätze Verteilung */}
            <div className="card" style={{ padding: '20px 24px', marginBottom: '24px' }}>
                <div style={{ fontWeight: 600, marginBottom: '16px', fontSize: '14px' }}>Plätze-Verteilung</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {stats.plaetzeBuckets.filter(b => b.count > 0 || parseInt(b.range) <= 50).map(b => {
                        const pct = Math.round((b.count / maxBucket) * 100);
                        const countPct = stats.plaetze.withData > 0 ? ((b.count / stats.plaetze.withData) * 100).toFixed(1) : '0.0';
                        return (
                            <div key={b.range} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
                                <span style={{ width: '60px', textAlign: 'right', color: 'var(--text-muted)', flexShrink: 0 }}>{b.range}</span>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ flex: 1, height: '20px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent, #3b82f6)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                                    </div>
                                    <span style={{ width: '40px', color: 'var(--text-muted)', textAlign: 'right' }}>{b.count}</span>
                                    <span style={{ width: '48px', color: 'var(--text-muted)', opacity: 0.7, textAlign: 'right' }}>{countPct}%</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                {/* Top Träger */}
                {stats.topTraeger.length > 0 && (
                    <div className="card" style={{ padding: '20px 24px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '14px', fontSize: '14px' }}>Top Träger</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {stats.topTraeger.map(t => (
                                <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.name}>{t.name}</span>
                                    <div style={{ width: '80px', flexShrink: 0 }}>
                                        <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${Math.round((t.count / maxTraeger) * 100)}%`, background: '#3b82f6', borderRadius: '3px' }} />
                                        </div>
                                    </div>
                                    <span style={{ width: '28px', textAlign: 'right', color: 'var(--text-muted)', flexShrink: 0 }}>{t.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Top Bezirke */}
                {stats.topBezirke.length > 0 && (
                    <div className="card" style={{ padding: '20px 24px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '14px', fontSize: '14px' }}>Nach Bezirk</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {stats.topBezirke.map(b => (
                                <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                                    <div style={{ width: '80px', flexShrink: 0 }}>
                                        <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${Math.round((b.count / maxBezirk) * 100)}%`, background: '#8b5cf6', borderRadius: '3px' }} />
                                        </div>
                                    </div>
                                    <span style={{ width: '28px', textAlign: 'right', color: 'var(--text-muted)', flexShrink: 0 }}>{b.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
