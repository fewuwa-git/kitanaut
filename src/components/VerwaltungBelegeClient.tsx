'use client';

import { useRef, useState, useMemo } from 'react';
import type { TransactionReceipt } from '@/lib/data';
import LinkReceiptModal from './LinkReceiptModal';

function formatSize(bytes: number | null | undefined): string {
    if (!bytes) return '–';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(amount);
}

interface UnlinkedReceipt {
    id: string;
    file_name: string;
    file_size: number | null;
    uploaded_at: string;
}

interface Props {
    receipts: TransactionReceipt[];
    unlinked: UnlinkedReceipt[];
}

export default function VerwaltungBelegeClient({ receipts: initialReceipts, unlinked: initialUnlinked }: Props) {
    const [receipts, setReceipts] = useState(initialReceipts);
    const [unlinked, setUnlinked] = useState(initialUnlinked);
    const [search, setSearch] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [loadingUrl, setLoadingUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [linkModal, setLinkModal] = useState<{ id: string; fileName: string } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const filtered = useMemo(() => {
        if (!search.trim()) return receipts;
        const term = search.toLowerCase();
        return receipts.filter(r =>
            r.transaction_description.toLowerCase().includes(term) ||
            r.transaction_counterparty.toLowerCase().includes(term) ||
            r.transaction_category.toLowerCase().includes(term) ||
            r.file_name.toLowerCase().includes(term)
        );
    }, [receipts, search]);

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/receipts', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.id) setUnlinked(prev => [data, ...prev]);
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
    }

    async function handleOpenLinked(r: TransactionReceipt) {
        setLoadingUrl(r.id);
        const res = await fetch(`/api/transactions/${r.transaction_id}/receipts`);
        const data = await res.json();
        const found = Array.isArray(data) ? data.find((x: any) => x.id === r.id) : null;
        if (found?.url) window.open(found.url, '_blank');
        setLoadingUrl(null);
    }

    async function handleDeleteLinked(r: TransactionReceipt) {
        if (!confirm(`Beleg „${r.file_name}" wirklich löschen?`)) return;
        setDeletingId(r.id);
        await fetch(`/api/transactions/${r.transaction_id}/receipts/${r.id}`, { method: 'DELETE' });
        setReceipts(prev => prev.filter(x => x.id !== r.id));
        setDeletingId(null);
    }

    async function handleDeleteUnlinked(r: UnlinkedReceipt) {
        if (!confirm(`Beleg „${r.file_name}" wirklich löschen?`)) return;
        setDeletingId(r.id);
        await fetch(`/api/receipts/${r.id}`, { method: 'DELETE' });
        setUnlinked(prev => prev.filter(x => x.id !== r.id));
        setDeletingId(null);
    }

    function handleLinked(receiptId: string, tx: { id: string; date: string; description: string; counterparty: string; amount: number; category: string }) {
        const receipt = unlinked.find(r => r.id === receiptId);
        if (!receipt) return;
        setUnlinked(prev => prev.filter(r => r.id !== receiptId));
        setReceipts(prev => [{
            ...receipt,
            transaction_id: tx.id,
            file_path: '',
            transaction_date: tx.date,
            transaction_description: tx.description,
            transaction_counterparty: tx.counterparty,
            transaction_amount: tx.amount,
            transaction_category: tx.category,
        }, ...prev]);
        setLinkModal(null);
    }

    return (
        <div>
            {/* Stats */}
            <div className="stats-grid mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <div className="stat-card" style={{ padding: '12px 16px' }}>
                    <div className="stat-card-label">📎 Belege gesamt</div>
                    <div className="stat-card-value" style={{ fontSize: 20 }}>{receipts.length + unlinked.length}</div>
                    <div className="stat-card-sub">Hochgeladene Dateien</div>
                </div>
                <div className="stat-card" style={{ padding: '12px 16px' }}>
                    <div className="stat-card-label">🔗 Zugeordnet</div>
                    <div className="stat-card-value" style={{ fontSize: 20 }}>{receipts.length}</div>
                    <div className="stat-card-sub">Mit Buchung verknüpft</div>
                </div>
                <div className="stat-card" style={{ padding: '12px 16px' }}>
                    <div className="stat-card-label" style={{ color: unlinked.length > 0 ? 'var(--red)' : 'var(--text-muted)' }}>⚠️ Nicht zugeordnet</div>
                    <div className="stat-card-value" style={{ fontSize: 20, color: unlinked.length > 0 ? 'var(--red)' : 'var(--text)' }}>{unlinked.length}</div>
                    <div className="stat-card-sub">Noch keine Buchung</div>
                </div>
                <div className="stat-card" style={{ padding: '12px 16px' }}>
                    <div className="stat-card-label">💾 Gesamtgröße</div>
                    <div className="stat-card-value" style={{ fontSize: 20 }}>
                        {formatSize([...receipts, ...unlinked].reduce((s, r) => s + (r.file_size || 0), 0))}
                    </div>
                    <div className="stat-card-sub">Speicherverbrauch</div>
                </div>
            </div>

            {/* Unlinked Receipts */}
            <div className="card mb-6">
                <div className="card-header" style={{ justifyContent: 'space-between' }}>
                    <div className="card-title">⚠️ Nicht zugeordnete Belege</div>
                    <div>
                        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
                        <button
                            className="btn btn-primary"
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            style={{ opacity: uploading ? 0.6 : 1 }}
                        >
                            {uploading ? 'Hochladen…' : '+ Beleg hochladen'}
                        </button>
                    </div>
                </div>
                {unlinked.length === 0 ? (
                    <div className="card-body" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                        Alle Belege sind einer Buchung zugeordnet.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Dateiname</th>
                                    <th style={{ textAlign: 'right' }}>Größe</th>
                                    <th style={{ width: '1%', whiteSpace: 'nowrap' }}>Hochgeladen am</th>
                                    <th style={{ width: '1%' }} />
                                </tr>
                            </thead>
                            <tbody>
                                {unlinked.map(r => (
                                    <tr key={r.id}>
                                        <td style={{ fontSize: 13 }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span>{r.file_name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}</span>
                                                <span>{r.file_name}</span>
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {formatSize(r.file_size)}
                                        </td>
                                        <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-muted)' }}>
                                            {new Date(r.uploaded_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                <button
                                                    onClick={() => setLinkModal({ id: r.id, fileName: r.file_name })}
                                                    style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}
                                                >
                                                    🔗 Buchung zuordnen
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUnlinked(r)}
                                                    disabled={deletingId === r.id}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--red)', padding: '2px 4px', opacity: deletingId === r.id ? 0.5 : 1 }}
                                                    title="Löschen"
                                                >
                                                    🗑
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Linked Receipts */}
            <div className="card">
                <div className="card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div className="card-title">📎 Zugeordnete Belege</div>
                    <input
                        type="text"
                        placeholder="Suchen…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="form-input"
                        style={{ padding: '8px 12px', width: 240 }}
                    />
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: '1%', whiteSpace: 'nowrap' }}>Buchungsdatum</th>
                                <th>Beschreibung</th>
                                <th>Gegenüber</th>
                                <th>Kategorie</th>
                                <th style={{ textAlign: 'right' }}>Betrag</th>
                                <th>Dateiname</th>
                                <th style={{ textAlign: 'right' }}>Größe</th>
                                <th style={{ width: '1%', whiteSpace: 'nowrap' }}>Hochgeladen am</th>
                                <th style={{ width: '1%' }} />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                                        {search ? 'Keine Belege gefunden.' : 'Noch keine zugeordneten Belege.'}
                                    </td>
                                </tr>
                            ) : filtered.map(r => (
                                <tr key={r.id}>
                                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 13 }}>
                                        {r.transaction_date ? new Date(r.transaction_date).toLocaleDateString('de-DE') : '–'}
                                    </td>
                                    <td style={{ fontSize: 13, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        <span title={r.transaction_description}>{r.transaction_description || '–'}</span>
                                    </td>
                                    <td style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {r.transaction_counterparty || '–'}
                                    </td>
                                    <td style={{ fontSize: 13 }}>
                                        <span className="category-badge" style={{ fontSize: 11 }}>{r.transaction_category || '–'}</span>
                                    </td>
                                    <td className={`tx-amount ${r.transaction_amount >= 0 ? 'positive' : 'negative'}`} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                        {(r.transaction_amount >= 0 ? '+' : '') + formatCurrency(r.transaction_amount)}
                                    </td>
                                    <td style={{ fontSize: 13 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span>{r.file_name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}</span>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }} title={r.file_name}>{r.file_name}</span>
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        {formatSize(r.file_size)}
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-muted)' }}>
                                        {new Date(r.uploaded_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                            <button
                                                onClick={() => handleOpenLinked(r)}
                                                disabled={loadingUrl === r.id}
                                                style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', opacity: loadingUrl === r.id ? 0.5 : 1, whiteSpace: 'nowrap' }}
                                            >
                                                Öffnen ↗
                                            </button>
                                            <button
                                                onClick={() => handleDeleteLinked(r)}
                                                disabled={deletingId === r.id}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--red)', padding: '2px 4px', opacity: deletingId === r.id ? 0.5 : 1 }}
                                                title="Löschen"
                                            >
                                                🗑
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {linkModal && (
                <LinkReceiptModal
                    receiptId={linkModal.id}
                    fileName={linkModal.fileName}
                    onLinked={handleLinked}
                    onClose={() => setLinkModal(null)}
                />
            )}
        </div>
    );
}
