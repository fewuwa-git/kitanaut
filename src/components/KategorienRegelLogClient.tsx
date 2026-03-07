'use client';

import { useState, useMemo } from 'react';
import type { Category } from '@/lib/data';
import type { CategoryRule } from '@/lib/categoryMatcher';

export interface LogEntry {
    id: string;
    date: string;
    description: string;
    counterparty: string;
    amount: number;
    category: string;
    rule: Pick<CategoryRule, 'id' | 'category_name' | 'field' | 'match_type' | 'value' | 'priority'> | null;
    conflict: boolean; // current category ≠ rule suggestion (and current is not 'Nicht kategorisiert')
}

interface Props {
    entries: LogEntry[];
    categories: Category[];
}

const FIELD_LABELS: Record<string, string> = {
    description: 'Verwendungszweck',
    counterparty: 'Empfänger',
    any: 'Beides',
};

const MATCH_LABELS: Record<string, string> = {
    contains: 'enthält',
    starts_with: 'beginnt mit',
    exact: 'exakt',
};

type ModeFilter = 'all' | 'matched' | 'unmatched' | 'conflict';

function TabNav() {
    return (
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 24 }}>
            <a href="/verwaltung/kategorien" style={{
                padding: '8px 20px', fontSize: 13, fontWeight: 500,
                color: 'var(--text-muted)', textDecoration: 'none',
                borderBottom: '2px solid transparent', marginBottom: -2,
            }}>
                Kategorien
            </a>
            <a href="/verwaltung/kategorien/regeln" style={{
                padding: '8px 20px', fontSize: 13, fontWeight: 500,
                color: 'var(--text-muted)', textDecoration: 'none',
                borderBottom: '2px solid transparent', marginBottom: -2,
            }}>
                Import-Regeln
            </a>
            <span style={{
                padding: '8px 20px', fontSize: 13, fontWeight: 600,
                color: 'var(--navy)', borderBottom: '2px solid var(--primary)', marginBottom: -2,
            }}>
                Regelprotokoll
            </span>
        </div>
    );
}

const PAGE_SIZE = 100;

