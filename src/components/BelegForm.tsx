'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Beleg } from '@/lib/data';

interface UserProfile {
    id: string;
    name: string;
    strasse?: string;
    ort?: string;
    unterschrift?: string;
}

export default function BelegForm({
    userId,
    beleg,
    isAdmin = false,
    selectableUsers = [],
    orgAddress,
}: {
    userId: string;
    beleg?: Beleg;
    isAdmin?: boolean;
    selectableUsers?: { id: string; name: string }[];
    orgAddress?: string;
}) {
    const router = useRouter();
    const isEdit = !!beleg;

    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [selectedUserId, setSelectedUserId] = useState(beleg?.user_id || userId);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [titel, setTitel] = useState(beleg?.titel || '');
    const [beschreibung, setBeschreibung] = useState(beleg?.beschreibung || '');
    const [netto, setNetto] = useState(beleg?.netto != null ? String(beleg.netto) : '');
    const [mwstSatz, setMwstSatz] = useState<0 | 19>((beleg?.mwst_satz as 0 | 19) ?? 0);
    const [datum, setDatum] = useState(beleg?.datum || new Date().toISOString().split('T')[0]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const nettoNum = parseFloat(netto) || 0;
    const mwstBetrag = Math.round(nettoNum * mwstSatz) / 100;
    const brutto = Math.round((nettoNum + mwstBetrag) * 100) / 100;

    useEffect(() => {
        fetch('/api/users').then(r => r.json()).then((users: any[]) => {
            setAllUsers(users.map((u: any) => ({ id: u.id, name: u.name, strasse: u.strasse, ort: u.ort, unterschrift: u.unterschrift })));
        });
    }, []);

    useEffect(() => {
        const me = allUsers.find(u => u.id === selectedUserId);
        setProfile(me || null);
    }, [selectedUserId, allUsers]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!titel || !netto) { setError('Bitte Titel und Nettobetrag angeben.'); return; }
        setSaving(true);
        setError('');
        try {
            const url = isEdit ? `/api/belege/${beleg!.id}` : '/api/belege';
            const method = isEdit ? 'PATCH' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    titel,
                    beschreibung,
                    netto: nettoNum,
                    mwst_satz: mwstSatz,
                    betrag: brutto,
                    datum,
                    ...(isEdit ? {} : { status: 'entwurf', user_id: selectedUserId }),
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
                    {/* User-Auswahl für Admins */}
                    {isAdmin && !isEdit && selectableUsers.length > 0 && (
                        <div className="form-group" style={{ margin: '16px 0 8px 0' }}>
                            <label className="form-label">Beleg für</label>
                            <select className="form-select" value={selectedUserId}
                                onChange={e => setSelectedUserId(e.target.value)}>
                                <option value="">– Person auswählen –</option>
                                {selectableUsers.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Adresse des Users */}
                    {profile && (
                        <div style={{ margin: '16px 0 24px 0', padding: '12px 16px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
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
                            <strong style={{ color: 'var(--navy)' }}>Zu Gunsten / Lasten von:</strong> {orgAddress || ''}
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
