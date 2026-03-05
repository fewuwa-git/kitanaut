'use client';

import { useMemo, useState, useCallback } from 'react';
import { useFilterState, PeriodKey } from '@/hooks/useFilterState';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';

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

type Granularity = 'day' | 'week' | 'month';

const CATEGORY_COLORS: Record<string, string> = {
    'Elternbeiträge': '#22c55e',
    'Fördermittel Senat': '#3b82f6',
    'Spenden': '#a855f7',
    'Sonstige Einnahmen': '#f97316',
    'Miete': '#ef4444',
    'Personal': '#f43f5e',
    'Lebensmittel': '#eab308',
    'Bastelmaterial': '#06b6d4',
    'Versicherungen': '#8b5cf6',
    'Strom & Gas': '#f97316',
    'Reinigung': '#14b8a6',
    'Verwaltung': '#64748b',
    'Reparaturen': '#78716c',
};

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
    }).format(amount);
}

function formatDate(dateStr: string, granularity: Granularity): string {
    if (granularity === 'week') {
        const m = dateStr.match(/W(\d+)/);
        return m ? `KW ${parseInt(m[1])}` : dateStr;
    }
    const d = new Date(dateStr);
    if (granularity === 'month') {
        return d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
    }
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function getWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
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
        const customS = new Date(customStart);
        customS.setHours(0, 0, 0, 0);
        const customE = new Date(customEnd);
        customE.setHours(23, 59, 59, 999);
        return { start: customS, end: customE };
    }
    return { start, end };
}

function getCompareDateRange(period: PeriodKey): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date();
    const end = new Date();
    if (period === '30d') {
        start.setDate(now.getDate() - 60);
        end.setDate(now.getDate() - 30);
    } else if (period === '6m') {
        start.setMonth(now.getMonth() - 12);
        end.setMonth(now.getMonth() - 6);
    } else if (period === '12m') {
        start.setFullYear(now.getFullYear() - 2);
        end.setFullYear(now.getFullYear() - 1);
    } else {
        start.setMonth(start.getMonth() - 12);
    }
    return { start, end };
}

function aggregateByGranularity(
    transactions: Transaction[],
    start: Date,
    end: Date,
    granularity: Granularity
): { key: string; label: string; balance: number; income: number; expense: number }[] {
    const filtered = transactions
        .filter((t) => {
            const d = new Date(t.date);
            return d >= start && d <= end;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const map = new Map<string, { income: number; expense: number; balance: number; lastBalance: number }>();

    for (const tx of filtered) {
        const d = new Date(tx.date);
        let key: string;
        if (granularity === 'month') {
            key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        } else if (granularity === 'week') {
            key = `${d.getFullYear()}-W${String(getWeek(d)).padStart(2, '0')}`;
        } else {
            key = tx.date;
        }

        const existing = map.get(key) || { income: 0, expense: 0, balance: 0, lastBalance: 0 };
        if (tx.amount > 0) existing.income += tx.amount;
        else existing.expense += Math.abs(tx.amount);
        existing.lastBalance = tx.balance;
        map.set(key, existing);
    }

    const result = Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => ({
            key,
            label: formatDate(key, granularity),
            balance: val.lastBalance,
            income: val.income,
            expense: val.expense,
        }));

    return result;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ value: number; name: string; color: string }>;
    label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
    if (!active || !payload || payload.length === 0) return null;
    return (
        <div style={{
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            boxShadow: 'var(--shadow-md)',
            fontSize: '13px',
        }}>
            <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{label}</p>
            {payload.map((p) => (
                <p key={p.name} style={{ color: p.color, margin: '2px 0' }}>
                    {p.name}: {formatCurrency(p.value)}
                </p>
            ))}
        </div>
    );
}

interface DashboardClientProps {
    transactions: Transaction[];
}

