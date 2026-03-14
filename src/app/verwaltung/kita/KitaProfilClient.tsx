'use client';

import { useState, useRef, useEffect } from 'react';
import type { Organization } from '@/lib/data';

interface Props {
    org: Organization;
}

export default function KitaProfilClient({ org }: Props) {
    const [form, setForm] = useState({
        name: org.name ?? '',
        legal_form: org.legal_form ?? '',
        contact_person: org.contact_person ?? '',
        phone: org.phone ?? '',
        website: org.website ?? '',
        address_street: org.address_street ?? '',
        address_zip: org.address_zip ?? '',
        address_city: org.address_city ?? '',
        iban: org.iban ?? '',
        bic: org.bic ?? '',
        bank_name: org.bank_name ?? '',
        from_email: org.from_email ?? '',
        tax_number: org.tax_number ?? '',
    });

    const [logoUrl, setLogoUrl] = useState<string | null>(org.logo_url ?? null);
    const [logoStatus, setLogoStatus] = useState('');
    const [saveStatus, setSaveStatus] = useState('');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    }

    async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            setLogoStatus('Datei ist zu groß (max. 2 MB).');
            return;
        }
        setLogoStatus('Wird hochgeladen…');
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/org/logo', { method: 'POST', body: fd });
            if (!res.ok) {
                const data = await res.json();
                setLogoStatus('Fehler: ' + (data.error ?? 'Unbekannt'));
            } else {
                const data = await res.json();
                setLogoUrl(data.logo_url);
                setLogoStatus('Logo erfolgreich gespeichert.');
            }
        } catch {
            setLogoStatus('Upload fehlgeschlagen.');
        } finally {
            setUploading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setSaveStatus('');
        try {
            const res = await fetch('/api/org', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) {
                const data = await res.json();
                setSaveStatus('Fehler: ' + (data.error ?? 'Unbekannt'));
            } else {
                setSaveStatus('Gespeichert.');
            }
        } catch {
            setSaveStatus('Speichern fehlgeschlagen.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Logo */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Logo</h2>
                </div>
                <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                    <div style={{ width: 80, height: 80, borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {logoUrl ? (
                            <img src={logoUrl} alt="Kita Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                            <span style={{ fontSize: '32px', opacity: 0.3 }}>?</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleLogoChange}
                            disabled={uploading}
                            style={{ fontSize: '14px' }}
                        />
                        {logoStatus && (
                            <span style={{ fontSize: '13px', color: logoStatus.startsWith('Fehler') ? 'var(--danger)' : 'var(--success, #16a34a)' }}>
                                {logoStatus}
                            </span>
                        )}
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Max. 2 MB, PNG oder JPEG empfohlen</span>
                    </div>
                </div>
            </div>

            {/* Allgemeines */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Allgemeines</h2>
                </div>
                <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    <div className="form-group">
                        <label className="form-label">Name der Kita</label>
                        <input className="form-input" type="text" name="name" value={form.name} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Rechtsform</label>
                        <input className="form-input" type="text" name="legal_form" value={form.legal_form} onChange={handleChange} placeholder="z.B. e.V., gGmbH" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Ansprechperson</label>
                        <input className="form-input" type="text" name="contact_person" value={form.contact_person} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Telefon</label>
                        <input className="form-input" type="text" name="phone" value={form.phone} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Website</label>
                        <input className="form-input" type="text" name="website" value={form.website} onChange={handleChange} placeholder="https://…" />
                    </div>
                </div>
            </div>

            {/* Adresse */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Adresse</h2>
                </div>
                <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Straße und Hausnummer</label>
                        <input className="form-input" type="text" name="address_street" value={form.address_street} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">PLZ</label>
                        <input className="form-input" type="text" name="address_zip" value={form.address_zip} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Ort</label>
                        <input className="form-input" type="text" name="address_city" value={form.address_city} onChange={handleChange} />
                    </div>
                </div>
            </div>

            {/* Bankdaten */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Bankdaten</h2>
                </div>
                <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    <div className="form-group">
                        <label className="form-label">IBAN</label>
                        <input className="form-input" type="text" name="iban" value={form.iban} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">BIC</label>
                        <input className="form-input" type="text" name="bic" value={form.bic} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Kreditinstitut</label>
                        <input className="form-input" type="text" name="bank_name" value={form.bank_name} onChange={handleChange} />
                    </div>
                </div>
            </div>

            {/* E-Mail & Steuer */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">E-Mail &amp; Steuer</h2>
                </div>
                <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    <div className="form-group">
                        <label className="form-label">Absenderadresse (E-Mail)</label>
                        <input className="form-input" type="email" name="from_email" value={form.from_email} onChange={handleChange} placeholder="noreply@beispiel.de" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Steuernummer</label>
                        <input className="form-input" type="text" name="tax_number" value={form.tax_number} onChange={handleChange} />
                    </div>
                </div>
            </div>

            {/* Save */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Wird gespeichert…' : 'Speichern'}
                </button>
                {saveStatus && (
                    <span style={{ fontSize: '14px', color: saveStatus.startsWith('Fehler') ? 'var(--danger)' : 'var(--success, #16a34a)' }}>
                        {saveStatus}
                    </span>
                )}
            </div>

        </form>
    );
}
