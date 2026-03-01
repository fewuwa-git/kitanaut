'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useFilterState, PeriodKey } from '@/hooks/useFilterState';
import { CATEGORY_COLORS, ALL_CATEGORIES } from '@/lib/constants';

interface Transaction {
    id: string;
    date: string;
    description: string;
    counterparty: string;
    amount: number;
    category: string;
    type: 'income' | 'expense';
    balance: number;
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
    }).format(amount);
}

function getDateRange(period: PeriodKey, customStart?: string, customEnd?: string): { start: Date; end: Date } {
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    if (period === '30d') {
        start.setDate(end.getDate() - 30);
    } else if (period === '6m') {
        start.setMonth(start.getMonth() - 6);
    } else if (period === '12m') {
        start.setFullYear(start.getFullYear() - 1);
    } else if (period === 'custom' && customStart && customEnd) {
        // Adjust customEnd to include the full day
        const parsedStart = new Date(customStart);
        parsedStart.setHours(0, 0, 0, 0);
        const parsedEnd = new Date(customEnd);
        parsedEnd.setHours(23, 59, 59, 999);
        return { start: parsedStart, end: parsedEnd };
    }
    return { start, end };
}

interface KontoauszugClientProps {
    transactions: Transaction[];
    userRole?: 'admin' | 'member';
}

