'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPasswortPage() {
    const router = useRouter();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (newPassword !== confirm) {
            setError('Passwörter stimmen nicht überein');
            return;
        }
        if (newPassword.length < 8) {
            setError('Neues Passwort muss mindestens 8 Zeichen haben');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/admin-auth', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Fehler'); return; }
            setSuccess(true);
        } catch {
            setError('Verbindungsfehler');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '480px', margin: '0 auto' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <a href="/admin/dashboard" className="btn btn-secondary" style={{ fontSize: '13px' }}>
                    ← Zurück
                </a>
            </div>
            <div className="card" style={{ padding: '2rem' }}>
                <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Passwort ändern</h2>
                {success ? (
                    <div style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#15803d', padding: '12px', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.2)', marginBottom: '16px', fontSize: '14px' }}>
                        ✓ Passwort erfolgreich geändert.
                        <button className="btn btn-secondary" style={{ display: 'block', marginTop: '12px' }} onClick={() => router.push('/admin/dashboard')}>
                            Zum Dashboard
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        {error && (
                            <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#dc2626', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '16px', fontSize: '14px' }}>
                                {error}
                            </div>
                        )}
                        <div className="form-group">
                            <label className="form-label">Aktuelles Passwort</label>
                            <input type="password" className="form-input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required autoFocus />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Neues Passwort</label>
                            <input type="password" className="form-input" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Neues Passwort bestätigen</label>
                            <input type="password" className="form-input" value={confirm} onChange={e => setConfirm(e.target.value)} required />
                        </div>
                        <button type="submit" className="btn btn-primary full-width" style={{ justifyContent: 'center', marginTop: '8px' }} disabled={loading}>
                            {loading ? 'Speichern...' : 'Passwort ändern'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
