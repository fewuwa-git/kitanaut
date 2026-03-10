'use client';

import { useState, useEffect, useMemo } from 'react';
import { generateAbrechnungPDF } from '@/lib/pdf';
import ConfirmModal from '@/components/ConfirmModal';
import { fmtDate } from '@/lib/formatDate';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    strasse?: string;
    ort?: string;
    iban?: string;
    steuerid?: string;
    stundensatz?: number;
}

interface AbrechnungTag {
    id?: string;
    datum: string;
    von: string;
    bis: string;
    stunden: number;
    stundensatz: number;
    betrag: number;
}

interface Abrechnung {
    id: string;
    status: string;
}

interface MonthOption {
    jahr: number;
    monat: number;
    label: string;
    value: string; // "jahr-monat"
}

const HOURS = ['07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19'];
const MINUTES = ['00', '15', '30', '45'];

const STATUS_LABELS: Record<string, string> = {
    entwurf: 'Entwurf',
    eingereicht: 'Eingereicht',
    bezahlt: 'Bezahlt',
};

const STATUS_BADGE: Record<string, string> = {
    entwurf: 'badge-warning',
    eingereicht: 'badge-info',
    bezahlt: 'badge-success',
};

export default function AbrechnungForm({
    user,
    initialMonth,
    initialYear,
    allSpringerinnen,
    initialSpringer
}: {
    user: User,
    initialMonth?: number,
    initialYear?: number,
    allSpringerinnen?: User[],
    initialSpringer?: User
}) {
    const [selectedSpringer, setSelectedSpringer] = useState<User>(initialSpringer || user);
    const stundensatz = selectedSpringer.stundensatz || 0;

    const availableMonths = useMemo(() => {
        const months: MonthOption[] = [];
        const date = new Date();
        const limit = (user.role === 'admin' || user.role === 'finanzvorstand') ? 24 : 3;

        for (let i = 0; i < limit; i++) {
            const jahr = date.getFullYear();
            const monat = date.getMonth() + 1;
            months.push({
                jahr,
                monat,
                label: date.toLocaleString('de-DE', { month: 'long', year: 'numeric' }),
                value: `${jahr}-${monat}`
            });
            date.setMonth(date.getMonth() - 1);
        }
        return months;
    }, [user.role]);

    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        if (initialYear && initialMonth) {
            return `${initialYear}-${initialMonth}`;
        }
        return '';
    });
    const [tage, setTage] = useState<AbrechnungTag[]>([]);
    const [abrechnung, setAbrechnung] = useState<Abrechnung | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [deleteTagId, setDeleteTagId] = useState<string | null>(null);
    const [recalculating, setRecalculating] = useState(false);
    const [error, setError] = useState('');
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    const defaultDatumForMonth = (month: string) => {
        if (!month) return '';
        const [jahr, monat] = month.split('-').map(Number);
        const today = new Date();
        if (today.getFullYear() === jahr && today.getMonth() + 1 === monat) {
            const d = String(today.getDate()).padStart(2, '0');
            const m = String(monat).padStart(2, '0');
            return `${jahr}-${m}-${d}`;
        }
        return `${jahr}-${String(monat).padStart(2, '0')}-01`;
    };

    // Form states
    const [datum, setDatum] = useState(() => defaultDatumForMonth(selectedMonth));
    const [von, setVon] = useState('');
    const [bis, setBis] = useState('');

    const { minDate, maxDate } = useMemo(() => {
        if (!selectedMonth) return { minDate: '', maxDate: '' };
        const [jahr, monat] = selectedMonth.split('-').map(Number);
        const firstDay = new Date(jahr, monat - 1, 1);
        const lastDay = new Date(jahr, monat, 0);

        const formatDate = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        return {
            minDate: formatDate(firstDay),
            maxDate: formatDate(lastDay)
        };
    }, [selectedMonth]);

    // Fetch when month changes
    useEffect(() => {
        if (!selectedMonth) {
            setTage([]);
            setAbrechnung(null);
            return;
        }

        setDatum(defaultDatumForMonth(selectedMonth));
        const [jahrStr, monatStr] = selectedMonth.split('-');
        fetchData(selectedSpringer.id, parseInt(jahrStr), parseInt(monatStr));
    }, [selectedMonth, selectedSpringer.id]);

    const fetchData = async (userId: string, jahr: number, monat: number) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/abrechnungen?jahr=${jahr}&monat=${monat}&userId=${userId}`);
            if (!res.ok) throw new Error('Fehler beim Laden der Abrechnung');
            const data = await res.json();
            setTage(data.tage || []);
            setAbrechnung(data.abrechnung || null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const calculateHours = (start: string, end: string) => {
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        if (isNaN(startH) || isNaN(endH)) return 0;

        let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        if (diffMinutes < 0) diffMinutes += 24 * 60; // falls über Mitternacht

        return Math.round((diffMinutes / 60) * 100) / 100; // 2 decimals
    };

    const isLocked = abrechnung?.status === 'eingereicht' || abrechnung?.status === 'bezahlt';

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!selectedMonth || !datum || !von || !bis) {
            setError('Bitte alle Felder ausfüllen.');
            return;
        }

        // Validate date is within selected month
        const [selJahr, selMonat] = selectedMonth.split('-').map(Number);
        const inputDate = new Date(datum);
        if (inputDate.getFullYear() !== selJahr || inputDate.getMonth() + 1 !== selMonat) {
            setError(`Das Datum muss im ausgewählten Monat (${availableMonths.find(m => m.value === selectedMonth)?.label}) liegen.`);
            return;
        }

        // Validate unique date
        if (tage.some(t => t.datum === datum)) {
            setError('Für diesen Tag existiert bereits ein Eintrag.');
            return;
        }

        const stunden = calculateHours(von, bis);
        if (stunden <= 0) {
            setError('Die "Bis" Zeit muss nach der "Von" Zeit liegen.');
            return;
        }

        // Validate time range 07:00 - 19:00
        const isTimeInRange = (time: string) => {
            const [h, m] = time.split(':').map(Number);
            const totalMinutes = h * 60 + m;
            return totalMinutes >= 7 * 60 && totalMinutes <= 19 * 60;
        };

        if (!isTimeInRange(von) || !isTimeInRange(bis)) {
            setError('Die Zeit muss zwischen 07:00 und 19:00 Uhr liegen.');
            return;
        }

        const betrag = Math.round((stunden * stundensatz) * 100) / 100;

        const newTag: AbrechnungTag = {
            datum, von, bis, stunden, stundensatz, betrag
        };

        setSaving(true);
        try {
            const res = await fetch('/api/abrechnungen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save_tag',
                    jahr: selJahr,
                    monat: selMonat,
                    tag: newTag,
                    userId: selectedSpringer.id
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Fehler beim Speichern');
            }

            const data = await res.json();
            setTage([...tage, data.tag].sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime()));
            if (data.abrechnung) setAbrechnung(data.abrechnung);

            // Reset form fields
            setDatum(defaultDatumForMonth(selectedMonth));
            setVon('');
            setBis('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (tagId: string) => {
        setError('');
        try {
            const res = await fetch(`/api/abrechnungen?tagId=${tagId}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Fehler beim Löschen');
            }
            setTage(tage.filter(t => t.id !== tagId));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setDeleteTagId(null);
        }
    };

    const handleSubmit = async () => {
        if (!abrechnung?.id) return;
        setSubmitting(true);
        setError('');
        try {
            const res = await fetch('/api/abrechnungen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_status',
                    id: abrechnung.id,
                    status: 'eingereicht',
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Fehler beim Einreichen');
            }

            const data = await res.json();
            setAbrechnung(data.abrechnung);
            setShowSubmitModal(false);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRecalculate = async () => {
        if (!selectedMonth || !selectedSpringer.id) return;
        const [selJahr, selMonat] = selectedMonth.split('-').map(Number);

        setRecalculating(true);
        setError('');
        try {
            const res = await fetch('/api/abrechnungen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'recalculate_rates',
                    jahr: selJahr,
                    monat: selMonat,
                    userId: selectedSpringer.id
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Fehler beim Aktualisieren der Stundensätze');
            }

            const data = await res.json();
            setTage(data.tage || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setRecalculating(false);
        }
    };

    const rateDiscrepancy = useMemo(() => {
        if (tage.length === 0 || !stundensatz) return false;
        return tage.some(t => t.stundensatz !== stundensatz);
    }, [tage, stundensatz]);

    const totalStunden = tage.reduce((sum, tag) => sum + tag.stunden, 0);
    const totalBetrag = tage.reduce((sum, tag) => sum + tag.betrag, 0);

    const generatePDF = async () => {
        setGenerating(true);
        setError('');
        try {
            const monthLabel = availableMonths.find(m => m.value === selectedMonth)?.label || '';
            const url = await generateAbrechnungPDF(selectedSpringer, monthLabel, tage, totalStunden, totalBetrag);
            setPdfUrl(url);
        } catch (err: any) {
            console.error('PDF Generation Error:', err);
            setError('Fehler bei der PDF-Erstellung: ' + err.message);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="abrechnung-form">
            {allSpringerinnen && allSpringerinnen.length > 0 && !selectedMonth && (
                <div className="form-group" style={{ marginBottom: '2rem', padding: '1.5rem', background: 'var(--card-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <label className="form-label" style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>👩‍💼</span> Springer*in auswählen
                    </label>
                    <select
                        className="form-select"
                        value={selectedSpringer.id}
                        onChange={e => {
                            const selected = allSpringerinnen.find(s => s.id === e.target.value);
                            if (selected) {
                                setSelectedSpringer(selected);
                                setPdfUrl(null);
                                setError('');
                            }
                        }}
                        style={{ maxWidth: '400px', fontSize: '16px' }}
                    >
                        {allSpringerinnen.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                        ))}
                    </select>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                        Sollte eine Person fehlen, stelle bitte sicher, dass ihr im Profil die Rolle "springerin" zugewiesen wurde.
                    </p>
                </div>
            )}

            {stundensatz === 0 && (
                <div className="alert alert-warning" style={{
                    marginBottom: '1.5rem',
                    padding: '12px 16px',
                    backgroundColor: 'var(--orange-bg)',
                    color: 'var(--orange)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--orange)',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <span>⚠️</span>
                    <div>
                        <strong>Achtung:</strong> In deinem Profil ist kein Stundensatz hinterlegt. Die Beträge werden mit 0 € berechnet.
                    </div>
                </div>
            )}

            {rateDiscrepancy && (!isLocked || user.role === 'admin') && (
                <div className="alert alert-info" style={{
                    marginBottom: '1.5rem',
                    padding: '16px',
                    backgroundColor: 'rgba(0, 102, 204, 0.05)',
                    color: 'var(--navy)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(0, 102, 204, 0.2)',
                    fontSize: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>ℹ️</span>
                        <div>
                            <strong>Abweichende Stundensätze erkannt:</strong> Einige Einträge in dieser Abrechnung nutzen noch einen alten oder keinen Stundensatz. Aktueller Satz im Profil: <strong>{stundensatz.toFixed(2)} €/h</strong>.
                        </div>
                    </div>
                    <div>
                        <button
                            onClick={handleRecalculate}
                            className="btn btn-sm btn-primary"
                            disabled={recalculating}
                            style={{ padding: '6px 12px' }}
                        >
                            {recalculating ? 'Aktualisiere...' : 'Alle Einträge auf aktuellen Stundensatz anpassen'}
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className="alert alert-danger" style={{
                    marginBottom: '1.5rem',
                    padding: '12px 16px',
                    backgroundColor: 'var(--red-bg)',
                    color: 'var(--red)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--red)',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <span>❌</span>
                    {error}
                </div>
            )}

            {!selectedMonth && (
                <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                    <label className="form-label">Abrechnungsmonat auswählen</label>
                    <select
                        className="form-select"
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        style={{ maxWidth: '320px' }}
                    >
                        <option value="">-- Bitte wählen --</option>
                        {availableMonths.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        ℹ️ {user.role === 'admin'
                            ? 'Als Admin kannst du Abrechnungen für die letzten 24 Monate erstellen.'
                            : 'Du kannst nur die Abrechnung des aktuellen und die letzten 2 Monate erstellen.'}
                    </p>
                </div>
            )}

            {selectedMonth && (
                <>
                    <div className="stats-grid" style={{ marginBottom: '2.5rem' }}>
                        <div className="stat-card">
                            <div className="stat-card-label">
                                <span>👩‍💼</span> Ausgewählte Springer*in
                            </div>
                            <div className="stat-card-value" style={{ fontSize: '18px' }}>
                                {selectedSpringer.name}
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                                    {selectedSpringer.email}
                                </div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-label">
                                <span>📅</span> Ausgewählter Monat
                            </div>
                            <div className="stat-card-value" style={{ fontSize: '20px' }}>
                                {availableMonths.find(m => m.value === selectedMonth)?.label}
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-label">
                                <span>⏱️</span> Gesamtstunden
                            </div>
                            <div className="stat-card-value">
                                {totalStunden.toFixed(2)} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>h</span>
                            </div>
                        </div>
                        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                            <div className="stat-card-label">
                                <span>💰</span> Gesamtbetrag
                            </div>
                            <div className="stat-card-value" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                {totalBetrag.toLocaleString('de-DE', { minimumFractionDigits: 2 })} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>€</span>
                                {abrechnung && (
                                    <span className={`badge ${STATUS_BADGE[abrechnung.status] || 'badge-warning'}`} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600 }}>
                                        {STATUS_LABELS[abrechnung.status] || abrechnung.status}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {isLocked && (
                        <div style={{
                            marginBottom: '1.5rem',
                            padding: '14px 16px',
                            backgroundColor: abrechnung?.status === 'bezahlt' ? 'var(--green-bg)' : 'var(--blue-bg)',
                            color: abrechnung?.status === 'bezahlt' ? '#16a34a' : 'var(--blue)',
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${abrechnung?.status === 'bezahlt' ? '#bbf7d0' : '#bfdbfe'}`,
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            <span>{abrechnung?.status === 'bezahlt' ? '✅' : '🔒'}</span>
                            <div>
                                {abrechnung?.status === 'bezahlt'
                                    ? 'Diese Abrechnung wurde bezahlt.'
                                    : 'Diese Abrechnung wurde eingereicht und kann nicht mehr bearbeitet werden.'}
                            </div>
                        </div>
                    )}

                    {!isLocked && (
                        <div className="card" style={{ marginBottom: '2.5rem', background: 'var(--bg)', borderStyle: 'dashed' }}>
                            <div className="card-header">
                                <h2 className="card-title">➕ Neuen Tag erfassen</h2>
                            </div>
                            <div className="card-body">
                                <form onSubmit={handleAdd} className="add-tag-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Datum</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={datum}
                                            onChange={e => setDatum(e.target.value)}
                                            min={minDate}
                                            max={maxDate}
                                            required
                                        />
                                    </div>
                                    <div className="time-inputs">
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Von</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <select
                                                    className="form-select"
                                                    value={von.split(':')[0] || ''}
                                                    onChange={e => setVon(`${e.target.value}:${von.split(':')[1] || '00'}`)}
                                                    required
                                                    style={{ padding: '10px 8px' }}
                                                >
                                                    <option value="">Std</option>
                                                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                                <span style={{ fontWeight: 'bold' }}>:</span>
                                                <select
                                                    className="form-select"
                                                    value={von.split(':')[1] || ''}
                                                    onChange={e => setVon(`${von.split(':')[0] || '07'}:${e.target.value}`)}
                                                    required
                                                    style={{ padding: '10px 8px' }}
                                                >
                                                    <option value="">Min</option>
                                                    {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Bis</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <select
                                                    className="form-select"
                                                    value={bis.split(':')[0] || ''}
                                                    onChange={e => setBis(`${e.target.value}:${bis.split(':')[1] || '00'}`)}
                                                    required
                                                    style={{ padding: '10px 8px' }}
                                                >
                                                    <option value="">Std</option>
                                                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                                <span style={{ fontWeight: 'bold' }}>:</span>
                                                <select
                                                    className="form-select"
                                                    value={bis.split(':')[1] || ''}
                                                    onChange={e => setBis(`${bis.split(':')[0] || '07'}:${e.target.value}`)}
                                                    required
                                                    style={{ padding: '10px 8px' }}
                                                >
                                                    <option value="">Min</option>
                                                    {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ minWidth: '160px' }}>
                                        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={saving}>
                                            {saving ? 'Speichere...' : 'Tag hinzufügen'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title">📋 Erfasste Zeiten</h2>
                            {loading && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Lade...</span>}
                        </div>
                        <div className="card-body" style={{ padding: 0, marginTop: '1.5rem' }}>
                            {/* Desktop table */}
                            <div className="table-responsive abrechnung-tage-table">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Datum</th>
                                            <th>Zeitraum</th>
                                            <th style={{ textAlign: 'right' }}>Dauer</th>
                                            <th>Stundensatz</th>
                                            <th style={{ textAlign: 'right' }}>Betrag</th>
                                            {!isLocked && <th style={{ width: '50px' }}></th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tage.length === 0 ? (
                                            <tr>
                                                <td colSpan={isLocked ? 5 : 6} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                                                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>☕</div>
                                                    Noch keine Einträge für diesen Monat vorhanden.
                                                </td>
                                            </tr>
                                        ) : (
                                            tage.map(tag => (
                                                <tr key={tag.id}>
                                                    <td>
                                                        <div style={{ fontWeight: '600' }}>{fmtDate(tag.datum)}</div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(tag.datum).toLocaleDateString('de-DE', { weekday: 'long' })}</div>
                                                    </td>
                                                    <td>
                                                        <span className="badge" style={{ background: 'var(--bg)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                                                            {tag.von.slice(0, 5)} – {tag.bis.slice(0, 5)}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontWeight: '500', textAlign: 'right' }}>{tag.stunden.toFixed(2)} h</td>
                                                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{tag.stundensatz.toFixed(2)} €/h</td>
                                                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--navy)' }}>
                                                        {tag.betrag.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                                                    </td>
                                                    {!isLocked && (
                                                        <td style={{ textAlign: 'right' }}>
                                                            <button
                                                                onClick={() => tag.id && setDeleteTagId(tag.id)}
                                                                className="btn-icon"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--red-bg)'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                                title="Löschen"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {tage.length > 0 && (
                                        <tfoot style={{ background: 'var(--card-hover)', borderTop: '2px solid var(--border)' }}>
                                            <tr style={{ fontWeight: '700' }}>
                                                <td colSpan={2} style={{ padding: '20px 16px' }}>SUMME</td>
                                                <td style={{ textAlign: 'right' }}>{totalStunden.toFixed(2)} h</td>
                                                <td></td>
                                                <td style={{ textAlign: 'right', fontSize: '16px', color: 'var(--navy)' }}>
                                                    {totalBetrag.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                                                </td>
                                                {!isLocked && <td></td>}
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>

                            {/* Mobile card list */}
                            <div className="abrechnung-tage-mobile">
                                {tage.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>☕</div>
                                        Noch keine Einträge für diesen Monat vorhanden.
                                    </div>
                                ) : (
                                    <>
                                        {tage.map(tag => (
                                            <div key={tag.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                                                        <span style={{ fontWeight: 600, fontSize: '14px' }}>
                                                            {fmtDate(tag.datum)}
                                                        </span>
                                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                            {new Date(tag.datum).toLocaleDateString('de-DE', { weekday: 'long' })}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                        {tag.von.slice(0, 5)} – {tag.bis.slice(0, 5)} · {tag.stunden.toFixed(2)} h · {tag.stundensatz.toFixed(2)} €/h
                                                    </div>
                                                    <div style={{ fontWeight: 700, color: 'var(--navy)', marginTop: '4px', fontSize: '15px' }}>
                                                        {tag.betrag.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                                                    </div>
                                                </div>
                                                {!isLocked && (
                                                    <button
                                                        onClick={() => tag.id && setDeleteTagId(tag.id)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontSize: '18px', flexShrink: 0 }}
                                                        title="Löschen"
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <div style={{ padding: '14px 16px', background: 'var(--bg)', borderTop: '2px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                                            <span>SUMME</span>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>{totalStunden.toFixed(2)} h</div>
                                                <div style={{ color: 'var(--navy)', fontSize: '16px' }}>{totalBetrag.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {user.role === 'springerin' && !isLocked && tage.length > 0 && (
                        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowSubmitModal(true)}
                                className="btn btn-success"
                                disabled={submitting}
                            >
                                ✅ Abrechnung einreichen
                            </button>
                        </div>
                    )}
                </>
            )}

            <ConfirmModal
                isOpen={showSubmitModal}
                title="Abrechnung einreichen"
                message="Möchtest du diese Abrechnung wirklich einreichen? Sie kann danach nicht mehr bearbeitet werden."
                confirmLabel="✅ Ja, einreichen"
                confirmClass="btn-success"
                isLoading={submitting}
                onConfirm={handleSubmit}
                onCancel={() => setShowSubmitModal(false)}
            />

            <ConfirmModal
                isOpen={deleteTagId !== null}
                title="Tag löschen"
                message="Soll dieser Eintrag wirklich gelöscht werden?"
                confirmLabel="Ja, löschen"
                confirmClass="btn-danger"
                onConfirm={() => deleteTagId && handleDelete(deleteTagId)}
                onCancel={() => setDeleteTagId(null)}
            />
        </div>
    );
}
