'use client';

import { useState, useCallback, useTransition } from 'react';
import type { Category } from '@/lib/data';
import { type CategoryRule, getMatchingRule } from '@/lib/categoryMatcher';

interface Props {
    initialRules: CategoryRule[];
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

type NewRuleState = {
    category_name: string;
    field: 'description' | 'counterparty' | 'any';
    match_type: 'contains' | 'starts_with' | 'exact';
    value: string;
    priority: number;
};

type EditState = NewRuleState;

const EMPTY_NEW: NewRuleState = {
    category_name: '',
    field: 'description',
    match_type: 'contains',
    value: '',
    priority: 10,
};

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
            <span style={{
                padding: '8px 20px', fontSize: 13, fontWeight: 600,
                color: 'var(--navy)', borderBottom: '2px solid var(--primary)', marginBottom: -2,
            }}>
                Import-Regeln
            </span>
            <a href="/verwaltung/kategorien/regeln/log" style={{
                padding: '8px 20px', fontSize: 13, fontWeight: 500,
                color: 'var(--text-muted)', textDecoration: 'none',
                borderBottom: '2px solid transparent', marginBottom: -2,
            }}>
                Regelprotokoll
            </a>
        </div>
    );
}

function PriorityBadge({ priority }: { priority: number }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 32, padding: '2px 8px', borderRadius: 12,
            fontSize: 12, fontWeight: 700,
            background: priority >= 20 ? '#fef3c7' : priority >= 10 ? '#dbeafe' : '#f3f4f6',
            color: priority >= 20 ? '#92400e' : priority >= 10 ? '#1e40af' : '#6b7280',
        }}>
            {priority}
        </span>
    );
}

