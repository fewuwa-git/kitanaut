'use client';

import { useState, useCallback, useTransition } from 'react';

export interface Category {
    name: string;
    color: string;
    type: 'income' | 'expense' | 'both';
}

interface Props {
    initialCategories: Category[];
}

const TYPE_LABELS: Record<string, string> = {
    income: 'Einnahme',
    expense: 'Ausgabe',
    both: 'Beides',
};

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
    income: { bg: '#dcfce7', color: '#16a34a' },
    expense: { bg: '#fee2e2', color: '#dc2626' },
    both: { bg: '#dbeafe', color: '#2563eb' },
};

// Preset colors for the color picker
const PRESET_COLORS = [
    '#ef4444', '#f43f5e', '#f97316', '#eab308', '#22c55e',
    '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7',
    '#8b5cf6', '#ec4899', '#64748b', '#78716c', '#6b7280',
];

function ColorSwatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: color,
                border: selected ? '3px solid #1a2e45' : '2px solid transparent',
                cursor: 'pointer',
                outline: selected ? '2px solid white' : 'none',
                outlineOffset: '-4px',
                transition: 'transform 0.1s',
                transform: selected ? 'scale(1.15)' : 'scale(1)',
            }}
            title={color}
        />
    );
}

function TypeBadge({ type }: { type: string }) {
    const style = TYPE_COLORS[type] || { bg: '#f0f2f5', color: '#6b7280' };
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 10px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            background: style.bg,
            color: style.color,
        }}>
            {TYPE_LABELS[type] || type}
        </span>
    );
}

interface EditState {
    name: string;
    color: string;
    type: 'income' | 'expense' | 'both';
}