export default function DashboardClient({ transactions }: DashboardClientProps) {
    const { period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd } = useFilterState('6m');
    const [granularity, setGranularity] = useState<Granularity>('month');
    const [compare, setCompare] = useState(false);

    const { start, end } = useMemo(() => getDateRange(period, customStart, customEnd), [period, customStart, customEnd]);
    const compareRange = useMemo(() => getCompareDateRange(period), [period]);

    const currentData = useMemo(
        () => aggregateByGranularity(transactions, start, end, granularity),
        [transactions, start, end, granularity]
    );

    const compareData = useMemo(
        () => compare ? aggregateByGranularity(transactions, compareRange.start, compareRange.end, granularity) : [],
        [transactions, compare, compareRange, granularity]
    );

    // Merge compare data into chart data by index
    const chartData = useMemo(() => {
        const maxLen = Math.max(currentData.length, compareData.length);
        return Array.from({ length: maxLen }, (_, i) => ({
            label: currentData[i]?.label || compareData[i]?.label || '',
            kontostand: currentData[i]?.balance,
            vergleich: compareData[i]?.balance,
        }));
    }, [currentData, compareData]);

    // Stats for current period
    const stats = useMemo(() => {
        const periodTx = transactions.filter((t) => {
            const d = new Date(t.date);
            return d >= start && d <= end;
        });
        const income = periodTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
        const expense = periodTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
        const latestBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : 0;
        return { income, expense, net: income - expense, balance: latestBalance };
    }, [transactions, start, end]);

    // Recent transactions
    const recentTx = useMemo(() => {
        return [...transactions]
            .filter((t) => new Date(t.date) >= start && new Date(t.date) <= end)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 15);
    }, [transactions, start, end]);

    const handlePeriodChange = useCallback((p: PeriodKey) => {
        setPeriod(p);
        if (p !== 'custom') {
            setCustomStart('');
            setCustomEnd('');
        }
    }, []);

    return (
        <div>
            {/* Filter Card */}
            <div className="card mb-6">
                <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
                    <div className="card-title">📅 Filter</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
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

                        {/* Granularity */}
                        <div className="granularity-selector">
                            {(['day', 'week', 'month'] as Granularity[]).map((g) => (
                                <button
                                    key={g}
                                    className={`gran-btn ${granularity === g ? 'active' : ''}`}
                                    onClick={() => setGranularity(g)}
                                >
                                    {g === 'day' ? 'Tag' : g === 'week' ? 'Woche' : 'Monat'}
                                </button>
                            ))}
                        </div>

                        {/* Compare */}
                        <div className="compare-toggle" onClick={() => setCompare(!compare)}>
                            <div className={`toggle-switch ${compare ? 'on' : ''}`} />
                            Vergleich
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

            {/* Hero Balance */}
            <div className="hero-card">
                <div className="hero-label">Aktueller Kontostand</div>
                <div className="hero-balance">
                    <span>€</span> {stats.balance.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className={`hero-trend ${stats.net >= 0 ? 'positive' : 'negative'}`}>
                    {stats.net >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(stats.net))} im Zeitraum
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
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
                <div className="stat-card">
                    <div className="stat-card-label">
                        <span>⇆</span> Netto
                    </div>
                    <div className="stat-card-value" style={{ color: stats.net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {formatCurrency(stats.net)}
                    </div>
                    <div className="stat-card-sub">Einnahmen minus Ausgaben</div>
                </div>
            </div>

            {/* Chart Card */}
            <div className="card mb-6">
                <div className="card-header">
                    <div className="card-title">📈 Kontostandsverlauf</div>
                </div>

                <div className="card-body">
                    <div className="chart-container" style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
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
                                    tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                {compare && <Legend />}
                                <Line
                                    type="monotone"
                                    dataKey="kontostand"
                                    name="Kontostand"
                                    stroke="#1a2e45"
                                    strokeWidth={2.5}
                                    dot={false}
                                    activeDot={{ r: 5, fill: '#1a2e45' }}
                                />
                                {compare && (
                                    <Line
                                        type="monotone"
                                        dataKey="vergleich"
                                        name="Vorperiode"
                                        stroke="#fecb2f"
                                        strokeWidth={2}
                                        strokeDasharray="5 5"
                                        dot={false}
                                        activeDot={{ r: 4, fill: '#fecb2f' }}
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="card">
                <div className="card-header">
                    <div className="card-title">🔄 Letzte Bewegungen</div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: '1%', whiteSpace: 'nowrap' }}>Datum</th>
                                <th>Beschreibung</th>
                                <th style={{ width: '1%', whiteSpace: 'nowrap' }}>Gegenüber</th>
                                <th style={{ width: '1%', whiteSpace: 'nowrap' }}>Kategorie</th>
                                <th style={{ width: '1%', whiteSpace: 'nowrap', textAlign: 'right' }}>Betrag</th>
                                <th style={{ width: '1%', whiteSpace: 'nowrap', textAlign: 'right' }}>Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentTx.map((tx) => (
                                <tr key={tx.id}>
                                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '13px' }}>
                                        {new Date(tx.date).toLocaleDateString('de-DE')}
                                    </td>
                                    <td style={{ width: 200, maxWidth: 200 }}>
                                        <div title={tx.description} style={{ fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {tx.description}
                                        </div>
                                    </td>
                                    <td style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        {tx.counterparty}
                                    </td>
                                    <td style={{ fontSize: '13px' }}>
                                        <span
                                            className="category-badge"
                                            style={{
                                                background: `${CATEGORY_COLORS[tx.category] || '#6b7280'}18`,
                                                color: CATEGORY_COLORS[tx.category] || '#6b7280',
                                            }}
                                        >
                                            {tx.category}
                                        </span>
                                    </td>
                                    <td className={`tx-amount ${tx.amount >= 0 ? 'positive' : 'negative'}`} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                        {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 500, whiteSpace: 'nowrap', fontSize: '13px' }}>
                                        {formatCurrency(tx.balance)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