export default function KategorienRegelLogClient({ entries, categories }: Props) {
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [mode, setMode] = useState<ModeFilter>('all');
    const [page, setPage] = useState(0);

    const catColor = (name: string) => categories.find(c => c.name === name)?.color || '#6b7280';

    const stats = useMemo(() => ({
        total: entries.length,
        matched: entries.filter(e => e.rule !== null).length,
        unmatched: entries.filter(e => e.rule === null).length,
        conflict: entries.filter(e => e.conflict).length,
    }), [entries]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return entries.filter(e => {
            if (mode === 'matched' && e.rule === null) return false;
            if (mode === 'unmatched' && e.rule !== null) return false;
            if (mode === 'conflict' && !e.conflict) return false;
            if (categoryFilter && e.category !== categoryFilter) return false;
            if (q && !e.description.toLowerCase().includes(q) && !e.counterparty.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [entries, search, categoryFilter, mode]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const handleFilterChange = (fn: () => void) => { fn(); setPage(0); };

    return (
        <div>
            <TabNav />

            {/* Stats */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
                {([
                    { label: '📒 Buchungen', value: stats.total, sub: 'gesamt', mode: 'all' as ModeFilter },
                    { label: '✅ Mit Regel', value: stats.matched, sub: 'automatisch kategorisiert', mode: 'matched' as ModeFilter },
                    { label: '❌ Ohne Regel', value: stats.unmatched, sub: 'keine Regel greift', mode: 'unmatched' as ModeFilter },
                    { label: '⚠️ Konflikte', value: stats.conflict, sub: 'Regel ≠ aktuelle Kategorie', mode: 'conflict' as ModeFilter },
                ]).map(s => (
                    <button
                        key={s.label}
                        className="stat-card"
                        onClick={() => handleFilterChange(() => setMode(prev => prev === s.mode ? 'all' : s.mode))}
                        style={{
                            flex: '1 1 160px', textAlign: 'left', cursor: 'pointer',
                            border: mode === s.mode ? '2px solid var(--primary)' : '2px solid transparent',
                            background: mode === s.mode ? '#eff6ff' : undefined,
                        }}
                    >
                        <div className="stat-card-label">{s.label}</div>
                        <div className="stat-card-value">{s.value}</div>
                        <div className="stat-card-sub">{s.sub}</div>
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-body" style={{ paddingTop: 16, paddingBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                            className="form-input"
                            style={{ flex: '1 1 200px', fontSize: 13, padding: '7px 12px' }}
                            placeholder="Suche in Beschreibung oder Empfänger…"
                            value={search}
                            onChange={e => handleFilterChange(() => setSearch(e.target.value))}
                        />
                        <select
                            className="form-select"
                            style={{ flex: '0 0 200px', fontSize: 13, padding: '7px 12px' }}
                            value={categoryFilter}
                            onChange={e => handleFilterChange(() => setCategoryFilter(e.target.value))}
                        >
                            <option value="">Alle Kategorien</option>
                            {categories.map(c => (
                                <option key={c.name} value={c.name}>{c.name}</option>
                            ))}
                            <option value="Nicht kategorisiert">Nicht kategorisiert</option>
                        </select>
                        {(search || categoryFilter || mode !== 'all') && (
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => { setSearch(''); setCategoryFilter(''); setMode('all'); setPage(0); }}
                                style={{ fontSize: 12 }}
                            >
                                Filter zurücksetzen
                            </button>
                        )}
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                            {filtered.length} Einträge
                        </span>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card">
                <div style={{ overflowX: 'auto' }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                            Keine Buchungen gefunden.
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Datum</th>
                                    <th>Beschreibung</th>
                                    <th>Empfänger</th>
                                    <th style={{ textAlign: 'right' }}>Betrag</th>
                                    <th>Kategorie</th>
                                    <th>Angewandte Regel</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map(entry => {
                                    const rowBg = entry.conflict ? '#fffbeb' : undefined;
                                    const [y, m, d] = entry.date.split('-');
                                    const dateStr = `${d}.${m}.${y}`;

                                    return (
                                        <tr key={entry.id} style={{ background: rowBg }}>
                                            <td style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                                                {dateStr}
                                            </td>
                                            <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                title={entry.description}>
                                                {entry.description || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>–</span>}
                                            </td>
                                            <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                title={entry.counterparty}>
                                                {entry.counterparty || '–'}
                                            </td>
                                            <td style={{
                                                textAlign: 'right', fontSize: 12, whiteSpace: 'nowrap', fontWeight: 500,
                                                color: entry.amount >= 0 ? '#16a34a' : '#dc2626',
                                            }}>
                                                {entry.amount >= 0 ? '+' : ''}{entry.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                            </td>
                                            <td style={{ fontSize: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {entry.category !== 'Nicht kategorisiert' && (
                                                        <span style={{
                                                            width: 8, height: 8, borderRadius: '50%',
                                                            background: catColor(entry.category), flexShrink: 0,
                                                        }} />
                                                    )}
                                                    <span style={{
                                                        color: entry.category === 'Nicht kategorisiert' ? 'var(--text-muted)' : 'var(--text)',
                                                        fontStyle: entry.category === 'Nicht kategorisiert' ? 'italic' : 'normal',
                                                    }}>
                                                        {entry.category}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ fontSize: 12 }}>
                                                {entry.rule === null ? (
                                                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Keine Regel</span>
                                                ) : entry.conflict ? (
                                                    <div>
                                                        <div style={{
                                                            display: 'flex', alignItems: 'center', gap: 5,
                                                            marginBottom: 3,
                                                        }}>
                                                            <span style={{ fontSize: 11, color: '#92400e', fontWeight: 600 }}>⚠️ Konflikt</span>
                                                        </div>
                                                        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                                                            Regel schlägt vor:{' '}
                                                            <span style={{ color: catColor(entry.rule.category_name), fontWeight: 600 }}>
                                                                {entry.rule.category_name}
                                                            </span>
                                                        </div>
                                                        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                                                            {FIELD_LABELS[entry.rule.field]} {MATCH_LABELS[entry.rule.match_type]}{' '}
                                                            <code style={{ fontFamily: 'monospace', fontSize: 10 }}>„{entry.rule.value}"</code>
                                                            {' '}(P{entry.rule.priority})
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                                                            <span style={{
                                                                width: 6, height: 6, borderRadius: '50%',
                                                                background: catColor(entry.rule.category_name), flexShrink: 0,
                                                            }} />
                                                            <span style={{ fontWeight: 500 }}>{entry.rule.category_name}</span>
                                                            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>(P{entry.rule.priority})</span>
                                                        </div>
                                                        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                                                            {FIELD_LABELS[entry.rule.field]} {MATCH_LABELS[entry.rule.match_type]}{' '}
                                                            <code style={{ fontFamily: 'monospace', fontSize: 10 }}>„{entry.rule.value}"</code>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{
                        padding: '12px 16px', display: 'flex', gap: 8,
                        alignItems: 'center', justifyContent: 'center',
                        borderTop: '1px solid var(--border)',
                    }}>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setPage(p => p - 1)}
                            disabled={page === 0}
                        >
                            ← Zurück
                        </button>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            Seite {page + 1} von {totalPages}
                        </span>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setPage(p => p + 1)}
                            disabled={page >= totalPages - 1}
                        >
                            Weiter →
                        </button>
                    </div>
                )}
            </div>

            {/* Info */}
            <div style={{
                marginTop: 20, padding: '14px 18px', borderRadius: 'var(--radius-sm)',
                background: '#eff6ff', border: '1px solid #bfdbfe',
                fontSize: 13, color: '#1d4ed8', display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
                <div>
                    <strong>Hinweis:</strong> Diese Ansicht zeigt, welche Regel <em>aktuell</em> auf jede Buchung greifen würde –
                    basierend auf dem jetzigen Regelwerk. <strong>Konflikte</strong> entstehen, wenn eine Buchung bereits
                    eine Kategorie hat, die Regel aber eine andere vorschlagen würde (z.B. nach manueller Änderung oder Regelaktualisierung).
                </div>
            </div>
        </div>
    );
}