export default function KategorienRegelnClient({ initialRules, categories }: Props) {
    const [rules, setRules] = useState<CategoryRule[]>(initialRules);
    const [showNewForm, setShowNewForm] = useState(false);
    const [newRule, setNewRule] = useState<NewRuleState>({ ...EMPTY_NEW, category_name: categories[0]?.name || '' });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editState, setEditState] = useState<EditState>({ ...EMPTY_NEW });
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    // Live tester
    const [testDesc, setTestDesc] = useState('');
    const [testCounterparty, setTestCounterparty] = useState('');

    // Apply to existing
    const [applyModalOpen, setApplyModalOpen] = useState(false);
    const [applyMode, setApplyMode] = useState<'uncategorized' | 'all'>('uncategorized');
    const [isApplying, setIsApplying] = useState(false);
    const [applyResult, setApplyResult] = useState<{ updated: number; skipped: number } | null>(null);

    const showSuccess = useCallback((msg: string) => {
        setSuccess(msg);
        setTimeout(() => setSuccess(null), 3000);
    }, []);

    const showError = useCallback((msg: string) => {
        setError(msg);
        setTimeout(() => setError(null), 5000);
    }, []);

    const handleApply = useCallback(async () => {
        setIsApplying(true);
        setApplyResult(null);
        try {
            const res = await fetch('/api/category-rules/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ overwrite: applyMode === 'all' }),
            });
            const data = await res.json();
            if (!res.ok) { showError(data.error || 'Fehler beim Anwenden.'); setApplyModalOpen(false); return; }
            setApplyResult(data);
        } catch {
            showError('Fehler beim Anwenden der Regeln.');
            setApplyModalOpen(false);
        } finally {
            setIsApplying(false);
        }
    }, [applyMode, showError]);

    // ── Create ───────────────────────────────────────────────────────────────

    const handleCreate = useCallback(() => {
        if (!newRule.category_name || !newRule.value.trim()) {
            showError('Kategorie und Suchwert sind erforderlich.');
            return;
        }
        startTransition(async () => {
            const res = await fetch('/api/category-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newRule, value: newRule.value.trim() }),
            });
            const data = await res.json();
            if (!res.ok) { showError(data.error || 'Fehler beim Erstellen.'); return; }
            setRules(prev => [data, ...prev].sort((a, b) => b.priority - a.priority));
            setNewRule({ ...EMPTY_NEW, category_name: categories[0]?.name || '' });
            setShowNewForm(false);
            showSuccess('Regel wurde erstellt.');
        });
    }, [newRule, categories, showError, showSuccess]);

    // ── Edit ────────────────────────────────────────────────────────────────

    const startEdit = useCallback((rule: CategoryRule) => {
        setEditingId(rule.id);
        setEditState({
            category_name: rule.category_name,
            field: rule.field,
            match_type: rule.match_type,
            value: rule.value,
            priority: rule.priority,
        });
        setDeleteConfirm(null);
    }, []);

    const handleSave = useCallback(() => {
        if (!editState.value.trim()) { showError('Suchwert darf nicht leer sein.'); return; }
        startTransition(async () => {
            const res = await fetch(`/api/category-rules/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...editState, value: editState.value.trim() }),
            });
            const data = await res.json();
            if (!res.ok) { showError(data.error || 'Fehler beim Speichern.'); return; }
            setRules(prev =>
                prev.map(r => r.id === editingId ? { ...r, ...editState, value: editState.value.trim() } : r)
                    .sort((a, b) => b.priority - a.priority)
            );
            setEditingId(null);
            showSuccess('Regel wurde aktualisiert.');
        });
    }, [editingId, editState, showError, showSuccess]);

    // ── Delete ───────────────────────────────────────────────────────────────

    const handleDelete = useCallback((id: string) => {
        startTransition(async () => {
            const res = await fetch(`/api/category-rules/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) { showError(data.error || 'Fehler beim Löschen.'); setDeleteConfirm(null); return; }
            setRules(prev => prev.filter(r => r.id !== id));
            setDeleteConfirm(null);
            showSuccess('Regel wurde gelöscht.');
        });
    }, [showError, showSuccess]);

    // ── Live tester ──────────────────────────────────────────────────────────

    const testResult = (testDesc || testCounterparty)
        ? getMatchingRule(rules, testDesc, testCounterparty)
        : undefined;

    const catColor = (name: string) => categories.find(c => c.name === name)?.color || '#6b7280';

    // ── Row rendering ────────────────────────────────────────────────────────

    const renderRow = (rule: CategoryRule) => {
        const color = catColor(rule.category_name);

        if (editingId === rule.id) {
            return (
                <tr key={rule.id} style={{ background: '#fffbeb' }}>
                    <td style={{ padding: '12px 16px' }}>
                        <input
                            type="number"
                            className="form-input"
                            style={{ width: 70, fontSize: 13, padding: '5px 8px' }}
                            value={editState.priority}
                            min={1} max={100}
                            onChange={e => setEditState(s => ({ ...s, priority: Number(e.target.value) }))}
                        />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                        <select className="form-select" style={{ fontSize: 13, padding: '5px 8px' }}
                            value={editState.category_name}
                            onChange={e => setEditState(s => ({ ...s, category_name: e.target.value }))}
                        >
                            {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                        <select className="form-select" style={{ fontSize: 13, padding: '5px 8px' }}
                            value={editState.field}
                            onChange={e => setEditState(s => ({ ...s, field: e.target.value as EditState['field'] }))}
                        >
                            <option value="description">Verwendungszweck</option>
                            <option value="counterparty">Empfänger</option>
                            <option value="any">Beides</option>
                        </select>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                        <select className="form-select" style={{ fontSize: 13, padding: '5px 8px' }}
                            value={editState.match_type}
                            onChange={e => setEditState(s => ({ ...s, match_type: e.target.value as EditState['match_type'] }))}
                        >
                            <option value="contains">enthält</option>
                            <option value="starts_with">beginnt mit</option>
                            <option value="exact">exakt</option>
                        </select>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                        <input
                            className="form-input"
                            style={{ fontSize: 13, padding: '5px 8px', minWidth: 160 }}
                            value={editState.value}
                            onChange={e => setEditState(s => ({ ...s, value: e.target.value }))}
                            autoFocus
                        />
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={isPending}>
                                {isPending ? '…' : '✓ Speichern'}
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>
                                Abbrechen
                            </button>
                        </div>
                    </td>
                </tr>
            );
        }

        if (deleteConfirm === rule.id) {
            return (
                <tr key={rule.id} style={{ background: '#fff1f2' }}>
                    <td colSpan={5} style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: 600 }}>Regel wirklich löschen?</span>
                        <span style={{ color: '#dc2626', fontSize: 13, marginLeft: 10 }}>
                            {FIELD_LABELS[rule.field]} {MATCH_LABELS[rule.match_type]} „{rule.value}" → {rule.category_name}
                        </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(rule.id)} disabled={isPending}>
                                {isPending ? '…' : 'Löschen'}
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirm(null)}>
                                Abbrechen
                            </button>
                        </div>
                    </td>
                </tr>
            );
        }

        return (
            <tr key={rule.id}>
                <td style={{ padding: '12px 16px' }}>
                    <PriorityBadge priority={rule.priority} />
                </td>
                <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{rule.category_name}</span>
                    </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                    {FIELD_LABELS[rule.field]}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>
                    <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 6,
                        background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12,
                    }}>
                        {MATCH_LABELS[rule.match_type]}
                    </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                    <code style={{
                        background: 'var(--bg)', padding: '2px 8px', borderRadius: 4,
                        fontSize: 12, fontFamily: 'monospace', color: 'var(--text)',
                    }}>
                        {rule.value}
                    </code>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" style={{ fontSize: 12 }}
                            onClick={() => startEdit(rule)}>
                            ✏️ Bearbeiten
                        </button>
                        <button className="btn btn-danger btn-sm" style={{ fontSize: 12 }}
                            onClick={() => { setDeleteConfirm(rule.id); setEditingId(null); }}>
                            🗑 Löschen
                        </button>
                    </div>
                </td>
            </tr>
        );
    };

    const coveredCategories = new Set(rules.map(r => r.category_name)).size;

    return (
        <div>
            <TabNav />

            {(error || success) && (
                <div style={{
                    padding: '14px 20px', borderRadius: 'var(--radius-sm)', marginBottom: 20,
                    fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
                    background: error ? '#fee2e2' : '#dcfce7',
                    color: error ? '#dc2626' : '#16a34a',
                    border: `1px solid ${error ? '#fecaca' : '#bbf7d0'}`,
                }}>
                    {error ? '⚠️' : '✅'} {error || success}
                </div>
            )}

            {/* Stats */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                {[
                    { label: '📋 Regeln', value: rules.length, sub: 'aktive Regeln' },
                    { label: '🏷️ Kategorien', value: coveredCategories, sub: 'abgedeckt' },
                    { label: '📂 Verfügbar', value: categories.length, sub: 'Kategorien gesamt' },
                ].map(s => (
                    <div key={s.label} className="stat-card" style={{ flex: '1 1 160px' }}>
                        <div className="stat-card-label">{s.label}</div>
                        <div className="stat-card-value">{s.value}</div>
                        <div className="stat-card-sub">{s.sub}</div>
                    </div>
                ))}
            </div>

            {/* Apply to existing button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
                <button
                    className="btn btn-secondary"
                    onClick={() => { setApplyModalOpen(true); setApplyResult(null); }}
                    disabled={rules.length === 0}
                    style={{ fontSize: 13 }}
                >
                    ⚡ Regeln auf bestehende Buchungen anwenden
                </button>
            </div>

            {/* New Rule */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header" style={{ paddingBottom: showNewForm ? 0 : 20 }}>
                    <div className="card-title">➕ Neue Regel</div>
                    <button
                        className={`btn btn-sm ${showNewForm ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => setShowNewForm(s => !s)}
                    >
                        {showNewForm ? 'Abbrechen' : '+ Anlegen'}
                    </button>
                </div>

                {showNewForm && (
                    <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Kategorie</label>
                                <select className="form-select" value={newRule.category_name}
                                    onChange={e => setNewRule(s => ({ ...s, category_name: e.target.value }))}>
                                    {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Feld prüfen</label>
                                <select className="form-select" value={newRule.field}
                                    onChange={e => setNewRule(s => ({ ...s, field: e.target.value as NewRuleState['field'] }))}>
                                    <option value="description">Verwendungszweck</option>
                                    <option value="counterparty">Empfänger</option>
                                    <option value="any">Beides</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Bedingung</label>
                                <select className="form-select" value={newRule.match_type}
                                    onChange={e => setNewRule(s => ({ ...s, match_type: e.target.value as NewRuleState['match_type'] }))}>
                                    <option value="contains">enthält</option>
                                    <option value="starts_with">beginnt mit</option>
                                    <option value="exact">exakt</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Suchwert</label>
                                <input
                                    className="form-input"
                                    placeholder="z.B. ADAC oder GEZ"
                                    value={newRule.value}
                                    onChange={e => setNewRule(s => ({ ...s, value: e.target.value }))}
                                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Priorität</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    min={1} max={100} step={1}
                                    value={newRule.priority}
                                    onChange={e => setNewRule(s => ({ ...s, priority: Number(e.target.value) }))}
                                />
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                    Höher = wird zuerst geprüft
                                </p>
                            </div>
                        </div>

                        {newRule.value && (
                            <div style={{
                                padding: '10px 14px', borderRadius: 6,
                                background: 'var(--bg)', border: '1px solid var(--border)',
                                fontSize: 13, marginBottom: 16, color: 'var(--text-muted)',
                            }}>
                                Wenn <strong>{FIELD_LABELS[newRule.field]}</strong> „<strong>{newRule.value}</strong>" {MATCH_LABELS[newRule.match_type]} →{' '}
                                <span style={{ color: catColor(newRule.category_name), fontWeight: 600 }}>{newRule.category_name}</span>
                            </div>
                        )}

                        <button
                            className="btn btn-primary"
                            onClick={handleCreate}
                            disabled={isPending || !newRule.category_name || !newRule.value.trim()}
                        >
                            {isPending ? 'Wird gespeichert…' : '✓ Regel anlegen'}
                        </button>
                    </div>
                )}
            </div>

            {/* Rules Table */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header" style={{ paddingBottom: 0 }}>
                    <div className="card-title">📋 Alle Regeln</div>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>
                        {rules.length === 0 ? 'Noch keine Regeln' : `${rules.length} Regel${rules.length !== 1 ? 'n' : ''}, sortiert nach Priorität`}
                    </span>
                </div>
                <div style={{ overflowX: 'auto', marginTop: 16 }}>
                    {rules.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                            Noch keine Regeln angelegt. Erstelle deine erste Regel oben!
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Priorität</th>
                                    <th>Kategorie</th>
                                    <th>Feld</th>
                                    <th>Bedingung</th>
                                    <th>Suchwert</th>
                                    <th style={{ textAlign: 'right' }}>Aktionen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rules.map(renderRow)}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Live Tester */}
            <div className="card">
                <div className="card-header" style={{ paddingBottom: 0 }}>
                    <div className="card-title">🔍 Live-Tester</div>
                </div>
                <div className="card-body">
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                        Gib eine Beispiel-Buchung ein und sieh sofort, welche Regel greifen würde.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, maxWidth: 640 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Verwendungszweck</label>
                            <input className="form-input" placeholder="z.B. Monatsbeitrag ADAC"
                                value={testDesc} onChange={e => setTestDesc(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Empfänger</label>
                            <input className="form-input" placeholder="z.B. Stadtwerke Berlin"
                                value={testCounterparty} onChange={e => setTestCounterparty(e.target.value)} />
                        </div>
                    </div>

                    {testResult === undefined && (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Tipp eingeben, um das Ergebnis zu sehen.
                        </div>
                    )}
                    {testResult === null && (testDesc || testCounterparty) && (
                        <div style={{
                            padding: '12px 16px', borderRadius: 8,
                            background: '#f9fafb', border: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                            <span style={{ fontSize: 20 }}>❌</span>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>Keine Regel gefunden</div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                    Diese Buchung würde als <strong>„Nicht kategorisiert"</strong> importiert.
                                </div>
                            </div>
                        </div>
                    )}
                    {testResult && (
                        <div style={{
                            padding: '12px 16px', borderRadius: 8,
                            background: '#f0fdf4', border: '1px solid #bbf7d0',
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                        }}>
                            <span style={{ fontSize: 20 }}>✅</span>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                                    Kategorie:{' '}
                                    <span style={{ color: catColor(testResult.category_name) }}>
                                        {testResult.category_name}
                                    </span>
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                    Regel (Priorität {testResult.priority}):{' '}
                                    <strong>{FIELD_LABELS[testResult.field]}</strong>{' '}
                                    {MATCH_LABELS[testResult.match_type]}{' '}
                                    „<code style={{ fontFamily: 'monospace', fontSize: 12 }}>{testResult.value}</code>"
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Info */}
            <div style={{
                marginTop: 20, padding: '14px 18px', borderRadius: 'var(--radius-sm)',
                background: '#eff6ff', border: '1px solid #bfdbfe',
                fontSize: 13, color: '#1d4ed8', display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
                <div>
                    <strong>So funktioniert das Matching:</strong> Beim Import werden alle Regeln in der Reihenfolge ihrer Priorität geprüft.
                    Die erste passende Regel gewinnt und legt die Kategorie fest.
                    Buchungen ohne passende Regel werden als „Nicht kategorisiert" importiert.
                    Groß- und Kleinschreibung wird ignoriert.
                </div>
            </div>

            {/* Apply Modal */}
            {applyModalOpen && (
                <div
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    onClick={e => { if (e.target === e.currentTarget && !isApplying) { setApplyModalOpen(false); setApplyResult(null); } }}
                >
                    <div style={{
                        background: 'var(--card)', borderRadius: 'var(--radius)',
                        padding: 32, maxWidth: 480, width: '90%',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                    }}>
                        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>
                            Regeln auf bestehende Buchungen anwenden
                        </h3>

                        {applyResult ? (
                            <>
                                <div style={{
                                    padding: '16px 20px', borderRadius: 8, marginBottom: 24,
                                    background: '#f0fdf4', border: '1px solid #bbf7d0',
                                    display: 'flex', gap: 12, alignItems: 'flex-start',
                                }}>
                                    <span style={{ fontSize: 22 }}>✅</span>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                                            {applyResult.updated} Buchung{applyResult.updated !== 1 ? 'en' : ''} kategorisiert
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                            {applyResult.skipped} Buchung{applyResult.skipped !== 1 ? 'en' : ''} unverändert
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button className="btn btn-primary" onClick={() => { setApplyModalOpen(false); setApplyResult(null); }}>
                                        Schließen
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                                    {rules.length} Regel{rules.length !== 1 ? 'n' : ''} werden auf alle vorhandenen Buchungen angewendet.
                                    Wähle, wie mit bereits kategorisierten Buchungen umgegangen werden soll:
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                                    {([
                                        {
                                            value: 'uncategorized' as const,
                                            label: 'Nur „Nicht kategorisiert" befüllen',
                                            sub: 'Manuell gesetzte Kategorien bleiben erhalten.',
                                        },
                                        {
                                            value: 'all' as const,
                                            label: 'Alle Buchungen neu kategorisieren',
                                            sub: 'Alle bestehenden Kategorien werden überschrieben.',
                                        },
                                    ]).map(opt => (
                                        <label key={opt.value} style={{
                                            display: 'flex', gap: 12, alignItems: 'flex-start',
                                            padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                                            border: `2px solid ${applyMode === opt.value ? 'var(--primary)' : 'var(--border)'}`,
                                            background: applyMode === opt.value ? '#eff6ff' : 'transparent',
                                        }}>
                                            <input
                                                type="radio"
                                                name="applyMode"
                                                value={opt.value}
                                                checked={applyMode === opt.value}
                                                onChange={() => setApplyMode(opt.value)}
                                                style={{ marginTop: 2, flexShrink: 0 }}
                                            />
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{opt.label}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{opt.sub}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                    <button className="btn btn-secondary" onClick={() => setApplyModalOpen(false)} disabled={isApplying}>
                                        Abbrechen
                                    </button>
                                    <button className="btn btn-primary" onClick={handleApply} disabled={isApplying}>
                                        {isApplying ? 'Wird angewendet…' : 'Anwenden'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
