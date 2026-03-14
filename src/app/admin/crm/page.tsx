'use client';

import { useState, useEffect, useCallback } from 'react';

interface Prospect {
    id: number;
    name: string;
    strasse: string;
    plz: string;
    ort: string;
    bezirk: string;
    telefon: string;
    email: string;
    webseite: string;
    traeger: string;
    plaetze: number | null;
    source: string;
    source_url: string;
    status: string;
    notizen: string;
    created_at: string;
    updated_at: string;
}

const STATUS_OPTIONS = [
    { value: 'neu', label: 'Neu' },
    { value: 'kontaktiert', label: 'Kontaktiert' },
    { value: 'interessiert', label: 'Interessiert' },
    { value: 'kunde', label: 'Kunde' },
    { value: 'abgelehnt', label: 'Abgelehnt' },
];

const STATUS_COLORS: Record<string, string> = {
    neu: 'rgba(148,163,184,0.15)',
    kontaktiert: 'rgba(59,130,246,0.15)',
    interessiert: 'rgba(245,158,11,0.15)',
    kunde: 'rgba(34,197,94,0.15)',
    abgelehnt: 'rgba(239,68,68,0.15)',
};

const STATUS_TEXT: Record<string, string> = {
    neu: '#94a3b8',
    kontaktiert: '#3b82f6',
    interessiert: '#f59e0b',
    kunde: '#22c55e',
    abgelehnt: '#ef4444',
};

