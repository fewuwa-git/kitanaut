'use client';

import { useState, useEffect, use } from 'react';

interface KnExtraSource {
    source: 'kita-navigator';
    source_url: string;
    telefon: string;
    email: string;
    webseite: string;
    plaetze: number | null;
}

interface SenatsExtraSource {
    source: 'senatsliste';
    einrichtungsnummer: string;
    typ: string;
    plaetze: number | null;
    telefon: string;
    traeger: string;
}

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
    extra_sources: (KnExtraSource | SenatsExtraSource)[];
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

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    neu:         { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' },
    kontaktiert: { bg: 'rgba(59,130,246,0.15)',  text: '#3b82f6' },
    interessiert:{ bg: 'rgba(245,158,11,0.15)',  text: '#f59e0b' },
    kunde:       { bg: 'rgba(34,197,94,0.15)',   text: '#22c55e' },
    abgelehnt:   { bg: 'rgba(239,68,68,0.15)',   text: '#ef4444' },
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ width: '140px', flexShrink: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', paddingTop: '2px' }}>
                {label}
            </div>
            <div style={{ flex: 1, fontSize: '14px' }}>{children}</div>
        </div>
    );
}

/** Zeigt primären Wert + optionalen Kita-Navigator-Abweichungswert */
function normalizePhone(tel: string): string {
    return tel.replace(/\D/g, '');
}

function normalizeUrl(url: string): string {
    try {
        const u = new URL(url);
        return (u.hostname + u.pathname).replace(/\/+$/, '').toLowerCase();
    } catch {
        return url.trim().toLowerCase();
    }
}

function ContactField({ primary, kn, renderPrimary, renderKn, compareNormalized, normalizer }: {
    primary: string;
    kn: string | undefined;
    renderPrimary: (v: string) => React.ReactNode;
    renderKn: (v: string) => React.ReactNode;
    compareNormalized?: boolean;
    normalizer?: (v: string) => string;
}) {
    const norm = normalizer ?? normalizeUrl;
    const knDiffers = kn && (compareNormalized
        ? norm(kn) !== norm(primary)
        : kn !== primary);
    return (
        <div>
            {primary ? renderPrimary(primary) : <span style={{ color: 'var(--text-muted)' }}>–</span>}
            {knDiffers && (
                <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#a855f7', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: '4px', padding: '1px 5px', whiteSpace: 'nowrap' }}>
                        Kita-Navigator
                    </span>
                    {renderKn(kn!)}
                </div>
            )}
        </div>
    );
}

function formatDate(iso: string) {
    try {
        return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
    } catch { return iso; }
}

