'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type Source = 'daks' | 'kita-navigator';
type ModalPhase = 'idle' | 'running' | 'done' | 'error';

interface ModalState {
    phase: ModalPhase;
    source: Source | null;
    message: string;
    current: number;
    total: number;
    log: string[];
    result: { new: number; updated?: number; matched?: number; total: number; dbTotal?: number } | null;
    errorMessage: string;
}

const INITIAL_MODAL: ModalState = {
    phase: 'idle', source: null, message: '', current: 0, total: 0,
    log: [], result: null, errorMessage: '',
};

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
    const [modal, setModal] = useState<ModalState>(INITIAL_MODAL);
    const logEndRef = useRef<HTMLDivElement>(null);

    // Escape schließt Modal (nur wenn nicht running)
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                setModal(prev => prev.phase !== 'running' ? INITIAL_MODAL : prev);
            }
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    // Auto-scroll Log
    useEffect(() => {
        if (modal.phase === 'running') {
            logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [modal.log.length, modal.phase]);

    const handleStreamEvent = useCallback((event: Record<string, unknown>) => {
        if (event.type === 'progress') {
            setModal(prev => ({
                ...prev,
                message: typeof event.message === 'string' ? event.message : prev.message,
                current: typeof event.current === 'number' ? event.current : prev.current,
                total: typeof event.total === 'number' ? event.total : prev.total,
                log: typeof event.message === 'string'
                    ? [...prev.log.slice(-199), event.message]
                    : prev.log,
            }));
        } else if (event.type === 'done') {
            setModal(prev => ({
                ...prev,
                phase: 'done',
                result: {
                    new: Number(event.new ?? 0),
                    updated: event.updated != null ? Number(event.updated) : undefined,
                    matched: event.matched != null ? Number(event.matched) : undefined,
                    total: Number(event.total ?? 0),
                    dbTotal: event.dbTotal != null ? Number(event.dbTotal) : undefined,
                },
            }));
        } else if (event.type === 'error') {
            setModal(prev => ({
                ...prev,
                phase: 'error',
                errorMessage: typeof event.message === 'string' ? event.message : 'Unbekannter Fehler',
            }));
        }
    }, []);

    async function handleScrape(source: Source, endpoint: string) {
        setModal({ ...INITIAL_MODAL, phase: 'running', source });

        let buffer = '';
        try {
            const res = await fetch(endpoint, { method: 'POST' });

            if (!res.ok || !res.body) {
                const data = await res.json().catch(() => ({ error: 'Serverfehler' }));
                setModal(prev => ({ ...prev, phase: 'error', errorMessage: data.error ?? 'Serverfehler' }));
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    try { handleStreamEvent(JSON.parse(trimmed)); } catch { /* ignorieren */ }
                }
            }
            if (buffer.trim()) {
                try { handleStreamEvent(JSON.parse(buffer.trim())); } catch { /* ignorieren */ }
            }
        } catch (err) {
            setModal(prev => ({
                ...prev,
                phase: 'error',
                errorMessage: err instanceof Error ? err.message : 'Netzwerkfehler',
            }));
        }
    }

    const src = SOURCES.find(s => s.id === modal.source);
    const progressPct = modal.total > 0 ? Math.round((modal.current / modal.total) * 100) : 0;

    return (
        <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
            <h1 style={{ marginTop: 0, marginBottom: '0.25rem' }}>CRM Import</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '2rem' }}>
                Kita-Daten aus verschiedenen Quellen ins CRM importieren. Bestehende Einträge werden aktualisiert.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {SOURCES.map(s => (
                    <div key={s.id} className="card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{s.label}</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{s.description}</div>
                            </div>
                            <button
                                onClick={() => handleScrape(s.id, s.endpoint)}
                                disabled={modal.phase === 'running'}
                                className="btn btn-primary"
                                style={{ minWidth: '160px', flexShrink: 0 }}
                            >
                                {modal.phase === 'running' && modal.source === s.id ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                        <span style={{ width: '13px', height: '13px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                                        Läuft…
                                    </span>
                                ) : `${s.label} importieren`}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '20px' }}>
                <a href="/admin/crm" style={{ color: 'var(--accent)', fontSize: '13px', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                >← Zurück zu Alle Kontakte</a>
            </div>

            {/* Modal */}
            {modal.phase !== 'idle' && (
                <div
                    className="modal-overlay"
                    onClick={() => { if (modal.phase !== 'running') setModal(INITIAL_MODAL); }}
                >
                    <div className="modal" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {modal.phase === 'running' && (
                                <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid var(--border-color)', borderTopColor: 'var(--accent)', display: 'inline-block', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                            )}
                            {src?.label} Import
                            {modal.phase === 'done' && <span style={{ fontSize: '14px', color: '#22c55e' }}>– Fertig</span>}
                        </div>

                        {/* Fortschrittsbalken */}
                        {modal.total > 0 && (
                            <div style={{ marginBottom: '14px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '380px' }}>
                                        {modal.phase === 'done' ? 'Abgeschlossen' : modal.message}
                                    </span>
                                    <span style={{ flexShrink: 0, marginLeft: '8px' }}>{modal.current} / {modal.total}</span>
                                </div>
                                <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${modal.phase === 'done' ? 100 : progressPct}%`,
                                        background: modal.phase === 'done' ? '#22c55e' : 'var(--accent, #3b82f6)',
                                        borderRadius: '3px',
                                        transition: 'width 0.2s ease',
                                    }} />
                                </div>
                            </div>
                        )}

                        {/* Terminal-Log */}
                        {(modal.phase === 'running' || (modal.phase === 'done' && modal.log.length > 0)) && (
                            <div style={{
                                height: '200px', overflowY: 'auto',
                                background: '#0f172a', borderRadius: '8px',
                                padding: '10px 14px', fontFamily: 'monospace',
                                fontSize: '12px', color: '#64748b', marginBottom: '16px',
                                lineHeight: '1.7',
                            }}>
                                {modal.log.map((line, i) => (
                                    <div key={i} style={{ color: i === modal.log.length - 1 && modal.phase === 'running' ? '#e2e8f0' : '#64748b' }}>
                                        {line}
                                    </div>
                                ))}
                                <div ref={logEndRef} />
                            </div>
                        )}

                        {/* Ergebnis */}
                        {modal.phase === 'done' && modal.result && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                                <span style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '20px', padding: '5px 14px', fontSize: '13px', fontWeight: 600 }}>
                                    {modal.result.new} neu angelegt
                                </span>
                                <span style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '20px', padding: '5px 14px', fontSize: '13px', fontWeight: 600 }}>
                                    {modal.result.updated ?? modal.result.matched} aktualisiert
                                </span>
                                {modal.result.dbTotal != null && (
                                    <span style={{ background: 'rgba(148,163,184,0.1)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '5px 14px', fontSize: '13px', fontWeight: 500 }}>
                                        {modal.result.dbTotal} gesamt in DB
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Fehler */}
                        {modal.phase === 'error' && (
                            <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '13px', marginBottom: '20px' }}>
                                {modal.errorMessage}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                className="btn"
                                onClick={() => setModal(INITIAL_MODAL)}
                                disabled={modal.phase === 'running'}
                                style={{
                                    padding: '8px 20px', fontSize: '14px', borderRadius: '8px',
                                    border: '1px solid var(--border-color)', background: 'none',
                                    cursor: modal.phase === 'running' ? 'default' : 'pointer',
                                    color: modal.phase === 'running' ? 'var(--text-muted)' : 'inherit',
                                }}
                            >
                                {modal.phase === 'running' ? 'Läuft…' : 'Schließen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