export default function CrmPage() {
    const [prospects, setProspects] = useState<Prospect[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const [pageCount, setPageCount] = useState(0);
    const [editingNotizen, setEditingNotizen] = useState<Record<number, string>>({});
    const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (search) params.set('q', search);
            if (sourceFilter) params.set('source', sourceFilter);
            if (statusFilter) params.set('status', statusFilter);
            params.set('page', String(page));
            const res = await fetch(`/api/admin/crm?${params}`);
            if (res.ok) {
                const json = await res.json();
                setProspects(json.data);
                setTotal(json.total);
                setPageCount(json.pageCount);
            } else {
                const d = await res.json().catch(() => ({}));
                setError(`Fehler ${res.status}: ${d.error || 'Unbekannter Fehler'}`);
            }
        } catch (e) {
            setError(`Netzwerkfehler: ${e}`);
        }
        setLoading(false);
    }, [search, sourceFilter, statusFilter, page]);

    // Filter-Änderungen → zurück auf Seite 0
    useEffect(() => { setPage(0); }, [search, sourceFilter, statusFilter]);

    useEffect(() => {
        const t = setTimeout(load, 300);
        return () => clearTimeout(t);
    }, [load]);

    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setEditingNotizen({});
        }
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, []);

    async function patchProspect(id: number, data: { status?: string; notizen?: string }) {
        setSavingIds(prev => new Set(prev).add(id));
        const res = await fetch(`/api/admin/crm/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            const updated = await res.json();
            setProspects(prev => prev.map(p => p.id === id ? updated : p));
        }
        setSavingIds(prev => {
            const s = new Set(prev);
            s.delete(id);
            return s;
        });
    }

    function startEditNotizen(id: number, current: string) {
        setEditingNotizen(prev => ({ ...prev, [id]: current }));
    }

    async function saveNotizen(id: number) {
        const text = editingNotizen[id];
        if (text === undefined) return;
        await patchProspect(id, { notizen: text });
        setEditingNotizen(prev => {
            const copy = { ...prev };
            delete copy[id];
            return copy;
        });
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            {error && (
                <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '14px', marginBottom: '1.5rem' }}>
                    {error}
                </div>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ marginTop: 0, marginBottom: '0.25rem' }}>CRM – Kontakte</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                        Alle Kita-Kontakte aus DaKS, Kita-Navigator und Senatsliste
                    </p>
                </div>
                <span style={{
                    background: 'rgba(59,130,246,0.12)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59,130,246,0.25)',
                    borderRadius: '20px',
                    padding: '4px 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    alignSelf: 'center',
                }}>
                    {total} Kontakte
                </span>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <input
                    type="text"
                    className="form-input"
                    placeholder="Suche nach Name, Ort, Träger…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ maxWidth: '300px', flex: '1 1 200px' }}
                />
                <select
                    className="form-input"
                    value={sourceFilter}
                    onChange={e => setSourceFilter(e.target.value)}
                    style={{ maxWidth: '160px' }}
                >
                    <option value="">Alle Quellen</option>
                    <option value="daks">DaKS</option>
                    <option value="kita-navigator">Kita-Navigator</option>
                    <option value="senatsliste">Senatsliste</option>
                    <option value="kietzee">Kietzee</option>
                    <option value="manual">Manuell</option>
                </select>
                <select
                    className="form-input"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    style={{ maxWidth: '160px' }}
                >
                    <option value="">Alle Status</option>
                    {STATUS_OPTIONS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>
            </div>

            {loading && (
                <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        border: '3px solid var(--border-color)', borderTopColor: 'var(--accent)',
                        animation: 'spin 0.7s linear infinite', margin: '0 auto 12px',
                    }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Lade Kontakte…</p>
                </div>
            )}

            {!loading && prospects.length === 0 && (
                <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                        Keine Kontakte gefunden.
                    </p>
                </div>
            )}

            {!loading && prospects.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    {['Name', 'Ort', 'Telefon', 'E-Mail', 'Träger', 'Plätze', 'Quelle', 'Status', 'Notizen'].map(h => (
                                        <th key={h} style={{
                                            padding: '10px 12px', textAlign: 'left',
                                            fontSize: '11px', fontWeight: 600,
                                            color: 'var(--text-muted)', whiteSpace: 'nowrap',
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {prospects.map(p => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '9px 12px', fontWeight: 500, maxWidth: '200px' }}>
                                            <a href={`/admin/crm/${p.id}`}
                                                style={{ color: 'var(--accent)', textDecoration: 'none' }}
                                                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                                            >
                                                {p.name || '–'}
                                            </a>
                                            {p.webseite && (
                                                <a href={p.webseite} target="_blank" rel="noopener noreferrer"
                                                    style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'none', marginTop: '2px' }}
                                                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                                                >
                                                    🌐 {(() => { try { return new URL(p.webseite).hostname.replace('www.', ''); } catch { return p.webseite; } })()}
                                                </a>
                                            )}
                                        </td>
                                        <td style={{ padding: '9px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {[p.plz, p.ort].filter(Boolean).join(' ') || '–'}
                                        </td>
                                        <td style={{ padding: '9px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {p.telefon || '–'}
                                        </td>
                                        <td style={{ padding: '9px 12px', maxWidth: '180px' }}>
                                            {p.email
                                                ? <a href={`mailto:${p.email}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '12px' }}
                                                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                                                >{p.email}</a>
                                                : <span style={{ color: 'var(--text-muted)' }}>–</span>}
                                        </td>
                                        <td style={{ padding: '9px 12px', color: 'var(--text-muted)', maxWidth: '160px', fontSize: '12px' }}>
                                            {p.traeger || '–'}
                                        </td>
                                        <td style={{ padding: '9px 12px', textAlign: 'center', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                            {p.plaetze ?? '–'}
                                        </td>
                                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '2px 8px',
                                                borderRadius: '10px',
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                background: p.source === 'daks' ? 'rgba(59,130,246,0.12)' : p.source === 'kita-navigator' ? 'rgba(168,85,247,0.12)' : p.source === 'senatsliste' ? 'rgba(22,163,74,0.12)' : p.source === 'kietzee' ? 'rgba(249,115,22,0.12)' : 'rgba(148,163,184,0.12)',
                                                color: p.source === 'daks' ? '#3b82f6' : p.source === 'kita-navigator' ? '#a855f7' : p.source === 'senatsliste' ? '#16a34a' : p.source === 'kietzee' ? '#f97316' : '#94a3b8',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                            }}>
                                                {p.source}
                                            </span>
                                        </td>
                                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                                            <select
                                                value={p.status}
                                                disabled={savingIds.has(p.id)}
                                                onChange={e => patchProspect(p.id, { status: e.target.value })}
                                                style={{
                                                    background: STATUS_COLORS[p.status] || 'transparent',
                                                    color: STATUS_TEXT[p.status] || 'inherit',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '6px',
                                                    padding: '3px 6px',
                                                    fontSize: '12px',
                                                    fontWeight: 500,
                                                    cursor: 'pointer',
                                                    outline: 'none',
                                                }}
                                            >
                                                {STATUS_OPTIONS.map(s => (
                                                    <option key={s.value} value={s.value}>{s.label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td style={{ padding: '9px 12px', minWidth: '160px', maxWidth: '240px' }}>
                                            {editingNotizen[p.id] !== undefined ? (
                                                <textarea
                                                    value={editingNotizen[p.id]}
                                                    autoFocus
                                                    rows={2}
                                                    onChange={e => setEditingNotizen(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                    onBlur={() => saveNotizen(p.id)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            saveNotizen(p.id);
                                                        }
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        minWidth: '160px',
                                                        padding: '4px 6px',
                                                        borderRadius: '5px',
                                                        border: '1px solid var(--accent, #3b82f6)',
                                                        background: 'rgba(59,130,246,0.06)',
                                                        color: 'inherit',
                                                        fontSize: '12px',
                                                        resize: 'vertical',
                                                        fontFamily: 'inherit',
                                                    }}
                                                />
                                            ) : (
                                                <span
                                                    onClick={() => startEditNotizen(p.id, p.notizen)}
                                                    title="Klicken zum Bearbeiten"
                                                    style={{
                                                        display: 'block',
                                                        minHeight: '22px',
                                                        cursor: 'text',
                                                        color: p.notizen ? 'inherit' : 'var(--text-muted)',
                                                        fontSize: '12px',
                                                        borderRadius: '4px',
                                                        padding: '2px 4px',
                                                        transition: 'background 0.12s',
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                >
                                                    {p.notizen || <span style={{ fontStyle: 'italic', opacity: 0.4 }}>–</span>}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Paginierung */}
            {pageCount > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Seite {page + 1} von {pageCount} · {total} Einträge
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            onClick={() => setPage(0)}
                            disabled={page === 0}
                            style={{ padding: '5px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'none', color: page === 0 ? 'var(--text-muted)' : 'inherit', cursor: page === 0 ? 'default' : 'pointer' }}
                        >«</button>
                        <button
                            onClick={() => setPage(p => p - 1)}
                            disabled={page === 0}
                            style={{ padding: '5px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'none', color: page === 0 ? 'var(--text-muted)' : 'inherit', cursor: page === 0 ? 'default' : 'pointer' }}
                        >‹</button>
                        {Array.from({ length: Math.min(pageCount, 7) }, (_, i) => {
                            // Sliding window: show pages around current
                            let p: number;
                            if (pageCount <= 7) p = i;
                            else if (page < 4) p = i;
                            else if (page > pageCount - 5) p = pageCount - 7 + i;
                            else p = page - 3 + i;
                            return (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    style={{
                                        padding: '5px 10px', fontSize: '13px', borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        background: p === page ? 'var(--accent, #3b82f6)' : 'none',
                                        color: p === page ? '#fff' : 'inherit',
                                        cursor: 'pointer', fontWeight: p === page ? 600 : 400,
                                    }}
                                >{p + 1}</button>
                            );
                        })}
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={page >= pageCount - 1}
                            style={{ padding: '5px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'none', color: page >= pageCount - 1 ? 'var(--text-muted)' : 'inherit', cursor: page >= pageCount - 1 ? 'default' : 'pointer' }}
                        >›</button>
                        <button
                            onClick={() => setPage(pageCount - 1)}
                            disabled={page >= pageCount - 1}
                            style={{ padding: '5px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'none', color: page >= pageCount - 1 ? 'var(--text-muted)' : 'inherit', cursor: page >= pageCount - 1 ? 'default' : 'pointer' }}
                        >»</button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
