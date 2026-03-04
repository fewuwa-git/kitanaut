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

    useEffect(() => {
        if (searchParams.get('invited') === '1') {
            setSuccessMsg('Account aktiviert! Du kannst dich jetzt einloggen.');
        }
    }, [searchParams]);

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
            } else if (data.user?.role === 'eltern') {
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
                    <img src="/logo.png" alt="Pankonauten Logo" className="login-logo-icon" />
                    <div className="login-logo-text">
                        <h2>Pankonauten</h2>
                        <p>Finanzen</p>
                    </div>
                </div>

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
                </form>

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
