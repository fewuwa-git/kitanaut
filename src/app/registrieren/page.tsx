'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
    const router = useRouter();
    const [form, setForm] = useState({ name: '', email: '', password: '', password2: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [orgData, setOrgData] = useState<{ name: string; logo_url: string | null } | null>(null);

    useEffect(() => {
        fetch('/api/org/public').then(r => r.json()).then(setOrgData);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.password !== form.password2) {
            setError('Die Passwörter stimmen nicht überein.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setDone(true);
        } catch {
            setError('Server-Fehler. Bitte versuche es erneut.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-logo">
                    <img src={orgData?.logo_url || '/logo.png'} alt={`${orgData?.name || ''} Logo`} className="login-logo-icon" />
                    <div className="login-logo-text">
                        <h2>{orgData?.name || ''}</h2>
                        <p>Finanzen</p>
                    </div>
                </div>

                {done ? (
                    <>
                        <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#15803d', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                            ✓ Registrierung erfolgreich! Dein Account wird geprüft – du erhältst eine E-Mail, sobald er freigeschaltet wurde.
                        </div>
                        <button className="btn btn-secondary full-width" style={{ justifyContent: 'center' }} onClick={() => router.push('/login')}>
                            Zum Login
                        </button>
                    </>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Name</label>
                            <input
                                className="form-input"
                                type="text"
                                placeholder="Max Mustermann"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                required
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">E-Mail-Adresse</label>
                            <input
                                className="form-input"
                                type="email"
                                placeholder="deine@email.de"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Passwort</label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder="Mindestens 6 Zeichen"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                minLength={6}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Passwort wiederholen</label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder="••••••••"
                                value={form.password2}
                                onChange={(e) => setForm({ ...form, password2: e.target.value })}
                                minLength={6}
                                required
                            />
                        </div>

                        {error && (
                            <div className="error-msg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                ⚠️ {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary full-width mt-4"
                            style={{ justifyContent: 'center', padding: '12px', fontSize: '15px' }}
                            disabled={loading}
                        >
                            {loading ? 'Registrieren...' : 'Registrieren →'}
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push('/login')}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', marginTop: '16px', cursor: 'pointer', display: 'block', width: '100%', textAlign: 'center' }}
                        >
                            Bereits registriert? Zum Login
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
