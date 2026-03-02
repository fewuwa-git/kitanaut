'use client';

import { useMemo, useState, useCallback } from 'react';
import { useFilterState, PeriodKey } from '@/hooks/useFilterState';
import { SpringerinNote } from '@/lib/data';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    Cell
} from 'recharts';

interface Abrechnung {
    id: string;
    user_id: string;
    jahr: number;
    monat: number;
    status: string;
    totalStunden: number;
    totalBetrag: number;
    pankonauten_users?: { name: string };
}

interface SpringerinDashboardProps {
    abrechnungen: Abrechnung[];
    initialNotes?: SpringerinNote[];
    currentUserName?: string;
}

const COLORS = [
    '#3b82f6', // blue
    '#fecb2f', // primary (yellow)
    '#22c55e', // green
    '#a855f7', // purple
    '#f97316', // orange
    '#ef4444', // red
    '#14b8a6', // teal
    '#6366f1'  // indigo
];

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
    }).format(amount);
}

function getMonthName(month: number): string {
    const months = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    return months[month - 1] || '';
}

export default function SpringerinDashboard({ abrechnungen, initialNotes = [], currentUserName = 'Unbekannt' }: SpringerinDashboardProps) {
    const { period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd } = useFilterState('6m');
    const [view, setView] = useState<'stunden' | 'kosten'>('stunden');
    const [notes, setNotes] = useState<SpringerinNote[]>(initialNotes);
    const [editingNote, setEditingNote] = useState<{ jahr: number, monat: number, content: string } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedSpringer, setSelectedSpringer] = useState<string>('');

    const getDateRange = useCallback((p: PeriodKey, startStr?: string, endStr?: string) => {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        if (p === '30d') {
            start.setDate(end.getDate() - 30);
        } else if (p === '6m') {
            start.setMonth(start.getMonth() - 6);
        } else if (p === '12m') {
            start.setFullYear(start.getFullYear() - 1);
        } else if (p === 'custom' && startStr && endStr) {
            return { start: new Date(startStr), end: new Date(endStr) };
        }
        return { start, end };
    }, []);

    const { start, end } = useMemo(() => getDateRange(period, customStart, customEnd), [period, customStart, customEnd, getDateRange]);

    const filteredData = useMemo(() => {
        // Filter abrechnungen by date range
        const filtered = abrechnungen.filter(ab => {
            const abDate = new Date(ab.jahr, ab.monat - 1, 1);
            // End of month
            const abEnd = new Date(ab.jahr, ab.monat, 0);
            return abEnd >= start && abDate <= end;
        });

        // Group by month
        const monthlyGroups = new Map<string, any>();
        const springers = new Set<string>();

        filtered.forEach(ab => {
            const monthKey = `${ab.jahr}-${String(ab.monat).padStart(2, '0')}`;
            const springerName = ab.pankonauten_users?.name || 'Unbekannt';
            springers.add(springerName);

            if (!monthlyGroups.has(monthKey)) {
                monthlyGroups.set(monthKey, {
                    key: monthKey,
                    label: `${getMonthName(ab.monat)} ${ab.jahr}`,
                    jahr: ab.jahr,
                    monat: ab.monat,
                    date: new Date(ab.jahr, ab.monat - 1, 1),
                    totalStunden: 0,
                    totalBetrag: 0,
                });
            }

            const data = monthlyGroups.get(monthKey);
            data[springerName] = (data[springerName] || 0) + (view === 'stunden' ? ab.totalStunden : ab.totalBetrag);
            data.totalStunden += ab.totalStunden;
            data.totalBetrag += ab.totalBetrag;
        });

        return {
            chartData: Array.from(monthlyGroups.values()).sort((a, b) => a.date.getTime() - b.date.getTime()),
            springerList: Array.from(springers).sort(),
            rawFiltered: filtered
        };
    }, [abrechnungen, start, end, view]);

    const handlePeriodChange = (p: PeriodKey) => {
        setPeriod(p);
        if (p !== 'custom') {
            setCustomStart('');
            setCustomEnd('');
        }
    };

    const handleSaveNote = async () => {
        if (!editingNote) return;
        setIsSaving(true);
        try {
            const response = await fetch('/api/springerin/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jahr: editingNote.jahr,
                    monat: editingNote.monat,
                    content: editingNote.content,
                    author_name: currentUserName
                })
            });

            if (response.ok) {
                const updatedNote = await response.json();
                setNotes(prev => {
                    const filtered = prev.filter(n => !(n.jahr === updatedNote.jahr && n.monat === updatedNote.monat));
                    return [...filtered, updatedNote];
                });
                setEditingNote(null);
            }
        } catch (error) {
            console.error('Error saving note:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const getNoteForMonth = (jahr: number, monat: number) => {
        return notes.find(n => n.jahr === jahr && n.monat === monat);
    };

    const springerSpecificData = useMemo(() => {
        if (!selectedSpringer) return [];

        return filteredData.rawFiltered
            .filter(ab => (ab.pankonauten_users?.name || 'Unbekannt') === selectedSpringer)
            .sort((a, b) => {
                const dateA = new Date(a.jahr, a.monat - 1).getTime();
                const dateB = new Date(b.jahr, b.monat - 1).getTime();
                return dateB - dateA;
            });
    }, [filteredData.rawFiltered, selectedSpringer]);

    return (
        <div>
            {/* Filter Card */}
            <div className="card mb-6">
                <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
                    <div className="card-title">📅 Filter & Ansicht</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                        {/* View Switcher */}
                        <div className="granularity-selector">
                            <button
                                className={`gran-btn ${view === 'stunden' ? 'active' : ''}`}
                                onClick={() => setView('stunden')}
                            >
                                Stunden
                            </button>
                            <button
                                className={`gran-btn ${view === 'kosten' ? 'active' : ''}`}
                                onClick={() => setView('kosten')}
                            >
                                Kosten
                            </button>
                        </div>

                        {/* Period Selector */}
                        <div className="period-selector">
                            {([['30d', '30 Tage'], ['6m', '6 Monate'], ['12m', '12 Monate'], ['custom', 'Freie Wahl']] as [PeriodKey, string][]).map(([key, label]) => (
                                <button
                                    key={key}
                                    className={`period-btn ${period === key ? 'active' : ''}`}
                                    onClick={() => handlePeriodChange(key)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {period === 'custom' && (
                    <div className="card-body" style={{ paddingTop: '16px', paddingBottom: '16px' }}>
                        <div className="date-range-inputs">
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                            />
                            <span style={{ color: 'var(--text-muted)' }}>bis</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Chart Card */}
            <div className="card mb-6">
                <div className="card-header">
                    <div className="card-title" style={{ fontSize: '15px', fontWeight: 600 }}>
                        {view === 'stunden' ? 'Springerstunden pro Monat' : 'Springerkosten pro Monat'}
                    </div>
                </div>

                <div className="card-body">
                    <div className="chart-container" style={{ height: 400 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={filteredData.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 12, fill: '#6b7280' }}
                                    tickLine={false}
                                    axisLine={{ stroke: '#e5e7eb' }}
                                />
                                <YAxis
                                    tick={{ fontSize: 12, fill: '#6b7280' }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => view === 'stunden' ? `${v}h` : `€${v}`}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f9fafb' }}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="chart-tooltip" style={{
                                                    background: 'white',
                                                    border: '1px solid var(--border)',
                                                    padding: '12px',
                                                    borderRadius: '8px',
                                                    boxShadow: 'var(--shadow-lg)'
                                                }}>
                                                    <p style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--navy)' }}>{label}</p>
                                                    {payload.map((p, i) => (
                                                        <p key={i} style={{ color: p.color, fontSize: '13px', margin: '4px 0', fontWeight: 500 }}>
                                                            {p.name}: {view === 'stunden' ? `${p.value}h` : formatCurrency(p.value as number)}
                                                        </p>
                                                    ))}
                                                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #eee', fontWeight: 700, color: 'var(--navy)' }}>
                                                        Gesamt: {view === 'stunden'
                                                            ? `${payload.reduce((sum, p) => sum + (p.value as number), 0)}h`
                                                            : formatCurrency(payload.reduce((sum, p) => sum + (p.value as number), 0))}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend
                                    wrapperStyle={{ paddingTop: '20px' }}
                                    iconType="circle"
                                    formatter={(value) => <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>{value}</span>}
                                />
                                {filteredData.springerList.map((springer, index) => (
                                    <Bar
                                        key={springer}
                                        dataKey={springer}
                                        stackId="a"
                                        fill={COLORS[index % COLORS.length]}
                                        radius={[0, 0, 0, 0]}
                                        barSize={view === 'stunden' ? 40 : 50}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Table Detail */}
            <div className="card mb-6">
                <div className="card-header">
                    <div className="card-title">📋 Details (Monatliche Summen)</div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ minWidth: '140px' }}>Monat / Jahr</th>
                                <th style={{ textAlign: 'right' }}>Gesamt-Stunden</th>
                                <th style={{ textAlign: 'right' }}>Gesamt-Kosten</th>
                                <th style={{ textAlign: 'center', width: '250px' }}>Monats-Notiz</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...filteredData.chartData].reverse().map(row => {
                                const monthNote = getNoteForMonth(row.jahr, row.monat);
                                return (
                                    <tr key={row.key}>
                                        <td style={{ fontWeight: 500 }}>{row.label}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 500 }}>
                                            {row.totalStunden}h
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                            {formatCurrency(row.totalBetrag)}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                {monthNote ? (
                                                    <div
                                                        onClick={() => setEditingNote({ jahr: row.jahr, monat: row.monat, content: monthNote.content })}
                                                        style={{
                                                            fontSize: '12px',
                                                            color: 'var(--text-muted)',
                                                            cursor: 'pointer',
                                                            maxWidth: '220px',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            background: '#f8f9fb',
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            border: '1px solid var(--border)'
                                                        }}
                                                        title={`${monthNote.content}\n- ${monthNote.author_name}`}
                                                    >
                                                        "{monthNote.content}"
                                                        <div style={{ fontSize: '10px', color: 'var(--text-light)', marginTop: '2px' }}>
                                                            von {monthNote.author_name}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => setEditingNote({ jahr: row.jahr, monat: row.monat, content: '' })}
                                                        style={{ padding: '2px 8px', fontSize: '11px' }}
                                                    >
                                                        + Notiz
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Springer Detail Section */}
            <div className="card">
                <div className="card-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="card-title">🏃 Details Springerin</div>
                    <div style={{ minWidth: '200px' }}>
                        <select
                            className="form-input"
                            style={{ padding: '6px 12px' }}
                            value={selectedSpringer}
                            onChange={(e) => setSelectedSpringer(e.target.value)}
                        >
                            <option value="">Springerin auswählen...</option>
                            {filteredData.springerList.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {selectedSpringer ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Monat / Jahr</th>
                                    <th style={{ textAlign: 'right' }}>Stunden</th>
                                    <th style={{ textAlign: 'right' }}>Kosten</th>
                                    <th style={{ textAlign: 'center' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {springerSpecificData.length > 0 ? (
                                    springerSpecificData.map(ab => (
                                        <tr key={ab.id}>
                                            <td style={{ fontWeight: 500 }}>{getMonthName(ab.monat)} {ab.jahr}</td>
                                            <td style={{ textAlign: 'right' }}>{ab.totalStunden}h</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(ab.totalBetrag)}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className={`badge badge-${ab.status === 'bezahlt' ? 'success' : ab.status === 'eingereicht' ? 'info' : 'warning'}`}>
                                                    {ab.status === 'bezahlt' ? 'Bezahlt' : ab.status === 'eingereicht' ? 'Eingereicht' : 'Entwurf'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                                            Keine Daten für diesen Zeitraum gefunden.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="card-body" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                        <p>Bitte wähle eine Springerin aus, um Details anzuzeigen.</p>
                    </div>
                )}
            </div>

            {/* Note Editor Modal */}
            {editingNote && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '24px' }}>
                        <div style={{ marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--navy)' }}>
                                Notiz für {getMonthName(editingNote.monat)} {editingNote.jahr}
                            </h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Autor: <strong>{currentUserName}</strong>
                            </p>
                        </div>

                        <div className="form-group">
                            <textarea
                                className="form-input"
                                value={editingNote.content}
                                onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                                placeholder="Notiz hier eingeben..."
                                style={{ minHeight: '120px', resize: 'vertical' }}
                                autoFocus
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setEditingNote(null)}
                                disabled={isSaving}
                            >
                                Abbrechen
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSaveNote}
                                disabled={isSaving || !editingNote.content.trim()}
                            >
                                Speichern
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
