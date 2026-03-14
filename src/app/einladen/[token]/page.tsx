'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

export default function EinladenPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const router = useRouter();

    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'expired' | 'done'>('loading');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [orgData, setOrgData] = useState<{ name: string; logo_url: string | null } | null>(null);

    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetch('/api/org/public').then(r => r.json()).then(setOrgData);
    }, []);

    useEffect(() => {
        fetch(`/api/invite/${token}`)
            .then(async (res) => {
                const data = await res.json();
                if (data.valid) {
                    setName(data.name);
                    setEmail(data.email);
                    setStatus('valid');
                } else {
                    setErrorMsg(data.error || 'Ungültiger Link');
                    setStatus(res.status === 410 ? 'expired' : 'invalid');
                }
            })
            .catch(() => {
                setErrorMsg('Verbindungsfehler');
                setStatus('invalid');
            });
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        if (password.length < 6) {
            setFormError('Das Passwort muss mindestens 6 Zeichen haben.');
            return;
        }
        if (password !== passwordConfirm) {
            setFormError('Die Passwörter stimmen nicht überein.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`/api/invite/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setFormError(data.error || 'Fehler beim Speichern');
                return;
            }
            setStatus('done');
            setTimeout(() => router.push('/login?invited=1'), 2000);
        } catch {
            setFormError('Server-Fehler');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg, #f5f7fa)',
            padding: '24px',
        }}>
            <div style={{
                background: '#fff',
                borderRadius: '12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                padding: '40px',
                width: '100%',
                maxWidth: '420px',
            }}>
                <div style={{ marginBottom: '28px', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚣</div>
                    <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--navy, #1a3a5c)', margin: 0 }}>
                        {orgData?.name || 'Kitanaut'}-Finanzportal
                    </h1>
                </div>

                {status === 'loading' && (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted, #666)' }}>Einladung wird geprüft…</p>
                )}

                {(status === 'invalid' || status === 'expired') && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '40px', marginBottom: '12px' }}>{status === 'expired' ? '⏰' : '❌'}</div>
                        <h2 style={{ color: 'var(--navy, #1a3a5c)', marginBottom: '8px' }}>
                            {status === 'expired' ? 'Link abgelaufen' : 'Ungültiger Link'}
                        </h2>
                        <p style={{ color: 'var(--text-muted, #666)', fontSize: '14px' }}>{errorMsg}</p>
                        <p style={{ color: 'var(--text-muted, #666)', fontSize: '13px', marginTop: '12px' }}>
                            Bitte wende dich an den Administrator.
                        </p>
                    </div>
                )}

                {status === 'done' && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
                        <h2 style={{ color: 'var(--navy, #1a3a5c)', marginBottom: '8px' }}>Account aktiviert!</h2>
                        <p style={{ color: 'var(--text-muted, #666)', fontSize: '14px' }}>
                            Du wirst gleich zur Anmeldeseite weitergeleitet…
                        </p>
                    </div>
                )}

                {status === 'valid' && (
                    <>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--navy, #1a3a5c)', marginBottom: '6px' }}>
                            Willkommen, {name}!
                        </h2>
                        <p style={{ color: 'var(--text-muted, #666)', fontSize: '14px', marginBottom: '24px' }}>
                            Wähle ein Passwort für <strong>{email}</strong>, um deinen Account zu aktivieren.
                        </p>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Passwort</label>
                                <input
                                    className="form-input"
                                    type="password"
                                    placeholder="Mindestens 6 Zeichen"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Passwort bestätigen</label>
                                <input
                                    className="form-input"
                                    type="password"
                                    placeholder="Passwort wiederholen"
                                    value={passwordConfirm}
                                    onChange={(e) => setPasswordConfirm(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>
                            {formError && (
                                <div className="error-msg">⚠️ {formError}</div>
                            )}
                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{ width: '100%', marginTop: '8px' }}
                                disabled={submitting}
                            >
                                {submitting ? 'Wird aktiviert…' : 'Account aktivieren'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