export default function KontoauszugClient({ transactions: initialTransactions, userRole }: KontoauszugClientProps) {
    const { period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd } = useFilterState('30d');
    const [searchTerm, setSearchTerm] = useState('');
    const [transactions, setTransactions] = useState(initialTransactions);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setEditingId(null);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const { start, end } = useMemo(
        () => getDateRange(period, customStart, customEnd),
        [period, customStart, customEnd]
    );

    const filteredTransactions = useMemo(() => {
        return [...transactions]
            .filter((t) => {
                const d = new Date(t.date);
                if (d < start || d > end) return false;

                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    return (
                        t.description.toLowerCase().includes(term) ||
                        t.counterparty.toLowerCase().includes(term) ||
                        t.category.toLowerCase().includes(term)
                    );
                }
                return true;
            })
            // Sort by date descending (newest first)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, start, end, searchTerm]);

    const handlePeriodChange = useCallback((p: PeriodKey) => {
        setPeriod(p);
        if (p !== 'custom') {
            setCustomStart('');
            setCustomEnd('');
        }
    }, [setPeriod, setCustomStart, setCustomEnd]);

    const handleCategoryChange = async (id: string, newCategory: string) => {
        if (isLoading) return;
        setIsLoading(id);
        try {
            const res = await fetch(`/api/transactions/${id}/category`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: newCategory }),
            });

            if (!res.ok) throw new Error('Update failed');

            setTransactions(prev => prev.map(t => t.id === id ? { ...t, category: newCategory } : t));
            setEditingId(null);
        } catch (error) {
            console.error('Failed to update category:', error);
            alert('Fehler beim Aktualisieren der Kategorie');
        } finally {
            setIsLoading(null);
        }
    };

    // Summary statistics for the filtered period
    const stats = useMemo(() => {
        const income = filteredTransactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
        const expense = filteredTransactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
        const startBalance = filteredTransactions.length > 0 ? filteredTransactions[filteredTransactions.length - 1].balance - filteredTransactions[filteredTransactions.length - 1].amount : 0;
        const endBalance = filteredTransactions.length > 0 ? filteredTransactions[0].balance : 0;

        return { income, expense, startBalance, endBalance, count: filteredTransactions.length };
    }, [filteredTransactions]);


    return (
        <div>
            {/* Filter Card */}
            <div className="card mb-6">
                <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px', paddingBottom: period === 'custom' ? 0 : '16px' }}>
                    <div className="card-title">📅 Filter</div>
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

            {/* Stats Grid */}
            <div className="stats-grid mb-6">
                <div className="stat-card">
                    <div className="stat-card-label">🧾 Anzahl Buchungen</div>
                    <div className="stat-card-value">{stats.count}</div>
                    <div className="stat-card-sub">Im gewählten Zeitraum</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-label">
                        <span style={{ color: 'var(--green)' }}>↑</span> Einnahmen
                    </div>
                    <div className="stat-card-value" style={{ color: 'var(--green)' }}>
                        {formatCurrency(stats.income)}
                    </div>
                    <div className="stat-card-sub">Im gewählten Zeitraum</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-label">
                        <span style={{ color: 'var(--red)' }}>↓</span> Ausgaben
                    </div>
                    <div className="stat-card-value" style={{ color: 'var(--red)' }}>
                        {formatCurrency(stats.expense)}
                    </div>
                    <div className="stat-card-sub">Im gewählten Zeitraum</div>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="card">
                <div className="card-header" style={{ flexWrap: 'wrap', gap: '16px', paddingBottom: '16px' }}>
                    <div className="card-title">📖 Alle Buchungen</div>
                    <div style={{ flex: '1 1 200px', maxWidth: '300px' }}>
                        <input
                            type="text"
                            placeholder="Suchen (Beschreibung, Gegenüber, Kategorie)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="form-input"
                            style={{ padding: '8px 12px' }}
                        />
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Datum</th>
                                <th>Beschreibung</th>
                                <th>Gegenüber</th>
                                <th>Kategorie</th>
                                <th style={{ textAlign: 'right' }}>Betrag</th>
                                <th style={{ textAlign: 'right' }}>Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                                        Keine Buchungen im gewählten Zeitraum gefunden.
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map((tx) => (
                                    <tr key={tx.id}>
                                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '13px' }}>
                                            {new Date(tx.date).toLocaleDateString('de-DE')}
                                        </td>
                                        <td style={{ maxWidth: 200 }}>
                                            <div style={{ fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {tx.description}
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {tx.counterparty}
                                        </td>
                                        <td style={{ position: 'relative', fontSize: '13px' }}>
                                            {userRole === 'admin' ? (
                                                <button
                                                    className="category-badge"
                                                    disabled={isLoading === tx.id}
                                                    onClick={() => setEditingId(editingId === tx.id ? null : tx.id)}
                                                    style={{
                                                        background: `${CATEGORY_COLORS[tx.category] || '#6b7280'}18`,
                                                        color: CATEGORY_COLORS[tx.category] || '#6b7280',
                                                        cursor: 'pointer',
                                                        border: 'none',
                                                        opacity: isLoading === tx.id ? 0.5 : 1,
                                                    }}
                                                >
                                                    {tx.category}
                                                    <span style={{ marginLeft: '4px', fontSize: '10px' }}>▼</span>
                                                </button>
                                            ) : (
                                                <span
                                                    className="category-badge"
                                                    style={{
                                                        background: `${CATEGORY_COLORS[tx.category] || '#6b7280'}18`,
                                                        color: CATEGORY_COLORS[tx.category] || '#6b7280',
                                                    }}
                                                >
                                                    {tx.category}
                                                </span>
                                            )}

                                            {editingId === tx.id && (
                                                <div
                                                    ref={dropdownRef}
                                                    className="card"
                                                    style={{
                                                        position: 'absolute',
                                                        top: '100%',
                                                        left: 0,
                                                        zIndex: 100,
                                                        minWidth: '180px',
                                                        padding: '8px',
                                                        boxShadow: 'var(--shadow-lg)',
                                                        marginTop: '4px',
                                                    }}
                                                >
                                                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                        {ALL_CATEGORIES.map((cat) => (
                                                            <button
                                                                key={cat}
                                                                className="category-badge"
                                                                onClick={() => handleCategoryChange(tx.id, cat)}
                                                                style={{
                                                                    display: 'block',
                                                                    width: '100%',
                                                                    textAlign: 'left',
                                                                    marginBottom: '4px',
                                                                    background: tx.category === cat ? `${CATEGORY_COLORS[cat]}25` : 'transparent',
                                                                    color: CATEGORY_COLORS[cat] || '#6b7280',
                                                                    border: 'none',
                                                                    padding: '6px 10px',
                                                                    cursor: 'pointer',
                                                                }}
                                                            >
                                                                {cat}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className={`tx-amount ${tx.amount >= 0 ? 'positive' : 'negative'}`} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 500, whiteSpace: 'nowrap', fontSize: '13px' }}>
                                            {formatCurrency(tx.balance)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
