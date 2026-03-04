'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string;
}

const VARIABLES = ['{{name}}', '{{url}}'];

export default function EmailTemplateEditClient({ template }: { template: EmailTemplate }) {
    const router = useRouter();
    const [name, setName] = useState(template.name);
    const [subject, setSubject] = useState(template.subject);
    const [body, setBody] = useState(template.body);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaved(false);
        setLoading(true);
        try {
            const res = await fetch(`/api/email-templates/${template.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, subject, body }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch {
            setError('Server-Fehler');
        } finally {
            setLoading(false);
        }
    };

    const previewHtml = body
        .replaceAll('{{name}}', 'Max Mustermann')
        .replaceAll('{{url}}', '#');

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Verfügbare Platzhalter:
                </div>
                {VARIABLES.map(v => (
                    <code key={v} style={{ fontSize: '12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 8px', color: 'var(--navy)', fontFamily: 'monospace' }}>
                        {v}
                    </code>
                ))}
            </div>

            <div className="card" style={{ padding: '24px', marginBottom: '16px' }}>
                <div className="form-group">
                    <label className="form-label">Name</label>
                    <input
                        className="form-input"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Betreff</label>
                    <input
                        className="form-input"
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        required
                    />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label className="form-label" style={{ marginBottom: 0 }}>Inhalt (HTML)</label>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setShowPreview(!showPreview)}
                        >
                            {showPreview ? 'Vorschau schließen' : 'Vorschau anzeigen'}
                        </button>
                    </div>
                    <textarea
                        className="form-input"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        required
                        rows={12}
                        style={{ fontFamily: 'monospace', fontSize: '13px', resize: 'vertical' }}
                    />
                </div>
            </div>

            {showPreview && (
                <div className="card" style={{ padding: '24px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>
                        VORSCHAU
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Betreff: <strong style={{ color: 'var(--text)' }}>{subject.replaceAll('{{name}}', 'Max Mustermann')}</strong>
                    </div>
                    <div
                        style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', background: '#fff', fontSize: '14px', lineHeight: 1.6 }}
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                </div>
            )}

            {error && <div className="error-msg">⚠️ {error}</div>}
            {saved && (
                <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#15803d', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                    ✓ Template gespeichert
                </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
                    Zurück
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Speichern...' : 'Änderungen speichern'}
                </button>
            </div>
        </form>
    );
}
