'use client';

import { useMemo, useState, useCallback } from 'react';
import { useFilterState, PeriodKey } from '@/hooks/useFilterState';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';

import { CATEGORY_COLORS, EXPENSE_CATEGORIES } from '@/lib/constants';
import type { Category } from '@/lib/data';

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
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatCurrencyFull(amount: number): string {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
    }).format(amount);
}

function getDateRange(period: PeriodKey, customStart?: string, customEnd?: string) {
    const end = new Date();
    const start = new Date();
    if (period === '30d') {
        start.setDate(end.getDate() - 30);
    } else if (period === '6m') {
        start.setMonth(start.getMonth() - 6);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
    } else if (period === '12m') {
        start.setFullYear(start.getFullYear() - 1);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
    } else if (period === 'custom' && customStart && customEnd) {
        return { start: new Date(customStart), end: new Date(customEnd + 'T23:59:59') };
    } else {
        // Fallback (z.B. 'all' aus localStorage): 6 Monate
        start.setMonth(start.getMonth() - 6);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
    }
    return { start, end };
}

// Aggregate expenses per month, broken down by category
// Returns: [{ label: 'Feb 25', Personal: 4984, Miete: 2800, ... }]
function matchesFlow(amount: number, flowType: 'expense' | 'income' | 'both') {
    if (flowType === 'expense') return amount < 0;
    if (flowType === 'income') return amount > 0;
    return amount !== 0;
}

function aggregateByMonthAndCategory(
    transactions: Transaction[],
    start: Date,
    end: Date,
    activeCategories: string[],
    flowType: 'expense' | 'income' | 'both'
): { label: string; key: string;[cat: string]: number | string }[] {
    const filtered = transactions.filter((t) => {
        const d = new Date(t.date);
        return (
            d >= start &&
            d <= end &&
            matchesFlow(t.amount, flowType) &&
            (activeCategories.length === 0 || activeCategories.includes(t.category))
        );
    });

    const map = new Map<string, Record<string, number>>();
    for (const tx of filtered) {
        const d = new Date(tx.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!map.has(key)) map.set(key, {});
        const month = map.get(key)!;
        month[tx.category] = (month[tx.category] || 0) + Math.abs(tx.amount);
    }

    return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, cats]) => {
            const [year, month] = key.split('-');
            const label = new Date(Number(year), Number(month) - 1, 1)
                .toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
            const rounded: Record<string, number | string> = { label, key };
            for (const [cat, val] of Object.entries(cats)) {
                rounded[cat] = Math.round(val * 100) / 100;
            }
            return rounded as { label: string; key: string;[cat: string]: number | string };
        });
}

// Aggregate income vs expense per month (for "both" mode grouped chart)
function aggregateByMonthGrouped(
    transactions: Transaction[],
    start: Date,
    end: Date
): { label: string; key: string; income: number; expense: number }[] {
    const map = new Map<string, { income: number; expense: number }>();
    for (const tx of transactions) {
        const d = new Date(tx.date);
        if (d < start || d > end || tx.amount === 0) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!map.has(key)) map.set(key, { income: 0, expense: 0 });
        const m = map.get(key)!;
        if (tx.amount > 0) m.income += tx.amount;
        else m.expense += Math.abs(tx.amount);
    }
    return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => {
            const [year, month] = key.split('-');
            const label = new Date(Number(year), Number(month) - 1, 1)
                .toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
            return { label, key, income: Math.round(val.income * 100) / 100, expense: Math.round(val.expense * 100) / 100 };
        });
}

// Aggregate for table: category totals
function aggregateByCategory(
    transactions: Transaction[],
    start: Date,
    end: Date,
    activeCategories: string[],
    colorMap: Record<string, string>,
    flowType: 'expense' | 'income' | 'both'
) {
    const filtered = transactions.filter((t) => {
        const d = new Date(t.date);
        return (
            d >= start &&
            d <= end &&
            matchesFlow(t.amount, flowType) &&
            (activeCategories.length === 0 || activeCategories.includes(t.category))
        );
    });

    const map = new Map<string, { expense: number; count: number }>();
    for (const tx of filtered) {
        const existing = map.get(tx.category) || { expense: 0, count: 0 };
        existing.expense += Math.abs(tx.amount);
        existing.count += 1;
        map.set(tx.category, existing);
    }

    return Array.from(map.entries())
        .map(([name, val]) => ({
            name,
            total: Math.round(val.expense * 100) / 100,
            count: val.count,
            color: colorMap[name] || '#64748b',
        }))
        .sort((a, b) => b.total - a.total);
}

