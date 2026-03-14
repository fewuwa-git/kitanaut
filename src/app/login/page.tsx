'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [orgData, setOrgData] = useState<{ name: string; logo_url: string | null } | null>(null);

    // Passwort vergessen
    const [showReset, setShowReset] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetDone, setResetDone] = useState(false);

    useEffect(() => {
        fetch('/api/org/public').then(r => r.json()).then(setOrgData);
    }, []);

    useEffect(() => {
        if (searchParams.get('invited') === '1') {
            setSuccessMsg('Account aktiviert! Du kannst dich jetzt einloggen.');
        }
    }, [searchParams]);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetLoading(true);
        try {
            await fetch('/api/password-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmail }),
            });
            setResetDone(true);
        } finally {
            setResetLoading(false);
        }
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Anmeldung fehlgeschlagen');
                return;
            }
            if (data.user?.role === 'springerin') {
                router.push('/springerin/abrechnung');
            } else if (data.user?.role === 'eltern' || data.user?.role === 'teammitglied') {
                router.push('/eltern/buchungen');
            } else {
                router.push('/dashboard');
            }
        } catch {
            setError('Verbindungsfehler. Bitte versuche es erneut.');
        } finally {
            setLoading(false);
        }
    }

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

                {showReset ? (
                    resetDone ? (
                        <>
                            <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#15803d', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                ✓ Falls die E-Mail-Adresse bekannt ist, wurde eine E-Mail verschickt.
                            </div>
                            <button className="btn btn-secondary full-width" style={{ justifyContent: 'center' }} onClick={() => { setShowReset(false); setResetDone(false); setResetEmail(''); }}>
                                Zurück zum Login
                            </button>
                        </>
                    ) : (
                        <form onSubmit={handleReset}>
                            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                Gib deine E-Mail-Adresse ein. Du erhältst einen Link zum Zurücksetzen deines Passworts.
                            </p>
                            <div className="form-group">
                                <label className="form-label">E-Mail-Adresse</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    placeholder="deine@email.de"
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary full-width mt-4"
                                style={{ justifyContent: 'center', padding: '12px', fontSize: '15px' }}
                                disabled={resetLoading}
                            >
                                {resetLoading ? 'Senden...' : 'Link anfordern →'}
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary full-width"
                                style={{ justifyContent: 'center', marginTop: '8px' }}
                                onClick={() => setShowReset(false)}
                            >
                                Abbrechen
                            </button>
                        </form>
                    )
                ) : (
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">E-Mail-Adresse</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="deine@email.de"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Passwort</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onClick={() => setPassword('')}
                            required
                        />
                    </div>

                    {successMsg && (
                        <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#15803d', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                            ✓ {successMsg}
                        </div>
                    )}
                    {error && (
                        <div className="error-msg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <span style={{ marginRight: '8px' }}>⚠️</span> {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary full-width mt-4"
                        style={{ justifyContent: 'center', padding: '12px', fontSize: '15px' }}
                        disabled={loading}
                    >
                        {loading ? 'Anmelden...' : 'Anmelden →'}
                    </button>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                        <button
                            type="button"
                            onClick={() => setShowReset(true)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', padding: 0 }}
                        >
                            Passwort vergessen?
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push('/registrieren')}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', padding: 0 }}
                        >
                            Registrieren
                        </button>
                    </div>
                </form>
                )}

            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    );
}
