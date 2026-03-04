'use client';

import { useState } from 'react';
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
}

export default function UserEditClient({ user, currentUserRole }: Props) {
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

    const isAdmin = currentUserRole === 'admin';

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
            if (['springerin', 'eltern', 'member'].includes(form.role)) {
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
            router.push('/user');
            router.refresh();
        } catch {
            setError('Server-Fehler');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ maxWidth: '560px' }}>
            <div className="form-group">
                <label className="form-label">Name</label>
                <input
                    className="form-input"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
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
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    minLength={6}
                />
            </div>

            <div className="form-group">
                <label className="form-label">Rolle</label>
                <select
                    className="form-select"
                    value={form.role}
                    disabled={!isAdmin}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                    <option value="member">Vorstandsmitglied</option>
                    <option value="admin">Finanzvorstand</option>
                    <option value="eltern">Eltern</option>
                    <option value="springerin">Springerin</option>
                </select>
            </div>

            {['springerin', 'eltern', 'member'].includes(form.role) && (
                <>
                    <div className="form-group">
                        <label className="form-label">Straße + Hausnummer</label>
                        <input
                            className="form-input"
                            type="text"
                            value={form.strasse}
                            onChange={(e) => setForm({ ...form, strasse: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">PLZ + Ort</label>
                        <input
                            className="form-input"
                            type="text"
                            value={form.ort}
                            onChange={(e) => setForm({ ...form, ort: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">IBAN</label>
                        <input
                            className="form-input"
                            type="text"
                            value={form.iban}
                            onChange={(e) => setForm({ ...form, iban: e.target.value })}
                        />
                    </div>
                </>
            )}

            {form.role === 'springerin' && (
                <>
                    <div className="form-group">
                        <label className="form-label">Steuer-ID</label>
                        <input
                            className="form-input"
                            type="text"
                            value={form.steuerid}
                            onChange={(e) => setForm({ ...form, steuerid: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Handynummer</label>
                        <input
                            className="form-input"
                            type="text"
                            value={form.handynummer}
                            onChange={(e) => setForm({ ...form, handynummer: e.target.value })}
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
                            onChange={(e) => setForm({ ...form, stundensatz: parseFloat(e.target.value) || 0 })}
                        />
                    </div>
                </>
            )}

            {['springerin', 'eltern', 'member'].includes(form.role) && (
                <div className="form-group">
                    <label className="form-label">Unterschrift</label>
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
                            </div>
                        ) : (
                            <SignaturePad
                                existing={form.unterschrift || null}
                                onSave={(dataUrl) => {
                                    setForm({ ...form, unterschrift: dataUrl });
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
                <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
                    Abbrechen
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Speichern...' : 'Änderungen speichern'}
                </button>
            </div>
        </form>
    );
}