// Custom tooltip for stacked bar
interface StackedTooltipProps {
    active?: boolean;
    payload?: Array<{ name: string; value: number; fill: string }>;
    label?: string;
}

function StackedTooltip({ active, payload, label }: StackedTooltipProps) {
    if (!active || !payload || payload.length === 0) return null;
    const total = payload.reduce((s, p) => s + (p.value || 0), 0);
    // Show largest first
    const sorted = [...payload].filter(p => p.value > 0).sort((a, b) => b.value - a.value);
    return (
        <div style={{
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            boxShadow: 'var(--shadow-md)',
            fontSize: '12px',
            minWidth: '180px',
        }}>
            <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 8, fontSize: '13px' }}>{label}</p>
            {sorted.map((p) => (
                <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, margin: '3px 0', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill, flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ color: '#374151' }}>{p.name}</span>
                    </span>
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(p.value)}</span>
                </div>
            ))}
            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '13px' }}>Gesamt</span>
                <span style={{ fontWeight: 700, color: '#dc2626', fontSize: '13px' }}>{formatCurrency(total)}</span>
            </div>
        </div>
    );
}

interface CategoryClientProps {
    transactions: Transaction[];
    categories: Category[];
}

export default function CategoryClient({ transactions, categories }: CategoryClientProps) {
    // Build color map: DB colors take precedence over constants fallback
    const categoryColorMap: Record<string, string> = { ...CATEGORY_COLORS };
    for (const cat of categories) {
        categoryColorMap[cat.name] = cat.color;
    }
    const { period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd } = useFilterState('6m');
    const [flowType, setFlowType] = useState<'expense' | 'income' | 'both'>('expense');
    const [activeCategories, setActiveCategories] = useState<string[]>([]);

    const { start, end } = useMemo(
        () => getDateRange(period, customStart, customEnd),
        [period, customStart, customEnd]
    );

    // Chart data: per month, stacked by category (expense/income mode)
    const chartData = useMemo(
        () => aggregateByMonthAndCategory(transactions, start, end, activeCategories, flowType),
        [transactions, start, end, activeCategories, flowType]
    );

    // Grouped chart data: income vs expense per month (both mode)
    const groupedData = useMemo(
        () => aggregateByMonthGrouped(transactions, start, end),
        [transactions, start, end]
    );

    // Which categories have data in the current period?
    const availableCategories = useMemo(() => {
        const allFiltered = transactions.filter((t) => {
            const d = new Date(t.date);
            return d >= start && d <= end && matchesFlow(t.amount, flowType);
        });
        const found = new Set(allFiltered.map((t) => t.category));
        // Show all found categories: EXPENSE_CATEGORIES first (stable color order), then any others
        const ordered = EXPENSE_CATEGORIES.filter((c) => found.has(c));
        for (const c of found) {
            if (!ordered.includes(c)) ordered.push(c);
        }
        return ordered;
    }, [transactions, start, end, flowType]);

    // Table data
    const tableData = useMemo(
        () => aggregateByCategory(transactions, start, end, activeCategories, categoryColorMap, flowType),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [transactions, start, end, activeCategories, categoryColorMap, flowType]
    );

    const totalExpense = useMemo(() => tableData.reduce((s, d) => s + d.total, 0), [tableData]);

    const toggleCategory = useCallback((cat: string) => {
        setActiveCategories((prev) =>
            prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
        );
    }, []);

    const handleFlowTypeChange = useCallback((f: 'expense' | 'income' | 'both') => {
        setFlowType(f);
        setActiveCategories([]);
    }, []);

    const handlePeriodChange = useCallback((p: PeriodKey) => {
        setPeriod(p);
        if (p !== 'custom') {
            setCustomStart('');
            setCustomEnd('');
        }
    }, []);

    // The categories to render as bars (subset of availableCategories, filtered)
    const categoriesToShow = activeCategories.length > 0
        ? availableCategories.filter((c) => activeCategories.includes(c))
        : availableCategories;

    return (
        <div>
            {/* Filter Card */}
            <div className="card mb-6">
                <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px', paddingBottom: 0, justifyContent: 'space-between' }}>
                    <div className="card-title">📅 Filter</div>
                    <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <div className="period-selector">
                            {([['expense', '↓ Ausgaben'], ['income', '↑ Einnahmen'], ['both', 'Beides']] as ['expense' | 'income' | 'both', string][]).map(([key, label]) => (
                                <button
                                    key={key}
                                    className={`period-btn ${flowType === key ? 'active' : ''}`}
                                    onClick={() => handleFlowTypeChange(key)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
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
                    <div className="card-body" style={{ paddingTop: '12px', paddingBottom: 0 }}>
                        <div className="date-range-inputs">
                            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                            <span style={{ color: 'var(--text-muted)' }}>bis</span>
                            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                        </div>
                    </div>
                )}

                {/* Category filter chips */}
                <div className="card-body" style={{ paddingTop: '16px' }}>
                    <div className="category-filters" style={{ marginBottom: 0 }}>
                        <button
                            className={`category-filter-btn ${activeCategories.length === 0 ? 'active' : ''}`}
                            onClick={() => setActiveCategories([])}
                        >
                            Alle
                        </button>
                        {availableCategories.map((cat) => (
                            <button
                                key={cat}
                                className={`category-filter-btn ${activeCategories.includes(cat) ? 'active' : ''}`}
                                onClick={() => toggleCategory(cat)}
                                style={activeCategories.includes(cat) ? {
                                    background: categoryColorMap[cat] || '#1a2e45',
                                    borderColor: categoryColorMap[cat] || '#1a2e45',
                                    color: 'white',
                                } : {}}
                            >
                                <span
                                    className="category-dot"
                                    style={{ background: categoryColorMap[cat] || '#6b7280' }}
                                />
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bar Chart Card */}
            <div className="card mb-6">
                <div className="card-header">
                    <div className="card-title">
                        {flowType === 'both' ? '📊 Einnahmen & Ausgaben pro Monat' : '📊 Nach Kategorie'}
                    </div>
                </div>

                <div className="card-body">
                    {flowType === 'both' ? (
                        groupedData.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                                Keine Buchungen im gewählten Zeitraum
                            </div>
                        ) : (
                            <div className="chart-container" style={{ height: 360 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={groupedData} margin={{ top: 8, right: 16, left: 10, bottom: 60 }} barSize={18}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} angle={-35} textAnchor="end" interval={0} />
                                        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k €`} width={55} />
                                        <Tooltip
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            formatter={(value: any, name: any) => [formatCurrency(value ?? 0), name === 'income' ? 'Einnahmen' : 'Ausgaben']}
                                            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                                            wrapperStyle={{ zIndex: 50, background: 'white', borderRadius: 8 }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} formatter={(value) => <span style={{ color: '#374151' }}>{value === 'income' ? 'Einnahmen' : 'Ausgaben'}</span>} />
                                        <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} name="income" />
                                        <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} name="expense" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )
                    ) : (
                        chartData.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                                Keine Buchungen im gewählten Zeitraum
                            </div>
                        ) : (
                            <div className="chart-container" style={{ height: 360 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 8, right: 16, left: 10, bottom: 60 }} barSize={32}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} angle={-35} textAnchor="end" interval={0} />
                                        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k €`} width={55} />
                                        <Tooltip content={<StackedTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} wrapperStyle={{ zIndex: 50, background: 'white', borderRadius: 8 }} />
                                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} formatter={(value) => <span style={{ color: '#374151' }}>{value}</span>} />
                                        {categoriesToShow.map((cat) => (
                                            <Bar key={cat} dataKey={cat} stackId="stack" fill={categoryColorMap[cat] || '#64748b'} radius={categoriesToShow[categoriesToShow.length - 1] === cat ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Summary Stats */}
            <div className="stats-grid mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <div className="stat-card" style={{ padding: '12px 16px' }}>
                    <div className="stat-card-label" style={{ color: flowType === 'income' ? 'var(--green)' : flowType === 'expense' ? 'var(--red)' : 'var(--text-muted)' }}>
                        {flowType === 'income' ? '↑ Gesamteinnahmen' : flowType === 'expense' ? '↓ Gesamtausgaben' : '⇅ Gesamt'}
                    </div>
                    <div className="stat-card-value" style={{ color: flowType === 'income' ? 'var(--green)' : flowType === 'expense' ? 'var(--red)' : 'var(--text)', fontSize: 20 }}>{formatCurrencyFull(totalExpense)}</div>
                    <div className="stat-card-sub">Im gewählten Zeitraum</div>
                </div>
                <div className="stat-card" style={{ padding: '12px 16px' }}>
                    <div className="stat-card-label">📂 Kategorien</div>
                    <div className="stat-card-value" style={{ fontSize: 20 }}>{tableData.length}</div>
                    <div className="stat-card-sub">Mit Buchungen im Zeitraum</div>
                </div>
                <div className="stat-card" style={{ padding: '12px 16px' }}>
                    <div className="stat-card-label">🧾 Buchungen</div>
                    <div className="stat-card-value" style={{ fontSize: 20 }}>{tableData.reduce((s, d) => s + d.count, 0)}</div>
                    <div className="stat-card-sub">Transaktionen im Zeitraum</div>
                </div>
                <div className="stat-card" style={{ padding: '12px 16px' }}>
                    <div className="stat-card-label">📅 Ø pro Monat</div>
                    <div className="stat-card-value" style={{ fontSize: 20 }}>{formatCurrencyFull(chartData.length > 0 ? totalExpense / chartData.length : 0)}</div>
                    <div className="stat-card-sub">Durchschnitt</div>
                </div>
            </div>

            {/* Category Table */}
            <div className="card">
                <div className="card-header">
                    <div className="card-title">📋 Detailübersicht nach Kategorie</div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Kategorie</th>
                                <th style={{ textAlign: 'right' }}>Ausgaben</th>
                                <th style={{ textAlign: 'right' }}>Buchungen</th>
                                <th style={{ textAlign: 'right' }}>Anteil</th>
                                <th style={{ textAlign: 'right', minWidth: 120 }}>Visualisierung</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.map((row) => {
                                const share = totalExpense > 0 ? (row.total / totalExpense) * 100 : 0;
                                return (
                                    <tr key={row.name}>
                                        <td>
                                            <span
                                                className="category-badge"
                                                style={{
                                                    background: `${row.color}18`,
                                                    color: row.color,
                                                }}
                                            >
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, display: 'inline-block' }} />
                                                {row.name}
                                            </span>
                                        </td>
                                        <td className="tx-amount negative" style={{ textAlign: 'right' }}>
                                            {formatCurrencyFull(row.total)}
                                        </td>
                                        <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '13px' }}>
                                            {row.count}
                                        </td>
                                        <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '13px' }}>
                                            {share.toFixed(1)}%
                                        </td>
                                        <td style={{ paddingRight: 16 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                                                <div style={{
                                                    height: 6,
                                                    width: 100,
                                                    background: '#f1f5f9',
                                                    borderRadius: 3,
                                                    overflow: 'hidden',
                                                }}>
                                                    <div style={{
                                                        height: '100%',
                                                        width: `${share}%`,
                                                        background: row.color,
                                                        borderRadius: 3,
                                                        transition: 'width 0.4s ease',
                                                    }} />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: 'var(--bg)' }}>
                                <td style={{ fontWeight: 700, padding: '12px 16px', fontSize: '14px' }}>Gesamt</td>
                                <td className="tx-amount negative" style={{ textAlign: 'right', fontWeight: 700, padding: '12px 16px' }}>
                                    {formatCurrencyFull(totalExpense)}
                                </td>
                                <td style={{ textAlign: 'right', padding: '12px 16px' }}>
                                    {tableData.reduce((s, d) => s + d.count, 0)}
                                </td>
                                <td style={{ textAlign: 'right', padding: '12px 16px' }}>100 %</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
