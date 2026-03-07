'use client';

import { useEffect, useMemo, useState } from 'react';

interface Transaction {
    id: string;
    date: string;
    description: string;
    counterparty: string;
    amount: number;
    category: string;
}

interface LinkReceiptModalProps {
    receiptId: string;
    fileName: string;
    onLinked: (receiptId: string, tx: Transaction) => void;
    onClose: () => void;
}

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(amount);
}

export default function LinkReceiptModal({ receiptId, fileName, onLinked, onClose }: LinkReceiptModalProps) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [linkingId, setLinkingId] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/transactions')
            .then(r => r.json())
            .then(data => { setTransactions(Array.isArray(data) ? data : []); setLoading(false); });
    }, []);

    useEffect(() => {
        function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const filtered = useMemo(() => {
        if (!search.trim()) return transactions.slice(0, 50);
        const term = search.toLowerCase();
        return transactions.filter(t =>
            t.description.toLowerCase().includes(term) ||
            t.counterparty.toLowerCase().includes(term) ||
            t.category.toLowerCase().includes(term) ||
            t.date.includes(term)
        ).slice(0, 50);
    }, [transactions, search]);

    async function handleLink(tx: Transaction) {
        setLinkingId(tx.id);
        await fetch(`/api/receipts/${receiptId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transaction_id: tx.id, method: 'manual' }),
        });
        onLinked(receiptId, tx);
    }

    function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
        if (e.target === e.currentTarget) onClose();
    }

    return (
        <div
            onClick={handleBackdrop}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
            <div className="card" style={{ width: 600, maxWidth: '95vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                {/* Header */}
                <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div>
                        <div className="card-title" style={{ fontSize: 15 }}>🔗 Buchung zuordnen</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            {fileName}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', lineHeight: 1 }}>✕</button>
                </div>

                {/* Search */}
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                    <input
                        autoFocus
                        type="text"
                        placeholder="Beschreibung, Gegenüber oder Kategorie suchen…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', padding: '8px 12px' }}
                    />
                </div>

                {/* List */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>Laden…</div>
                    ) : filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>Keine Buchungen gefunden.</div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '1%', whiteSpace: 'nowrap' }}>Datum</th>
                                    <th>Beschreibung</th>
                                    <th>Gegenüber</th>
                                    <th style={{ textAlign: 'right' }}>Betrag</th>
                                    <th style={{ width: '1%' }} />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(tx => (
                                    <tr key={tx.id} style={{ cursor: 'pointer' }} onClick={() => !linkingId && handleLink(tx)}>
                                        <td style={{ whiteSpace: 'nowrap', fontSize: 13, color: 'var(--text-muted)' }}>
                                            {new Date(tx.date).toLocaleDateString('de-DE')}
                                        </td>
                                        <td style={{ fontSize: 13, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {tx.description}
                                        </td>
                                        <td style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {tx.counterparty}
                                        </td>
                                        <td className={`tx-amount ${tx.amount >= 0 ? 'positive' : 'negative'}`} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            {(tx.amount >= 0 ? '+' : '') + formatCurrency(tx.amount)}
                                        </td>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            <button
                                                disabled={!!linkingId}
                                                style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', opacity: linkingId === tx.id ? 0.5 : 1, whiteSpace: 'nowrap' }}
                                            >
                                                {linkingId === tx.id ? 'Zuordnen…' : 'Zuordnen →'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                {!loading && (
                    <div style={{ padding: '8px 20px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                        {search ? `${filtered.length} Treffer` : `Letzte 50 Buchungen – Suchfeld nutzen um zu filtern`}
                    </div>
                )}
            </div>
        </div>
    );
}
