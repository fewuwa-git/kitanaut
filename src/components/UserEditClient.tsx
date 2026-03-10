'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SignaturePad from '@/components/SignaturePad';

interface UserEditData {
    id: string;
    name: string;
    email: string;
    role: string;
    strasse?: string;
    ort?: string;
    iban?: string;
    steuerid?: string;
    handynummer?: string;
    stundensatz?: number;
    unterschrift?: string;
}

interface Props {
    user: UserEditData;
    currentUserRole: string;
    isSelf?: boolean;
}

const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: active ? 600 : 500,
    color: active ? 'var(--navy)' : 'var(--text-muted)',
    marginBottom: -2,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
});

export default function UserEditClient({ user, currentUserRole, isSelf = false }: Props) {
    const router = useRouter();
    const [form, setForm] = useState({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role,
        strasse: user.strasse || '',
        ort: user.ort || '',
        iban: user.iban || '',
        steuerid: user.steuerid || '',
        handynummer: user.handynummer || '',
        stundensatz: user.stundensatz || 0,
        unterschrift: user.unterschrift || '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSignaturePad, setShowSignaturePad] = useState(false);
    const [signatureSaving, setSignatureSaving] = useState(false);
    const [signatureSaved, setSignatureSaved] = useState(false);
    const [activeTab, setActiveTab] = useState<'konto' | 'kontakt' | 'abrechnung' | 'unterschrift'>('konto');
    const [isDirty, setIsDirty] = useState(false);
    const [showLeaveModal, setShowLeaveModal] = useState(false);

    // Browser-Navigation (Refresh/Tab schließen) abfangen
    useEffect(() => {
        if (!isDirty) return;
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);

    const updateForm = (patch: Partial<typeof form>) => {
        setForm(f => ({ ...f, ...patch }));
        setIsDirty(true);
    };

    const handleBack = () => {
        if (isDirty) { setShowLeaveModal(true); return; }
        router.back();
    };

    const isAdmin = currentUserRole === 'admin';
    const canChangeRole = isAdmin && !isSelf;
    const hasKontakt = ['springerin', 'eltern', 'member', 'finanzvorstand'].includes(form.role);
    const isSpringerin = form.role === 'springerin';

    const saveSignature = async (dataUrl: string) => {
        setSignatureSaving(true);
        setSignatureSaved(false);
        try {
            await fetch(`/api/users/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ unterschrift: dataUrl }),
            });
            setForm(f => ({ ...f, unterschrift: dataUrl }));
            setSignatureSaved(true);
            setTimeout(() => setSignatureSaved(false), 2000);
        } finally {
            setSignatureSaving(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const body: Record<string, unknown> = {
                name: form.name,
                email: form.email,
                role: form.role,
            };
            if (form.password) body.password = form.password;
            if (['springerin', 'eltern', 'member', 'finanzvorstand'].includes(form.role)) {
                body.strasse = form.strasse;
                body.ort = form.ort;
                body.iban = form.iban;
                body.unterschrift = form.unterschrift;
            }
            if (form.role === 'springerin') {
                body.steuerid = form.steuerid;
                body.handynummer = form.handynummer;
                body.stundensatz = Number(form.stundensatz);
            }

            const res = await fetch(`/api/users/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setIsDirty(false);
            router.push('/user');
            router.refresh();
        } catch {
            setError('Server-Fehler');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            {/* Tab Nav */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 24 }}>
                <button type="button" style={TAB_STYLE(activeTab === 'konto')} onClick={() => setActiveTab('konto')}>
                    Konto
                </button>
                {hasKontakt && (
                    <button type="button" style={TAB_STYLE(activeTab === 'kontakt')} onClick={() => setActiveTab('kontakt')}>
                        Kontakt
                    </button>
                )}
                {isSpringerin && (
                    <button type="button" style={TAB_STYLE(activeTab === 'abrechnung')} onClick={() => setActiveTab('abrechnung')}>
                        Abrechnung
                    </button>
                )}
                {hasKontakt && (
                    <button type="button" style={TAB_STYLE(activeTab === 'unterschrift')} onClick={() => setActiveTab('unterschrift')}>
                        Unterschrift
                    </button>
                )}
            </div>

            <div style={{ maxWidth: '560px' }}>
                {/* Tab: Konto */}
                {activeTab === 'konto' && (
                    <>
                        <div className="form-group">
                            <label className="form-label">Name</label>
                            <input
                                className="form-input"
                                type="text"
                                value={form.name}
                                onChange={(e) => updateForm({ name: e.target.value })}
                                required
                                disabled={!isAdmin && form.role !== 'springerin'}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">E-Mail</label>
                            <input
                                className="form-input"
                                type="email"
                                value={form.email}
                                onChange={(e) => updateForm({ email: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                Neues Passwort{' '}
                                <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}>(leer lassen = unverändert)</span>
                            </label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder="Neues Passwort"
                                value={form.password}
                                onChange={(e) => updateForm({ password: e.target.value })}
                                minLength={6}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Rolle</label>
                            <select
                                className="form-select"
                                value={form.role}
                                disabled={!canChangeRole}
                                onChange={(e) => updateForm({ role: e.target.value })}
                            >
                                <option value="member">Vorstandsmitglied</option>
                                <option value="admin">Admin</option>
                                <option value="finanzvorstand">Finanzvorstand</option>
                                <option value="eltern">Eltern</option>
                                <option value="springerin">Springerin</option>
                            </select>
                        </div>
                    </>
                )}

                {/* Tab: Kontakt */}
                {activeTab === 'kontakt' && hasKontakt && (
                    <>
                        <div className="form-group">
                            <label className="form-label">Straße + Hausnummer</label>
                            <input
                                className="form-input"
                                type="text"
                                value={form.strasse}
                                onChange={(e) => updateForm({ strasse: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">PLZ + Ort</label>
                            <input
                                className="form-input"
                                type="text"
                                value={form.ort}
                                onChange={(e) => updateForm({ ort: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Handynummer</label>
                            <input
                                className="form-input"
                                type="text"
                                value={form.handynummer}
                                onChange={(e) => updateForm({ handynummer: e.target.value })}
                            />
                        </div>
                    </>
                )}

                {/* Tab: Abrechnung (nur Springerin) */}
                {activeTab === 'abrechnung' && isSpringerin && (
                    <>
                        <div className="form-group">
                            <label className="form-label">IBAN</label>
                            <input
                                className="form-input"
                                type="text"
                                value={form.iban}
                                onChange={(e) => updateForm({ iban: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Steuer-ID</label>
                            <input
                                className="form-input"
                                type="text"
                                value={form.steuerid}
                                onChange={(e) => updateForm({ steuerid: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Stundensatz (€)</label>
                            <input
                                className="form-input"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={form.stundensatz || ''}
                                onChange={(e) => updateForm({ stundensatz: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                    </>
                )}

                {/* Tab: Unterschrift */}
                {activeTab === 'unterschrift' && hasKontakt && (
                    <div className="form-group">
                        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '16px', background: 'var(--bg)' }}>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                ℹ️ Unterschriften werden für Belege und Abrechnungen genutzt.
                            </p>
                            {!showSignaturePad ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    {form.unterschrift ? (
                                        <img
                                            src={form.unterschrift}
                                            alt="Unterschrift"
                                            style={{ maxHeight: '60px', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px', background: '#fff' }}
                                        />
                                    ) : (
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Noch keine Unterschrift hinterlegt</span>
                                    )}
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowSignaturePad(true)}>
                                        {form.unterschrift ? 'Unterschrift ändern' : 'Unterschrift erstellen'}
                                    </button>
                                    {form.unterschrift && (
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => saveSignature('')} disabled={signatureSaving} style={{ color: 'var(--red)' }}>
                                            Löschen
                                        </button>
                                    )}
                                    {signatureSaving && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Speichern…</span>}
                                    {signatureSaved && <span style={{ fontSize: '12px', color: 'var(--success, green)' }}>✓ Gespeichert</span>}
                                </div>
                            ) : (
                                <SignaturePad
                                    existing={form.unterschrift || null}
                                    onSave={(dataUrl) => {
                                        saveSignature(dataUrl);
                                        setShowSignaturePad(false);
                                    }}
                                    onCancel={() => setShowSignaturePad(false)}
                                />
                            )}
                        </div>
                    </div>
                )}

                {error && <div className="error-msg">⚠️ {error}</div>}

                <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
                    <button type="button" className="btn btn-secondary" onClick={handleBack}>
                        Abbrechen
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Speichern...' : 'Änderungen speichern'}
                    </button>
                </div>
            </div>

            {/* Modal: Ungespeicherte Änderungen */}
            {showLeaveModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div className="card" style={{ maxWidth: 400, width: '90%', padding: '28px 24px' }}>
                        <div style={{ fontSize: 20, marginBottom: 8 }}>⚠️ Ungespeicherte Änderungen</div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
                            Du hast Änderungen vorgenommen, die noch nicht gespeichert wurden. Möchtest du die Seite trotzdem verlassen?
                        </p>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => setShowLeaveModal(false)}>
                                Zurück
                            </button>
                            <button className="btn btn-danger" onClick={() => router.back()}>
                                Ohne Speichern verlassen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
}
