'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { TransactionReceipt, Category } from '@/lib/data';
import { CATEGORY_COLORS } from '@/lib/constants';
import { fmtDate, fmtDateTime } from '@/lib/formatDate';
import LinkReceiptModal from './LinkReceiptModal';
import BelegeKiWorkflow from './BelegeKiWorkflow';
import BelegeKiSettings from './BelegeKiSettings';
import BelegeUpload from './BelegeUpload';
import ConfirmModal from './ConfirmModal';

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
    ai_vendor: string | null;
    ai_amount: number | null;
    ai_date: string | null;
    ai_description: string | null;
    ai_suggestions: Suggestion[] | null;
}

interface Suggestion {
    transaction_id: string;
    confidence: number;
    reason: string;
    transaction: { id: string; date: string; description: string; counterparty: string; amount: number; category: string };
}

interface SuggestResult {
    extracted: { vendor?: string; amount?: number; date?: string; description?: string };
    suggestions: Suggestion[];
}

interface Props {
    receipts: TransactionReceipt[];
    unlinked: UnlinkedReceipt[];
    initialTab: string;
    categories: Category[];
    kiSettingsInitial?: any;
}

export default function VerwaltungBelegeClient({ receipts: initialReceipts, unlinked: initialUnlinked, initialTab, categories, kiSettingsInitial }: Props) {
    const tab = initialTab as 'upload' | 'linked' | 'unlinked' | 'ki' | 'ki-workflow' | 'ki-settings';
    const categoryColorMap: Record<string, string> = { ...CATEGORY_COLORS };
    for (const cat of categories) categoryColorMap[cat.name] = cat.color;
    const [receipts, setReceipts] = useState(initialReceipts);
    const [unlinked, setUnlinked] = useState(initialUnlinked);
    const [search, setSearch] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'linked'; receipt: TransactionReceipt } | { type: 'unlinked'; receipt: UnlinkedReceipt } | null>(null);
    const [loadingUrl, setLoadingUrl] = useState<string | null>(null);
    const [preview, setPreview] = useState<{ url: string; fileName: string } | null>(null);

    useEffect(() => {
        function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setPreview(null); }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);
    const [infoReceipt, setInfoReceipt] = useState<TransactionReceipt | null>(null);
    const [linkModal, setLinkModal] = useState<{ id: string; fileName: string } | null>(null);
    const [suggestingId, setSuggestingId] = useState<string | null>(null);
    const [autoLinkedId, setAutoLinkedId] = useState<string | null>(null);
    const [showKiSettings, setShowKiSettings] = useState(false);
    const [kiSettings, setKiSettings] = useState<{ autoAssign: boolean; threshold: number }>({ autoAssign: false, threshold: 99 });
    const [kiSettingsDraft, setKiSettingsDraft] = useState(kiSettings);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('ki_settings');
            if (stored) {
                const parsed = JSON.parse(stored);
                setKiSettings(parsed);
                setKiSettingsDraft(parsed);
            }
        } catch {}
    }, []);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
    const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
    const [unlinkConfirm, setUnlinkConfirm] = useState<TransactionReceipt | null>(null);
    const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
    const [kiErrors, setKiErrors] = useState<Record<string, string>>({});

    const [suggestionResults, setSuggestionResults] = useState<Record<string, SuggestResult>>(() => {
        const initial: Record<string, SuggestResult> = {};
        for (const r of initialUnlinked) {
            if (r.ai_vendor || r.ai_amount != null || r.ai_date || r.ai_description || r.ai_suggestions?.length) {
                initial[r.id] = {
                    extracted: {
                        vendor: r.ai_vendor ?? undefined,
                        amount: r.ai_amount ?? undefined,
                        date: r.ai_date ?? undefined,
                        description: r.ai_description ?? undefined,
                    },
                    suggestions: r.ai_suggestions ?? [],
                };
            }
        }
        return initial;
    });
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

    function saveKiSettings(settings: { autoAssign: boolean; threshold: number }) {
        setKiSettings(settings);
        try { localStorage.setItem('ki_settings', JSON.stringify(settings)); } catch {}
        setShowKiSettings(false);
    }

    async function handleSuggest(r: UnlinkedReceipt) {
        setSuggestingId(r.id);
        try {
            const res = await fetch(`/api/receipts/${r.id}/suggest`, { method: 'POST' });
            const text = await res.text();
            const data = text ? JSON.parse(text) : {};
            if (data.suggestions) {
                const best: Suggestion | undefined = data.suggestions[0];
                const shouldAutoAssign = kiSettings.autoAssign && best && best.confidence >= kiSettings.threshold / 100;
                if (shouldAutoAssign && best) {
                    setAutoLinkedId(r.id);
                    await handleLinkSuggestion(r.id, best.transaction);
                    setAutoLinkedId(null);
                } else {
                    setSuggestionResults(prev => ({ ...prev, [r.id]: data }));
                    setUnlinked(prev => prev.map(u => u.id === r.id ? {
                        ...u,
                        ai_vendor: data.extracted?.vendor ?? null,
                        ai_amount: data.extracted?.amount ?? null,
                        ai_date: data.extracted?.date ?? null,
                        ai_description: data.extracted?.description ?? null,
                    } : u));
                }
            } else {
                const msg = (data.error ?? 'Unbekannter Fehler') + (data.raw ? `\n\nRohantwort: ${data.raw.slice(0, 300)}` : '');
                setKiErrors(prev => ({ ...prev, [r.id]: msg }));
            }
        } catch (e: any) {
            setKiErrors(prev => ({ ...prev, [r.id]: e.message }));
        } finally {
            setSuggestingId(null);
            setAutoLinkedId(null);
        }
    }

    async function handleBulkAnalyze() {
        const ids = [...selectedIds];
        if (ids.length === 0) return;
        setBulkAnalyzing(true);
        setBulkProgress({ done: 0, total: ids.length });
        setSelectedIds(new Set());
        for (let i = 0; i < ids.length; i++) {
            const receipt = unlinked.find(r => r.id === ids[i]);
            if (receipt) await handleSuggest(receipt);
            setBulkProgress({ done: i + 1, total: ids.length });
        }
        setBulkAnalyzing(false);
        setBulkProgress(null);
    }

    async function handleLinkSuggestion(receiptId: string, tx: Suggestion['transaction']) {
        await fetch(`/api/receipts/${receiptId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transaction_id: tx.id, method: 'ki' }),
        });
        handleLinked(receiptId, tx);
        setSuggestionResults(prev => { const next = { ...prev }; delete next[receiptId]; return next; });
    }

    async function handleOpenLinked(r: TransactionReceipt) {
        setLoadingUrl(r.id);
        const res = await fetch(`/api/receipts/${r.id}`);
        const data = await res.json();
        if (data.url) setPreview({ url: data.url, fileName: r.file_name });
        setLoadingUrl(null);
    }

    async function handleDeleteLinked(r: TransactionReceipt) {
        setDeleteConfirm({ type: 'linked', receipt: r });
    }

    async function handleDeleteUnlinked(r: UnlinkedReceipt) {
        setDeleteConfirm({ type: 'unlinked', receipt: r });
    }

    async function confirmUnlink() {
        if (!unlinkConfirm) return;
        const r = unlinkConfirm;
        setUnlinkingId(r.id);
        setUnlinkConfirm(null);
        const res = await fetch(`/api/receipts/${r.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ unlink: true }),
        });
        const data = await res.json();
        setReceipts(prev => prev.filter(x => x.id !== r.id));
        setUnlinked(prev => [{
            id: r.id,
            file_name: r.file_name,
            file_size: r.file_size,
            uploaded_at: r.uploaded_at,
            ai_vendor: null,
            ai_amount: null,
            ai_date: null,
            ai_description: null,
            ai_suggestions: null,
        }, ...prev]);
        setUnlinkingId(null);
    }

    async function confirmDelete() {
        if (!deleteConfirm) return;
        const r = deleteConfirm.receipt;
        setDeletingId(r.id);
        setDeleteConfirm(null);
        if (deleteConfirm.type === 'linked') {
            const linked = deleteConfirm.receipt as TransactionReceipt;
            await fetch(`/api/transactions/${linked.transaction_id}/receipts/${linked.id}`, { method: 'DELETE' });
            setReceipts(prev => prev.filter(x => x.id !== linked.id));
        } else {
            await fetch(`/api/receipts/${r.id}`, { method: 'DELETE' });
            setUnlinked(prev => prev.filter(x => x.id !== r.id));
            setSuggestionResults(prev => { const next = { ...prev }; delete next[r.id]; return next; });
        }
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
            linked_method: null,
            linked_at: null,
            linked_by: null,
            ai_invoice_number: null,
        } as TransactionReceipt, ...prev]);
        setLinkModal(null);
    }

    return (
        <div>
            {/* Tab Nav */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 24, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex' }}>
                    <a href="/verwaltung/belege?tab=upload" style={{
                        padding: '8px 20px', fontSize: 13, fontWeight: tab === 'upload' ? 600 : 500,
                        color: tab === 'upload' ? 'var(--navy)' : 'var(--text-muted)',
                        borderBottom: tab === 'upload' ? '2px solid var(--primary)' : '2px solid transparent',
                        marginBottom: -2, textDecoration: 'none', whiteSpace: 'nowrap',
                    }}>
                        Beleg hochladen
                    </a>
                    <a href="/verwaltung/belege?tab=linked" style={{
                        padding: '8px 20px', fontSize: 13, fontWeight: tab === 'linked' ? 600 : 500,
                        color: tab === 'linked' ? 'var(--navy)' : 'var(--text-muted)',
                        borderBottom: tab === 'linked' ? '2px solid var(--primary)' : '2px solid transparent',
                        marginBottom: -2, textDecoration: 'none', whiteSpace: 'nowrap',
                    }}>
                        Zugeordnete Belege {receipts.length > 0 && <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>({receipts.length})</span>}
                    </a>
                    <a href="/verwaltung/belege?tab=unlinked" style={{
                        padding: '8px 20px', fontSize: 13, fontWeight: tab === 'unlinked' ? 600 : 500,
                        color: tab === 'unlinked' ? 'var(--navy)' : (unlinked.length > 0 ? 'var(--red)' : 'var(--text-muted)'),
                        borderBottom: tab === 'unlinked' ? '2px solid var(--primary)' : '2px solid transparent',
                        marginBottom: -2, textDecoration: 'none', whiteSpace: 'nowrap',
                    }}>
                        Unzugeordnete Belege {unlinked.length > 0 && <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>({unlinked.length})</span>}
                    </a>
                    <a href="/verwaltung/belege?tab=ki" style={{
                        padding: '8px 20px', fontSize: 13, fontWeight: tab === 'ki' ? 600 : 500,
                        color: tab === 'ki' ? 'var(--navy)' : 'var(--text-muted)',
                        borderBottom: tab === 'ki' ? '2px solid var(--primary)' : '2px solid transparent',
                        marginBottom: -2, textDecoration: 'none', whiteSpace: 'nowrap',
                    }}>
                        KI-Belegfunktion
                    </a>
                </div>
                <div style={{ display: 'flex' }}>
                    <a href="/verwaltung/belege?tab=ki-workflow" style={{
                        padding: '8px 20px', fontSize: 13, fontWeight: tab === 'ki-workflow' ? 600 : 500,
                        color: tab === 'ki-workflow' ? 'var(--navy)' : 'var(--text-muted)',
                        borderBottom: tab === 'ki-workflow' ? '2px solid var(--primary)' : '2px solid transparent',
                        marginBottom: -2, textDecoration: 'none', whiteSpace: 'nowrap',
                    }}>
                        KI Workflow
                    </a>
                    <a href="/verwaltung/belege?tab=ki-settings" style={{
                        padding: '8px 20px', fontSize: 13, fontWeight: tab === 'ki-settings' ? 600 : 500,
                        color: tab === 'ki-settings' ? 'var(--navy)' : 'var(--text-muted)',
                        borderBottom: tab === 'ki-settings' ? '2px solid var(--primary)' : '2px solid transparent',
                        marginBottom: -2, textDecoration: 'none', whiteSpace: 'nowrap',
                    }}>
                        KI-Einstellungen
                    </a>
                </div>
            </div>

            {/* Stats */}
            {tab !== 'ki-workflow' && tab !== 'ki-settings' && <div className="stats-grid mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <div className="stat-card" style={{ padding: '12px 16px' }}>
                    <div className="stat-card-label">📎 Belege gesamt</div>
                    <div className="stat-card-value" style={{ fontSize: 20 }}>{receipts.length + unlinked.length}</div>
                    <div className="stat-card-sub">Hochgeladene Dateien</div>
                </div>
                <a href="/verwaltung/belege?tab=linked" className="stat-card" style={{ padding: '12px 16px', textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    <div className="stat-card-label">🔗 Zugeordnet</div>
                    <div className="stat-card-value" style={{ fontSize: 20 }}>{receipts.length}</div>
                    <div className="stat-card-sub">Mit Buchung verknüpft</div>
                </a>
                <a href="/verwaltung/belege?tab=unlinked" className="stat-card" style={{ padding: '12px 16px', textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    <div className="stat-card-label" style={{ color: unlinked.length > 0 ? 'var(--red)' : 'var(--text-muted)' }}>⚠️ Nicht zugeordnet</div>
                    <div className="stat-card-value" style={{ fontSize: 20, color: unlinked.length > 0 ? 'var(--red)' : 'var(--text)' }}>{unlinked.length}</div>
                    <div className="stat-card-sub">Noch keine Buchung</div>
                </a>
                <div className="stat-card" style={{ padding: '12px 16px' }}>
                    <div className="stat-card-label">💾 Gesamtgröße</div>
                    <div className="stat-card-value" style={{ fontSize: 20 }}>
                        {formatSize([...receipts, ...unlinked].reduce((s, r) => s + (r.file_size || 0), 0))}
                    </div>
                    <div className="stat-card-sub">Speicherverbrauch</div>
                </div>
            </div>}

            {/* Tab: Beleg hochladen */}
            {tab === 'upload' && (
                <BelegeUpload onUploaded={r => setUnlinked(prev => [r, ...prev])} />
            )}

            {/* Tab: Unzugeordnete Belege */}
            {tab === 'unlinked' && (
            <div className="card mb-6">
                <div className="card-header">
                    <div className="card-title">⚠️ Nicht zugeordnete Belege</div>
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
                                    <th>Buchung zuordnen</th>
                                    <th style={{ textAlign: 'right' }}>Größe</th>
                                    <th style={{ width: '1%', whiteSpace: 'nowrap' }}>Hochgeladen am</th>
                                    <th style={{ width: '1%' }} />
                                </tr>
                            </thead>
                            <tbody>
                                {unlinked.map(r => (
                                    <tr key={r.id}>
                                        <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                                            <button
                                                onClick={async () => {
                                                    const res = await fetch(`/api/receipts/${r.id}`);
                                                    const data = await res.json();
                                                    if (data.url) setPreview({ url: data.url, fileName: r.file_name });
                                                }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: 'inherit' }}
                                                title="Öffnen"
                                            >
                                                <span>{r.file_name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}</span>
                                                <span style={{ fontSize: 13 }}>{r.file_name}</span>
                                            </button>
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => setLinkModal({ id: r.id, fileName: r.file_name })}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                    padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                                                    border: '1px dashed var(--border)', background: 'var(--bg)',
                                                    cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)',
                                                    whiteSpace: 'nowrap', minWidth: 360, justifyContent: 'flex-start',
                                                }}
                                            >
                                                <span style={{ opacity: 0.5 }}>🔗</span>
                                                <span>Buchung wählen…</span>
                                            </button>
                                        </td>
                                        <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {formatSize(r.file_size)}
                                        </td>
                                        <td style={{ whiteSpace: 'nowrap', fontSize: 13, color: 'var(--text-muted)' }}>
                                            {fmtDateTime(r.uploaded_at)}
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => handleDeleteUnlinked(r)}
                                                disabled={deletingId === r.id}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--red)', padding: '2px 4px', opacity: deletingId === r.id ? 0.5 : 1 }}
                                                title="PDF unwiderruflich löschen (Datei wird aus dem Speicher entfernt)"
                                            >
                                                🗑
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            )}

            {/* Tab: KI-Belegfunktion */}
            {tab === 'ki' && (
            <div className="card mb-6">
                <div className="card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="card-title">✨ KI-Beleganalyse</div>
                        {kiSettings.autoAssign && (
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#d1fae5', color: '#065f46', fontWeight: 600 }}>
                                Auto-Zuordnung ab {kiSettings.threshold}%
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {bulkProgress && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {bulkProgress.done}/{bulkProgress.total} analysiert…
                            </span>
                        )}
                        {selectedIds.size > 0 && !bulkAnalyzing && (
                            <button
                                className="btn btn-primary"
                                onClick={handleBulkAnalyze}
                                style={{ fontSize: 12, padding: '5px 12px' }}
                            >
                                ✨ {selectedIds.size} analysieren
                            </button>
                        )}
                        <button
                            className="btn"
                            onClick={() => { setKiSettingsDraft(kiSettings); setShowKiSettings(true); }}
                            style={{ fontSize: 12, padding: '5px 12px' }}
                        >
                            ⚙ KI Einstellungen
                        </button>
                    </div>
                </div>
                {unlinked.length === 0 ? (
                    <div className="card-body" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                        Keine unzugeordneten Belege vorhanden.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '1%' }}>
                                        <input
                                            type="checkbox"
                                            checked={unlinked.length > 0 && selectedIds.size === unlinked.length}
                                            ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < unlinked.length; }}
                                            onChange={e => setSelectedIds(e.target.checked ? new Set(unlinked.map(r => r.id)) : new Set())}
                                            title="Alle auswählen"
                                        />
                                    </th>
                                    <th>Dateiname</th>
                                    <th>KI-Analyse</th>
                                    <th style={{ textAlign: 'right' }}>Größe</th>
                                    <th style={{ width: '1%', whiteSpace: 'nowrap' }}>Hochgeladen am</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unlinked.map(r => (
                                    <React.Fragment key={r.id}>
                                        <tr>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(r.id)}
                                                    onChange={e => setSelectedIds(prev => {
                                                        const next = new Set(prev);
                                                        if (e.target.checked) next.add(r.id); else next.delete(r.id);
                                                        return next;
                                                    })}
                                                    disabled={bulkAnalyzing}
                                                />
                                            </td>
                                            <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                                                <button
                                                    onClick={async () => {
                                                        const res = await fetch(`/api/receipts/${r.id}`);
                                                        const data = await res.json();
                                                        if (data.url) setPreview({ url: data.url, fileName: r.file_name });
                                                    }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: 'inherit' }}
                                                    title="Öffnen"
                                                >
                                                    <span>{r.file_name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}</span>
                                                    <span style={{ fontSize: 13 }}>{r.file_name}</span>
                                                </button>
                                            </td>
                                            <td>
                                                <button
                                                    onClick={() => handleSuggest(r)}
                                                    disabled={suggestingId === r.id}
                                                    title="KI-Vorschlag generieren"
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 5,
                                                        padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                                                        border: '1px solid var(--border)', background: 'var(--bg)',
                                                        cursor: suggestingId === r.id ? 'default' : 'pointer',
                                                        fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap',
                                                        opacity: suggestingId === r.id ? 0.6 : 1,
                                                    }}
                                                >
                                                    <span>{suggestingId === r.id ? '⏳' : '✨'}</span>
                                                    <span>{autoLinkedId === r.id ? 'Zuordnen…' : suggestingId === r.id ? 'Analysiere…' : (suggestionResults[r.id] ? 'Neu analysieren' : 'KI-Vorschlag')}</span>
                                                </button>
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                {formatSize(r.file_size)}
                                            </td>
                                            <td style={{ whiteSpace: 'nowrap', fontSize: 13, color: 'var(--text-muted)' }}>
                                                {fmtDateTime(r.uploaded_at)}
                                            </td>
                                        </tr>

                                        {/* KI-Vorschläge */}
                                        {kiErrors[r.id] && (
                                            <tr key={`${r.id}-error`}>
                                                <td colSpan={5} style={{ padding: '0 16px 12px', background: 'var(--bg)' }}>
                                                    <div style={{ borderRadius: 'var(--radius-sm)', border: '1px solid #fca5a5', background: '#fef2f2', padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                                        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: 12, fontWeight: 600, color: '#b91c1c', marginBottom: 4 }}>KI-Analyse fehlgeschlagen</div>
                                                            <div style={{ fontSize: 12, color: '#7f1d1d', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{kiErrors[r.id]}</div>
                                                        </div>
                                                        <button onClick={() => setKiErrors(prev => { const n = { ...prev }; delete n[r.id]; return n; })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontSize: 14, padding: '0 2px', flexShrink: 0 }}>✕</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        {suggestionResults[r.id] && (
                                            <tr key={`${r.id}-suggestions`}>
                                                <td colSpan={5} style={{ padding: '0 16px 12px', background: 'var(--bg)' }}>
                                                    <div style={{ borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                                        {/* Extracted info */}
                                                        {(() => {
                                                            const ex = suggestionResults[r.id].extracted;
                                                            const hasData = ex.vendor || ex.amount != null || ex.date || ex.description;
                                                            const filenameNums = (r.file_name.match(/\d{4,}/g) || []);
                                                            return (
                                                                <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderBottom: suggestionResults[r.id].suggestions.length > 0 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12, alignItems: 'center' }}>
                                                                    <span style={{ color: 'var(--text-muted)' }}>✨ KI-Analyse:</span>
                                                                    {ex.vendor && <span><strong>Aussteller:</strong> {ex.vendor}</span>}
                                                                    {ex.amount != null && <span><strong>Betrag:</strong> {formatCurrency(ex.amount!)}</span>}
                                                                    {ex.date && <span><strong>Datum:</strong> {fmtDate(ex.date!)}</span>}
                                                                    {ex.description && <span><strong>Zweck:</strong> {ex.description}</span>}
                                                                    {!hasData && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Beleginhalt nicht lesbar</span>}
                                                                    {!hasData && filenameNums.length > 0 && <span><strong>Nummer aus Dateiname:</strong> {filenameNums.join(', ')}</span>}
                                                                    <button onClick={() => setSuggestionResults(prev => { const next = { ...prev }; delete next[r.id]; return next; })} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>✕</button>
                                                                </div>
                                                            );
                                                        })()}
                                                        {/* Suggestions */}
                                                        {suggestionResults[r.id].suggestions.length === 0 && (
                                                            <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                                                                Keine passende Buchung gefunden – bitte manuell zuordnen.
                                                            </div>
                                                        )}
                                                        {suggestionResults[r.id].suggestions.map((s, i) => (
                                                            <div key={s.transaction_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < suggestionResults[r.id].suggestions.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                                                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0, color: s.confidence > 0.8 ? 'var(--green)' : 'var(--text-muted)' }}>
                                                                    {Math.round(s.confidence * 100)}%
                                                                </div>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                        {fmtDate(s.transaction.date)} · {s.transaction.counterparty || s.transaction.description}
                                                                        <span className={`tx-amount ${s.transaction.amount >= 0 ? 'positive' : 'negative'}`} style={{ marginLeft: 8 }}>
                                                                            {(s.transaction.amount >= 0 ? '+' : '') + formatCurrency(s.transaction.amount)}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{s.reason}</div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleLinkSuggestion(r.id, s.transaction)}
                                                                    className="btn btn-primary"
                                                                    style={{ fontSize: 12, padding: '5px 12px', whiteSpace: 'nowrap' }}
                                                                >
                                                                    Zuordnen
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            )}

            {/* Tab: KI Workflow */}
            {tab === 'ki-workflow' && <BelegeKiWorkflow />}
            {tab === 'ki-settings' && kiSettingsInitial && <BelegeKiSettings initial={kiSettingsInitial} />}

            {/* Tab: Zugeordnete Belege */}
            {tab === 'linked' && (
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
                                        {r.transaction_date ? fmtDate(r.transaction_date) : '–'}
                                    </td>
                                    <td style={{ fontSize: 13, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        <span title={r.transaction_description}>{r.transaction_description || '–'}</span>
                                    </td>
                                    <td style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {r.transaction_counterparty || '–'}
                                    </td>
                                    <td style={{ fontSize: 13 }}>
                                        <span className="category-badge" style={{ fontSize: 11, background: `${categoryColorMap[r.transaction_category] || '#6b7280'}18`, color: categoryColorMap[r.transaction_category] || '#6b7280' }}>{r.transaction_category || '–'}</span>
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
                                    <td style={{ whiteSpace: 'nowrap', fontSize: 13, color: 'var(--text-muted)' }}>
                                        {fmtDateTime(r.uploaded_at)}
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                            <button
                                                onClick={() => setInfoReceipt(r)}
                                                title="Zuordnungsinfo"
                                                className="btn"
                                                style={{ fontSize: 13, padding: '4px 7px' }}
                                            >
                                                ℹ
                                            </button>
                                            <button
                                                onClick={() => handleOpenLinked(r)}
                                                disabled={loadingUrl === r.id}
                                                className="btn btn-sm"
                                                style={{ padding: '4px 10px', backgroundColor: 'var(--navy)', color: 'white', opacity: loadingUrl === r.id ? 0.5 : 1 }}
                                            >
                                                {loadingUrl === r.id ? '…' : '📄 PDF'}
                                            </button>
                                            <button
                                                onClick={() => setUnlinkConfirm(r)}
                                                disabled={unlinkingId === r.id}
                                                title="Zuordnung trennen (Beleg bleibt erhalten)"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px', opacity: unlinkingId === r.id ? 0.5 : 1, color: 'var(--text-muted)' }}
                                            >
                                                🔗
                                            </button>
                                            <button
                                                onClick={() => handleDeleteLinked(r)}
                                                disabled={deletingId === r.id}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--red)', padding: '2px 4px', opacity: deletingId === r.id ? 0.5 : 1 }}
                                                title="PDF unwiderruflich löschen (Datei wird aus dem Speicher entfernt)"
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
            )}

            {infoReceipt && (
                <div onClick={() => setInfoReceipt(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div onClick={e => e.stopPropagation()} className="card" style={{ width: 440, padding: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>Zuordnungsinfo</span>
                            <button onClick={() => setInfoReceipt(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', lineHeight: 1 }}>✕</button>
                        </div>
                        <div style={{ padding: '20px' }}>
                            {/* Datei */}
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                                {infoReceipt.file_name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'} {infoReceipt.file_name}
                            </div>

                            {/* Methode */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                <span style={{
                                    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                    background: infoReceipt.linked_method === 'ki' ? '#ede9fe' : '#dbeafe',
                                    color: infoReceipt.linked_method === 'ki' ? '#6d28d9' : '#1d4ed8',
                                }}>
                                    {infoReceipt.linked_method === 'ki' ? '✨ KI-Zuordnung' : infoReceipt.linked_method === 'manual' ? '🔗 Manuell' : '–'}
                                </span>
                                {infoReceipt.linked_at && (
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        {fmtDateTime(infoReceipt.linked_at)} Uhr
                                    </span>
                                )}
                            </div>

                            {/* Von wem */}
                            {infoReceipt.linked_by && (
                                <div style={{ fontSize: 13, marginBottom: 16 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Zugeordnet von: </span>
                                    <strong>{infoReceipt.linked_by}</strong>
                                </div>
                            )}

                            {/* KI-Daten wenn vorhanden */}
                            {infoReceipt.linked_method === 'ki' && (
                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>KI-EXTRAHIERTE BELEGDATEN</div>
                                    {infoReceipt.ai_vendor || infoReceipt.ai_amount != null || infoReceipt.ai_date || infoReceipt.ai_description ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {infoReceipt.ai_vendor && <div style={{ fontSize: 13 }}><span style={{ color: 'var(--text-muted)', minWidth: 100, display: 'inline-block' }}>Aussteller</span><strong>{infoReceipt.ai_vendor}</strong></div>}
                                            {infoReceipt.ai_amount != null && <div style={{ fontSize: 13 }}><span style={{ color: 'var(--text-muted)', minWidth: 100, display: 'inline-block' }}>Betrag</span><strong>{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(infoReceipt.ai_amount)}</strong></div>}
                                            {infoReceipt.ai_date && <div style={{ fontSize: 13 }}><span style={{ color: 'var(--text-muted)', minWidth: 100, display: 'inline-block' }}>Datum</span><strong>{fmtDate(infoReceipt.ai_date)}</strong></div>}
                                            {infoReceipt.ai_description && <div style={{ fontSize: 13 }}><span style={{ color: 'var(--text-muted)', minWidth: 100, display: 'inline-block' }}>Zweck</span><strong>{infoReceipt.ai_description}</strong></div>}
                                            {infoReceipt.ai_invoice_number && <div style={{ fontSize: 13 }}><span style={{ color: 'var(--text-muted)', minWidth: 100, display: 'inline-block' }}>Rechnungs-Nr.</span><strong>{infoReceipt.ai_invoice_number}</strong></div>}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                            Beleginhalt nicht lesbar – Zuordnung über Nummer aus Dateiname
                                            {(() => { const nums = infoReceipt.file_name.match(/\d{4,}/g); return nums ? ` (${nums.join(', ')})` : ''; })()}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Kein Linking-Info vorhanden */}
                            {!infoReceipt.linked_method && !infoReceipt.linked_at && (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    Keine Zuordnungsinfo verfügbar (vor Einführung dieser Funktion zugeordnet).
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showKiSettings && (
                <div onClick={() => setShowKiSettings(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div onClick={e => e.stopPropagation()} className="card" style={{ width: 460, padding: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>⚙ KI Einstellungen</span>
                            <button onClick={() => setShowKiSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', lineHeight: 1 }}>✕</button>
                        </div>
                        <div style={{ padding: '20px' }}>

                            {/* Auto-Assign Toggle */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>Automatische Zuordnung</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Beleg wird automatisch der besten Buchung zugeordnet, wenn der Confidence-Score den Schwellenwert erreicht.</div>
                                </div>
                                <button
                                    onClick={() => setKiSettingsDraft(prev => ({ ...prev, autoAssign: !prev.autoAssign }))}
                                    style={{
                                        marginLeft: 16, flexShrink: 0,
                                        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                                        background: kiSettingsDraft.autoAssign ? 'var(--primary)' : 'var(--border)',
                                        position: 'relative', transition: 'background 0.2s',
                                    }}
                                >
                                    <span style={{
                                        position: 'absolute', top: 3, borderRadius: '50%', width: 18, height: 18, background: 'white',
                                        left: kiSettingsDraft.autoAssign ? 23 : 3, transition: 'left 0.2s',
                                    }} />
                                </button>
                            </div>

                            {/* Threshold */}
                            <div style={{ opacity: kiSettingsDraft.autoAssign ? 1 : 0.4, transition: 'opacity 0.2s' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>Confidence-Schwellenwert</div>
                                    <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', minWidth: 52, textAlign: 'right' }}>{kiSettingsDraft.threshold}%</span>
                                </div>
                                <input
                                    type="range"
                                    min={50} max={100} step={1}
                                    value={kiSettingsDraft.threshold}
                                    disabled={!kiSettingsDraft.autoAssign}
                                    onChange={e => setKiSettingsDraft(prev => ({ ...prev, threshold: Number(e.target.value) }))}
                                    style={{ width: '100%', accentColor: 'var(--navy)', marginBottom: 8 }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                                    <span>50% – unsicher</span>
                                    <span>99–100% – sehr sicher</span>
                                </div>
                                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, color: '#1d4ed8' }}>
                                    <strong>Hinweis:</strong> Bei Rechnungsnummer-Übereinstimmung vergibt die KI automatisch 99%. Exakte Betragsübereinstimmung ergibt mindestens 85%.
                                    {kiSettingsDraft.autoAssign && <> Bei einem Schwellenwert von <strong>{kiSettingsDraft.threshold}%</strong> wird der Beleg sofort zugeordnet, ohne manuelle Bestätigung.</>}
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn" onClick={() => setShowKiSettings(false)} style={{ fontSize: 13 }}>Abbrechen</button>
                            <button className="btn btn-primary" onClick={() => saveKiSettings(kiSettingsDraft)} style={{ fontSize: 13 }}>Speichern</button>
                        </div>
                    </div>
                </div>
            )}

            {preview && (
                <div
                    onClick={() => setPreview(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}
                >
                    <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 900, height: '85vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 12 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.fileName}</span>
                            <a href={preview.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={{ padding: '4px 10px', backgroundColor: 'var(--navy)', color: 'white', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                                Extern öffnen ↗
                            </a>
                            <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', lineHeight: 1 }}>✕</button>
                        </div>
                        {preview.fileName.toLowerCase().endsWith('.pdf') ? (
                            <iframe src={preview.url} style={{ flex: 1, border: 'none', width: '100%' }} title={preview.fileName} />
                        ) : (
                            <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                                <img src={preview.url} alt={preview.fileName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            </div>
                        )}
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={!!deleteConfirm}
                title="Beleg löschen"
                message={deleteConfirm ? `„${deleteConfirm.receipt.file_name}" wird unwiderruflich gelöscht.` : ''}
                confirmLabel="Löschen"
                confirmClass="btn-danger"
                isLoading={!!deletingId}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirm(null)}
            />

            <ConfirmModal
                isOpen={!!unlinkConfirm}
                title="Zuordnung trennen"
                message={unlinkConfirm ? `Die Verknüpfung zwischen „${unlinkConfirm.file_name}" und der Buchung wird aufgehoben. Die Datei bleibt erhalten und erscheint unter „Unzugeordnete Belege".` : ''}
                confirmLabel="Trennen"
                confirmClass="btn-primary"
                isLoading={!!unlinkingId}
                onConfirm={confirmUnlink}
                onCancel={() => setUnlinkConfirm(null)}
            />

            {linkModal && (
                <LinkReceiptModal
                    receiptId={linkModal.id}
                    fileName={linkModal.fileName}
                    linkedTransactionIds={new Set(receipts.map(r => r.transaction_id).filter(Boolean) as string[])}
                    onLinked={handleLinked}
                    onClose={() => setLinkModal(null)}
                />
            )}
        </div>
    );
}
