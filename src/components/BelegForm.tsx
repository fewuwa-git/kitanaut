'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UserProfile {
    name: string;
    strasse?: string;
    ort?: string;
    unterschrift?: string;
}

export default function BelegForm({ userId }: { userId: string }) {
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [titel, setTitel] = useState('');
    const [beschreibung, setBeschreibung] = useState('');
    const [netto, setNetto] = useState('');
    const [mwstSatz, setMwstSatz] = useState<0 | 19>(0);
    const [datum, setDatum] = useState(new Date().toISOString().split('T')[0]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const nettoNum = parseFloat(netto) || 0;
    const mwstBetrag = Math.round(nettoNum * mwstSatz) / 100;
    const brutto = Math.round((nettoNum + mwstBetrag) * 100) / 100;

    useEffect(() => {
        fetch('/api/users').then(r => r.json()).then((users: any[]) => {
            const me = users.find((u: any) => u.id === userId);
            if (me) setProfile({ name: me.name, strasse: me.strasse, ort: me.ort, unterschrift: me.unterschrift });
        });
    }, [userId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!titel || !netto) { setError('Bitte Titel und Nettobetrag angeben.'); return; }
        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/belege', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    titel,
                    beschreibung,
                    netto: nettoNum,
                    mwst_satz: mwstSatz,
                    betrag: brutto,
                    datum,
                    status: 'entwurf',
                }),
            });
            if (!res.ok) { setError('Fehler beim Speichern.'); return; }
            router.push('/eltern/belege');
        } catch {
            setError('Server-Fehler.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ maxWidth: '640px' }}>
            <div className="card">
                <div className="card-body">
                    {/* Adresse des Users */}
                    {profile && (
                        <div style={{ marginBottom: '24px', padding: '12px 16px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '6px' }}>EMPFANGEN VON</div>
                            <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{profile.name}</div>
                            {profile.strasse && <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{profile.strasse}</div>}
                            {profile.ort && <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{profile.ort}</div>}
                            {!profile.strasse && !profile.ort && (
                                <div style={{ fontSize: '13px', color: 'var(--orange)', marginTop: '4px' }}>⚠ Keine Adresse hinterlegt – bitte im Profil ergänzen</div>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Titel / Für */}
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Für (Verwendungszweck)</label>
                            <textarea className="form-input" rows={2} value={titel}
                                onChange={e => setTitel(e.target.value)} required
                                style={{ resize: 'none' }} />
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Zusätzliche Beschreibung <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}>(optional)</span></label>
                            <textarea className="form-input" rows={1} value={beschreibung}
                                onChange={e => setBeschreibung(e.target.value)}
                                style={{ resize: 'none' }} />
                        </div>

                        {/* Beträge */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Netto (€)</label>
                                <input className="form-input" type="number" step="0.01" min="0" value={netto}
                                    onChange={e => setNetto(e.target.value)} required />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Mehrwertsteuer</label>
                                <select className="form-select" value={mwstSatz}
                                    onChange={e => setMwstSatz(Number(e.target.value) as 0 | 19)}>
                                    <option value={0}>Ohne MwSt.</option>
                                    <option value={19}>zzgl. 19% MwSt.</option>
                                </select>
                            </div>
                        </div>

                        {/* Brutto-Anzeige */}
                        {nettoNum > 0 && (
                            <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px 16px', border: '1px solid var(--border)' }}>
                                {mwstSatz > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                                        <span>zzgl. {mwstSatz}% MwSt.</span>
                                        <span>{mwstBetrag.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '15px', color: 'var(--navy)' }}>
                                    <span>{mwstSatz > 0 ? 'Brutto' : 'Gesamt'}</span>
                                    <span>{brutto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                                </div>
                            </div>
                        )}

                        {/* Datum */}
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Ort / Datum</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>Berlin,</span>
                                <input className="form-input" type="date" value={datum}
                                    onChange={e => setDatum(e.target.value)} style={{ flex: 1 }} />
                            </div>
                        </div>

                        {/* Zu Gunsten/Lasten */}
                        <div style={{ padding: '10px 16px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-muted)' }}>
                            <strong style={{ color: 'var(--navy)' }}>Zu Gunsten / Lasten von:</strong> Pankonauten e.V.
                        </div>

                        {/* Unterschrift-Vorschau */}
                        {profile?.unterschrift && (
                            <div style={{ padding: '10px 16px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '6px' }}>UNTERSCHRIFT</div>
                                <img src={profile.unterschrift} alt="Unterschrift" style={{ maxHeight: '50px' }} />
                            </div>
                        )}

                        {error && <div className="error-msg">⚠️ {error}</div>}

                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => router.push('/eltern/belege')}>Abbrechen</button>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? 'Speichern...' : '💾 Beleg speichern'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