export default function KategorienVerwaltungClient({ initialCategories }: Props) {
    const [categories, setCategories] = useState<Category[]>(initialCategories);
    const [editingName, setEditingName] = useState<string | null>(null);
    const [editState, setEditState] = useState<EditState>({ name: '', color: '#6b7280', type: 'expense' });
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    // New category form state
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('#3b82f6');
    const [newType, setNewType] = useState<'income' | 'expense' | 'both'>('expense');
    const [showNewForm, setShowNewForm] = useState(false);
    const [newCustomColor, setNewCustomColor] = useState('');

    const showSuccess = useCallback((msg: string) => {
        setSuccess(msg);
        setTimeout(() => setSuccess(null), 3000);
    }, []);

    const showError = useCallback((msg: string) => {
        setError(msg);
        setTimeout(() => setError(null), 5000);
    }, []);

    // ── Create ──────────────────────────────────────────────────────────────────

    const handleCreate = useCallback(() => {
        const trimmedName = newName.trim();
        if (!trimmedName) { showError('Bitte Namen eingeben.'); return; }
        if (categories.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
            showError(`Kategorie "${trimmedName}" existiert bereits.`);
            return;
        }
        startTransition(async () => {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmedName, color: newCustomColor || newColor, type: newType }),
            });
            const data = await res.json();
            if (!res.ok) { showError(data.error || 'Fehler beim Erstellen.'); return; }
            setCategories(prev => [...prev, { name: trimmedName, color: newCustomColor || newColor, type: newType }]
                .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)));
            setNewName('');
            setNewColor('#3b82f6');
            setNewType('expense');
            setNewCustomColor('');
            setShowNewForm(false);
            showSuccess(`Kategorie "${trimmedName}" wurde erstellt.`);
        });
    }, [newName, newColor, newCustomColor, newType, categories, showError, showSuccess]);

    // ── Edit ────────────────────────────────────────────────────────────────────

    const startEdit = useCallback((cat: Category) => {
        setEditingName(cat.name);
        setEditState({ name: cat.name, color: cat.color, type: cat.type });
        setDeleteConfirm(null);
    }, []);

    const cancelEdit = useCallback(() => {
        setEditingName(null);
    }, []);

    const handleSave = useCallback(() => {
        const trimmedName = editState.name.trim();
        if (!trimmedName) { showError('Name darf nicht leer sein.'); return; }
        if (editingName !== trimmedName && categories.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
            showError(`Kategorie "${trimmedName}" existiert bereits.`);
            return;
        }
        startTransition(async () => {
            const res = await fetch(`/api/categories/${encodeURIComponent(editingName!)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmedName, color: editState.color, type: editState.type }),
            });
            const data = await res.json();
            if (!res.ok) { showError(data.error || 'Fehler beim Speichern.'); return; }
            setCategories(prev =>
                prev.map(c => c.name === editingName
                    ? { name: trimmedName, color: editState.color, type: editState.type }
                    : c
                ).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
            );
            setEditingName(null);
            showSuccess(`Kategorie${editingName !== trimmedName ? ` umbenannt zu "${trimmedName}"` : ` "${trimmedName}" aktualisiert`}.`);
        });
    }, [editingName, editState, categories, showError, showSuccess]);

    // ── Delete ───────────────────────────────────────────────────────────────────

    const handleDelete = useCallback((name: string) => {
        startTransition(async () => {
            const res = await fetch(`/api/categories/${encodeURIComponent(name)}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) { showError(data.error || 'Fehler beim Löschen.'); setDeleteConfirm(null); return; }
            setCategories(prev => prev.filter(c => c.name !== name));
            setDeleteConfirm(null);
            showSuccess(`Kategorie "${name}" wurde gelöscht.`);
        });
    }, [showError, showSuccess]);

    // ── Group by type for display ────────────────────────────────────────────────
    const income = categories.filter(c => c.type === 'income');
    const expense = categories.filter(c => c.type === 'expense');
    const both = categories.filter(c => c.type === 'both');

    const renderRow = (cat: Category) => {
        const isEditing = editingName === cat.name;
        const isDeleting = deleteConfirm === cat.name;

        if (isEditing) {
            return (
                <tr key={cat.name} style={{ background: '#fffbeb' }}>
                    <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{
                                width: 14, height: 14, borderRadius: '50%',
                                background: editState.color, flexShrink: 0, display: 'inline-block',
                                boxShadow: '0 0 0 2px white, 0 0 0 3px ' + editState.color,
                            }} />
                            <input
                                className="form-input"
                                style={{ maxWidth: 220, padding: '6px 10px', fontSize: 14 }}
                                value={editState.name}
                                onChange={e => setEditState(s => ({ ...s, name: e.target.value }))}
                                autoFocus
                            />
                        </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', maxWidth: 340 }}>
                            {PRESET_COLORS.map(c => (
                                <ColorSwatch key={c} color={c} selected={editState.color === c}
                                    onClick={() => setEditState(s => ({ ...s, color: c }))} />
                            ))}
                            <input
                                type="color"
                                value={editState.color}
                                onChange={e => setEditState(s => ({ ...s, color: e.target.value }))}
                                title="Freie Farbwahl"
                                style={{ width: 26, height: 26, padding: 0, border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            />
                        </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                        <select
                            className="form-select"
                            style={{ width: 'auto', fontSize: 13, padding: '5px 10px' }}
                            value={editState.type}
                            onChange={e => setEditState(s => ({ ...s, type: e.target.value as 'income' | 'expense' | 'both' }))}
                        >
                            <option value="income">Einnahme</option>
                            <option value="expense">Ausgabe</option>
                            <option value="both">Beides</option>
                        </select>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={isPending}>
                                {isPending ? '…' : '✓ Speichern'}
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>
                                Abbrechen
                            </button>
                        </div>
                    </td>
                </tr>
            );
        }

        if (isDeleting) {
            return (
                <tr key={cat.name} style={{ background: '#fff1f2' }}>
                    <td colSpan={3} style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ width: 12, height: 12, borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600 }}>„{cat.name}" wirklich löschen?</span>
                            <span style={{ color: '#dc2626', fontSize: 13 }}>Diese Aktion kann nicht rückgängig gemacht werden.</span>
                        </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(cat.name)} disabled={isPending}>
                                {isPending ? '…' : '🗑 Löschen'}
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
            <tr key={cat.name}>
                <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                            width: 12, height: 12, borderRadius: '50%',
                            background: cat.color, display: 'inline-block', flexShrink: 0,
                        }} />
                        <span style={{ fontWeight: 500 }}>{cat.name}</span>
                    </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                            width: 28, height: 20, borderRadius: 4,
                            background: cat.color, flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{cat.color}</span>
                    </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                    <TypeBadge type={cat.type} />
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => startEdit(cat)}
                            style={{ fontSize: 12 }}
                        >
                            ✏️ Bearbeiten
                        </button>
                        <button
                            className="btn btn-danger btn-sm"
                            onClick={() => { setDeleteConfirm(cat.name); setEditingName(null); }}
                            style={{ fontSize: 12 }}
                        >
                            🗑 Löschen
                        </button>
                    </div>
                </td>
            </tr>
        );
    };

    const renderSection = (label: string, items: Category[], icon: string) => {
        if (items.length === 0) return null;
        return (
            <>
                <tr style={{ background: 'var(--bg)' }}>
                    <td colSpan={4} style={{
                        padding: '8px 16px',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        borderBottom: '1px solid var(--border)',
                    }}>
                        {icon} {label} ({items.length})
                    </td>
                </tr>
                {items.map(renderRow)}
            </>
        );
    };

    return (
        <div>
            {/* Tab Nav */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 24 }}>
                <span style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: 600,
                    color: 'var(--primary)', borderBottom: '2px solid var(--primary)', marginBottom: -2,
                }}>
                    Kategorien
                </span>
                <a href="/verwaltung/kategorien/regeln" style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: 500,
                    color: 'var(--text-muted)', textDecoration: 'none',
                    borderBottom: '2px solid transparent', marginBottom: -2,
                }}>
                    Import-Regeln
                </a>
            </div>

            {/* Notifications */}
            {(error || success) && (
                <div style={{
                    padding: '14px 20px',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: 20,
                    fontSize: 14,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: error ? '#fee2e2' : '#dcfce7',
                    color: error ? '#dc2626' : '#16a34a',
                    border: `1px solid ${error ? '#fecaca' : '#bbf7d0'}`,
                }}>
                    {error ? '⚠️' : '✅'} {error || success}
                </div>
            )}

            {/* Header: Stats + Add button */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'stretch' }}>
                {[
                    { label: '📂 Gesamt', value: categories.length, sub: 'Kategorien definiert' },
                    { label: '↑ Einnahmen', value: income.length, sub: 'Einnahme-Kategorien' },
                    { label: '↓ Ausgaben', value: expense.length, sub: 'Ausgabe-Kategorien' },
                    { label: '↕ Beides', value: both.length, sub: 'Gemischte Kategorien' },
                ].map(s => (
                    <div key={s.label} className="stat-card" style={{ flex: '1 1 160px' }}>
                        <div className="stat-card-label">{s.label}</div>
                        <div className="stat-card-value">{s.value}</div>
                        <div className="stat-card-sub">{s.sub}</div>
                    </div>
                ))}
            </div>

            {/* New Category Form */}
            <div className="card mb-6" style={{ marginBottom: 24 }}>
                <div className="card-header" style={{ paddingBottom: showNewForm ? 0 : 20 }}>
                    <div className="card-title">➕ Neue Kategorie</div>
                    <button
                        className={`btn btn-sm ${showNewForm ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => setShowNewForm(s => !s)}
                    >
                        {showNewForm ? 'Abbrechen' : '+ Anlegen'}
                    </button>
                </div>

                {showNewForm && (
                    <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 600 }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Name</label>
                                <input
                                    className="form-input"
                                    placeholder="z.B. Fortbildung"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Typ</label>
                                <select
                                    className="form-select"
                                    value={newType}
                                    onChange={e => setNewType(e.target.value as 'income' | 'expense' | 'both')}
                                >
                                    <option value="income">Einnahme</option>
                                    <option value="expense">Ausgabe</option>
                                    <option value="both">Beides</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginTop: 16 }}>
                            <label className="form-label">Farbe</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                                {PRESET_COLORS.map(c => (
                                    <ColorSwatch key={c} color={c} selected={!newCustomColor && newColor === c}
                                        onClick={() => { setNewColor(c); setNewCustomColor(''); }} />
                                ))}
                                <input
                                    type="color"
                                    value={newCustomColor || newColor}
                                    onChange={e => setNewCustomColor(e.target.value)}
                                    title="Freie Farbwahl"
                                    style={{ width: 26, height: 26, padding: 0, border: 'none', borderRadius: 6, cursor: 'pointer' }}
                                />
                                <span style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    fontSize: 13, color: '#6b7280', marginLeft: 4,
                                }}>
                                    <span style={{
                                        width: 24, height: 24, borderRadius: 6,
                                        background: newCustomColor || newColor,
                                        display: 'inline-block',
                                        boxShadow: 'var(--shadow)',
                                    }} />
                                    {newCustomColor || newColor}
                                </span>
                            </div>
                        </div>

                        <button
                            className="btn btn-primary"
                            onClick={handleCreate}
                            disabled={isPending || !newName.trim()}
                            style={{ marginTop: 8 }}
                        >
                            {isPending ? 'Wird gespeichert…' : '✓ Kategorie anlegen'}
                        </button>
                    </div>
                )}
            </div>

            {/* Category Table */}
            <div className="card">
                <div className="card-header" style={{ paddingBottom: 0 }}>
                    <div className="card-title">🏷️ Alle Kategorien</div>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>{categories.length} definiert</span>
                </div>
                <div style={{ overflowX: 'auto', marginTop: 16 }}>
                    {categories.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                            Noch keine Kategorien vorhanden. Leg eine neue an!
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Farbe</th>
                                    <th>Typ</th>
                                    <th style={{ textAlign: 'right' }}>Aktionen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {renderSection('Ausgaben', expense, '↓')}
                                {renderSection('Einnahmen', income, '↑')}
                                {renderSection('Beides', both, '↕')}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Info box */}
            <div style={{
                marginTop: 20,
                padding: '14px 18px',
                borderRadius: 'var(--radius-sm)',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                fontSize: 13,
                color: '#1d4ed8',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
            }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
                <div>
                    <strong>Hinweis:</strong> Wenn du eine Kategorie umbenennst, werden alle verknüpften Buchungen automatisch
                    auf den neuen Namen aktualisiert. Kategorien mit verknüpften Buchungen können nicht gelöscht werden –
                    weise die Buchungen zuerst einer anderen Kategorie zu.
                </div>
            </div>
        </div>
    );
}