export default function CrmDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [prospect, setProspect] = useState<Prospect | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [editNotizen, setEditNotizen] = useState(false);
    const [notizen, setNotizen] = useState('');

    useEffect(() => {
        fetch(`/api/admin/crm/${id}`)
            .then(r => r.json())
            .then(data => {
                if (data.error) { setError(data.error); }
                else { setProspect(data); setNotizen(data.notizen ?? ''); }
            })
            .catch(() => setError('Netzwerkfehler'))
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setEditNotizen(false);
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    async function patch(data: { status?: string; notizen?: string }) {
        if (!prospect) return;
        setSaving(true);
        const res = await fetch(`/api/admin/crm/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            const updated = await res.json();
            setProspect(updated);
            setNotizen(updated.notizen ?? '');
        }
        setSaving(false);
    }

    async function saveNotizen() {
        await patch({ notizen });
        setEditNotizen(false);
    }

    if (loading) return (
        <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                border: '3px solid var(--border-color)', borderTopColor: 'var(--accent)',
                animation: 'spin 0.7s linear infinite', margin: '0 auto',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    if (error || !prospect) return (
        <div style={{ padding: '2rem' }}>
            <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error || 'Nicht gefunden.'}</div>
            <a href="/admin/crm" style={{ color: 'var(--accent)', fontSize: '13px', textDecoration: 'none' }}>← Zurück</a>
        </div>
    );

    const sc = STATUS_COLORS[prospect.status] ?? { bg: 'transparent', text: 'inherit' };
    const adresse = [prospect.strasse, [prospect.plz, prospect.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const kn = prospect.extra_sources?.find(e => e.source === 'kita-navigator') as KnExtraSource | undefined;
    const senat = prospect.extra_sources?.find(e => e.source === 'senatsliste') as SenatsExtraSource | undefined;

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            {/* Breadcrumb */}
            <div style={{ marginBottom: '1.5rem', fontSize: '13px', color: 'var(--text-muted)' }}>
                <a href="/admin/crm" style={{ color: 'var(--accent)', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                >CRM</a>
                {' / '}
                <span>{prospect.name || 'Kita'}</span>
            </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0, marginBottom: '6px' }}>{prospect.name || '–'}</h1>
                    {adresse && <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{adresse}</div>}
                </div>
                <select
                    value={prospect.status}
                    disabled={saving}
                    onChange={e => patch({ status: e.target.value })}
                    style={{
                        background: sc.bg, color: sc.text,
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px', padding: '6px 10px',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer', outline: 'none',
                    }}
                >
                    {STATUS_OPTIONS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>
            </div>

            {/* Kontakt */}
            <div className="card" style={{ padding: '0 20px', marginBottom: '16px' }}>
                <div style={{ padding: '14px 0 6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Kontakt
                </div>
                {(prospect.telefon || kn?.telefon || senat?.telefon) && (
                    <Row label="Telefon">
                        <ContactField
                            primary={prospect.telefon}
                            kn={kn?.telefon}
                            compareNormalized
                            renderPrimary={v => <a href={`tel:${v}`} style={{ color: 'var(--accent)', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')} onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>{v}</a>}
                            renderKn={v => <a href={`tel:${v}`} style={{ color: '#a855f7', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')} onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>{v}</a>}
                            normalizer={normalizePhone}
                        />
                        {senat?.telefon && normalizePhone(senat.telefon) !== normalizePhone(prospect.telefon) && normalizePhone(senat.telefon) !== normalizePhone(kn?.telefon ?? '') && (
                            <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 600, color: '#16a34a', background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: '4px', padding: '1px 5px', whiteSpace: 'nowrap' }}>Senat</span>
                                <a href={`tel:${senat.telefon}`} style={{ color: '#16a34a', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')} onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>{senat.telefon}</a>
                            </div>
                        )}
                    </Row>
                )}
                {(prospect.email || kn?.email) && (
                    <Row label="E-Mail">
                        <ContactField
                            primary={prospect.email}
                            kn={kn?.email}
                            renderPrimary={v => <a href={`mailto:${v}`} style={{ color: 'var(--accent)', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')} onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>{v}</a>}
                            renderKn={v => <a href={`mailto:${v}`} style={{ color: '#a855f7', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')} onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>{v}</a>}
                        />
                    </Row>
                )}
                {(prospect.webseite || kn?.webseite) && (
                    <Row label="Webseite">
                        <ContactField
                            primary={prospect.webseite}
                            kn={kn?.webseite}
                            compareNormalized
                            renderPrimary={v => <a href={v} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')} onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>{(() => { try { return new URL(v).hostname.replace('www.', ''); } catch { return v; } })()}</a>}
                            renderKn={v => <a href={v} target="_blank" rel="noopener noreferrer" style={{ color: '#a855f7', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')} onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>{(() => { try { return new URL(v).hostname.replace('www.', ''); } catch { return v; } })()}</a>}
                        />
                    </Row>
                )}
                {!prospect.telefon && !prospect.email && !prospect.webseite && !kn?.email && !kn?.webseite && (
                    <div style={{ padding: '12px 0', color: 'var(--text-muted)', fontSize: '13px' }}>Keine Kontaktdaten vorhanden.</div>
                )}
            </div>

            {/* Details */}
            <div className="card" style={{ padding: '0 20px', marginBottom: '16px' }}>
                <div style={{ padding: '14px 0 6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Details
                </div>
                <Row label="Adresse">
                    <span>{adresse || '–'}</span>
                    {adresse && (
                        <a href={`https://www.google.com/maps/search/${encodeURIComponent([prospect.name, adresse].filter(Boolean).join(', '))}`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ marginLeft: '10px', fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}
                            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >Maps ↗</a>
                    )}
                </Row>
                {prospect.bezirk && <Row label="Bezirk">{prospect.bezirk}</Row>}
                {prospect.traeger && <Row label="Träger">{prospect.traeger}</Row>}
                {(prospect.plaetze != null || kn?.plaetze != null || senat?.plaetze != null) && (
                    <Row label="Plätze">
                        <div>
                            {prospect.plaetze != null ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{prospect.plaetze}</span>
                                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '4px', padding: '1px 5px' }}>
                                        {prospect.source === 'daks' ? 'DaKS' : prospect.source === 'kita-navigator' ? 'Kita-Navigator' : prospect.source}
                                    </span>
                                </div>
                            ) : (
                                <span style={{ color: 'var(--text-muted)' }}>–</span>
                            )}
                            {kn?.plaetze != null && kn.plaetze !== prospect.plaetze && (
                                <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: '#a855f7' }}>{kn.plaetze}</span>
                                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#a855f7', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: '4px', padding: '1px 5px' }}>
                                        Kita-Navigator
                                    </span>
                                </div>
                            )}
                            {senat?.plaetze != null && senat.plaetze !== prospect.plaetze && senat.plaetze !== kn?.plaetze && (
                                <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: '#16a34a' }}>{senat.plaetze}</span>
                                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#16a34a', background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: '4px', padding: '1px 5px' }}>
                                        Senat (genehmigt)
                                    </span>
                                </div>
                            )}
                        </div>
                    </Row>
                )}
                <Row label="Quelle">
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
                            fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                            background: prospect.source === 'daks' ? 'rgba(59,130,246,0.12)' : prospect.source === 'kita-navigator' ? 'rgba(168,85,247,0.12)' : prospect.source === 'senatsliste' ? 'rgba(22,163,74,0.12)' : 'rgba(148,163,184,0.12)',
                            color: prospect.source === 'daks' ? '#3b82f6' : prospect.source === 'kita-navigator' ? '#a855f7' : prospect.source === 'senatsliste' ? '#16a34a' : '#94a3b8',
                        }}>{prospect.source === 'senatsliste' ? 'Senatsliste' : prospect.source}</span>
                        {prospect.source_url && (
                            <a href={prospect.source_url} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}
                                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                            >Originalprofil ↗</a>
                        )}
                        {kn?.source_url && (
                            <a href={kn.source_url} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: '12px', color: '#a855f7', textDecoration: 'none' }}
                                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                            >Kita-Navigator ↗</a>
                        )}
                    </div>
                </Row>
                {senat?.typ && senat.typ !== 'Reguläre Einrichtung' && (
                    <Row label="Einrichtungstyp">{senat.typ}</Row>
                )}
                <Row label="Importiert">{formatDate(prospect.created_at)}</Row>
                <Row label="Aktualisiert">{formatDate(prospect.updated_at)}</Row>
            </div>

            {/* Notizen */}
            <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Notizen
                    </span>
                    {!editNotizen && (
                        <button
                            onClick={() => setEditNotizen(true)}
                            style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >Bearbeiten</button>
                    )}
                </div>

                {editNotizen ? (
                    <div>
                        <textarea
                            value={notizen}
                            autoFocus
                            rows={5}
                            onChange={e => setNotizen(e.target.value)}
                            style={{
                                width: '100%', padding: '8px 10px', borderRadius: '6px',
                                border: '1px solid var(--accent, #3b82f6)',
                                background: 'rgba(59,130,246,0.06)', color: 'inherit',
                                fontSize: '13px', resize: 'vertical', fontFamily: 'inherit',
                                boxSizing: 'border-box',
                            }}
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button
                                onClick={saveNotizen}
                                disabled={saving}
                                className="btn btn-primary"
                                style={{ fontSize: '13px', padding: '6px 16px' }}
                            >Speichern</button>
                            <button
                                onClick={() => { setNotizen(prospect.notizen ?? ''); setEditNotizen(false); }}
                                style={{ fontSize: '13px', padding: '6px 14px', background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >Abbrechen</button>
                        </div>
                    </div>
                ) : (
                    <div
                        onClick={() => setEditNotizen(true)}
                        style={{ fontSize: '13px', minHeight: '48px', cursor: 'text', whiteSpace: 'pre-wrap', color: prospect.notizen ? 'inherit' : 'var(--text-muted)' }}
                    >
                        {prospect.notizen || <span style={{ fontStyle: 'italic' }}>Keine Notizen. Klicken zum Hinzufügen.</span>}
                    </div>
                )}
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
