'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

export default function PasswordResetPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const router = useRouter();

    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'expired' | 'done'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [password, setPassword] = useState('');
    const [password2, setPassword2] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [orgData, setOrgData] = useState<{ name: string; logo_url: string | null } | null>(null);

    useEffect(() => {
        fetch('/api/org/public').then(r => r.json()).then(setOrgData);
    }, []);

    useEffect(() => {
        fetch(`/api/password-reset/${token}`)
            .then(async (res) => {
                const data = await res.json();
                if (!data.valid) {
                    if (res.status === 410) {
                        setErrorMsg(data.error);
                        setStatus('expired');
                    } else {
                        setStatus('invalid');
                    }
                } else {
                    setStatus('valid');
                }
            })
            .catch(() => setStatus('invalid'));
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== password2) {
            setError('Die Passwörter stimmen nicht überein.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const res = await fetch(`/api/password-reset/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setStatus('done');
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

                {status === 'loading' && (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>Link wird geprüft...</p>
                )}

                {status === 'invalid' && (
                    <>
                        <p style={{ textAlign: 'center', color: '#ef4444', fontSize: '14px', marginBottom: '16px' }}>
                            Dieser Link ist ungültig oder wurde bereits verwendet.
                        </p>
                        <button className="btn btn-primary full-width" style={{ justifyContent: 'center' }} onClick={() => router.push('/login')}>
                            Zurück zum Login
                        </button>
                    </>
                )}

                {status === 'expired' && (
                    <>
                        <p style={{ textAlign: 'center', color: '#ef4444', fontSize: '14px', marginBottom: '16px' }}>
                            {errorMsg}
                        </p>
                        <button className="btn btn-primary full-width" style={{ justifyContent: 'center' }} onClick={() => router.push('/login')}>
                            Neuen Link anfordern
                        </button>
                    </>
                )}

                {status === 'valid' && (
                    <form onSubmit={handleSubmit}>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                            Bitte gib dein neues Passwort ein.
                        </p>
                        <div className="form-group">
                            <label className="form-label">Neues Passwort</label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder="Mindestens 6 Zeichen"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                minLength={6}
                                required
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Passwort wiederholen</label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder="••••••••"
                                value={password2}
                                onChange={(e) => setPassword2(e.target.value)}
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
                            {loading ? 'Speichern...' : 'Passwort speichern →'}
                        </button>
                    </form>
                )}

                {status === 'done' && (
                    <>
                        <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#15803d', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                            ✓ Passwort erfolgreich gespeichert.
                        </div>
                        <button className="btn btn-primary full-width" style={{ justifyContent: 'center' }} onClick={() => router.push('/login')}>
                            Zum Login
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
