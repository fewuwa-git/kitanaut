'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SLUG_REGEX = /^[a-z0-9-]+$/;

export default function NeueKitaPage() {
    const router = useRouter();

    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [fromEmail, setFromEmail] = useState('');
    const [adminName, setAdminName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');

    const [slugError, setSlugError] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<{ inviteUrl: string; orgName: string } | null>(null);

    function handleSlugChange(value: string) {
        setSlug(value);
        if (value && !SLUG_REGEX.test(value)) {
            setSlugError('Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt');
        } else {
            setSlugError('');
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        if (!SLUG_REGEX.test(slug)) {
            setSlugError('Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/admin/kitas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, slug, fromEmail, adminName, adminEmail }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Fehler beim Anlegen der Kita');
                return;
            }
            setSuccess({ inviteUrl: data.inviteUrl, orgName: name });
        } catch {
            setError('Verbindungsfehler. Bitte versuche es erneut.');
        } finally {
            setLoading(false);
        }
    }

    if (success) {
        return (
            <div style={{ padding: '2rem', maxWidth: '640px', margin: '0 auto' }}>
                <div className="card" style={{ padding: '2rem' }}>
                    <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#15803d', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontSize: '14px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                        <strong>Kita &ldquo;{success.orgName}&rdquo; wurde erfolgreich angelegt!</strong>
                        <p style={{ marginTop: '8px', marginBottom: 0 }}>Eine Einladungs-E-Mail wurde versandt.</p>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Einladungslink für ersten Admin</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                                type="text"
                                className="form-input"
                                value={success.inviteUrl}
                                readOnly
                                style={{ fontFamily: 'monospace', fontSize: '12px' }}
                            />
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => navigator.clipboard.writeText(success.inviteUrl)}
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                Kopieren
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                        <a href="/admin/dashboard" className="btn btn-primary">
                            Zurück zum Dashboard
                        </a>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                                setSuccess(null);
                                setName('');
                                setSlug('');
                                setFromEmail('');
                                setAdminName('');
                                setAdminEmail('');
                            }}
                        >
                            Weitere Kita anlegen
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '640px', margin: '0 auto' }}>
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <h1 style={{ margin: 0 }}>Neue Kita anlegen</h1>
            </div>

            <div className="card" style={{ padding: '2rem' }}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Kita-Name</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="z.B. Sonnenkäfer e.V."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Subdomain / Slug</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="z.B. sonnenkafer"
                            value={slug}
                            onChange={(e) => handleSlugChange(e.target.value)}
                            required
                        />
                        {slugError && (
                            <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '4px' }}>{slugError}</p>
                        )}
                        {slug && !slugError && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                                Vorschau: <strong>{slug}.kitanaut.de</strong>
                            </p>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">E-Mail-Absender</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="kitaname@kitanaut.de"
                            value={fromEmail}
                            onChange={(e) => setFromEmail(e.target.value)}
                            required
                        />
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '24px 0' }} />

                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', marginTop: 0 }}>
                        Erster Admin – erhält eine Einladungs-E-Mail
                    </p>

                    <div className="form-group">
                        <label className="form-label">Admin-Name</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Vorname Nachname"
                            value={adminName}
                            onChange={(e) => setAdminName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Admin-E-Mail</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="admin@beispiel.de"
                            value={adminEmail}
                            onChange={(e) => setAdminEmail(e.target.value)}
                            required
                        />
                    </div>

                    {error && (
                        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <span style={{ marginRight: '8px' }}>⚠</span> {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading || !!slugError}
                        >
                            {loading ? 'Anlegen...' : 'Kita anlegen →'}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => router.push('/admin/dashboard')}
                        >
                            Abbrechen
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
