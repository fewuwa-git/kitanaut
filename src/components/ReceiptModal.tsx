'use client';

import { useEffect, useRef, useState } from 'react';

function formatSize(bytes: number | null | undefined): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Receipt {
    id: string;
    file_name: string;
    file_size: number | null;
    uploaded_at: string;
    url: string | null;
}

interface ReceiptModalProps {
    transactionId: string;
    transactionLabel: string;
    onReceiptsChange?: (txId: string, hasReceipts: boolean) => void;
    onClose: () => void;
}

export default function ReceiptModal({ transactionId, transactionLabel, onReceiptsChange, onClose }: ReceiptModalProps) {
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    async function load() {
        setLoading(true);
        const res = await fetch(`/api/transactions/${transactionId}/receipts`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setReceipts(list);
        onReceiptsChange?.(transactionId, list.length > 0);
        setLoading(false);
    }

    useEffect(() => { load(); }, [transactionId]);

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        await fetch(`/api/transactions/${transactionId}/receipts`, { method: 'POST', body: fd });
        await load();
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
    }

    async function handleDelete(receiptId: string) {
        setDeletingId(receiptId);
        await fetch(`/api/transactions/${transactionId}/receipts/${receiptId}`, { method: 'DELETE' });
        await load();
        setDeletingId(null);
    }

    // Close on backdrop click
    function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
        if (e.target === e.currentTarget) onClose();
    }

    return (
        <div
            onClick={handleBackdrop}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
        >
            <div className="card" style={{ width: 480, maxWidth: '95vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                {/* Header */}
                <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div>
                        <div className="card-title" style={{ fontSize: 15 }}>📎 Belege</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }}>
                            {transactionLabel}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', lineHeight: 1 }}
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>Laden…</div>
                    ) : receipts.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>Noch keine Belege hochgeladen.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {receipts.map((r) => (
                                <div
                                    key={r.id}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--border)', background: 'var(--bg)',
                                    }}
                                >
                                    <span style={{ fontSize: 20 }}>{r.file_name.endsWith('.pdf') ? '📄' : '🖼️'}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {r.file_name}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            {new Date(r.uploaded_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            {r.file_size ? <span style={{ marginLeft: 6 }}>{formatSize(r.file_size)}</span> : null}
                                        </div>
                                    </div>
                                    {r.url && (
                                        <a
                                            href={r.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}
                                        >
                                            Öffnen ↗
                                        </a>
                                    )}
                                    <button
                                        onClick={() => handleDelete(r.id)}
                                        disabled={deletingId === r.id}
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: 'var(--red)', fontSize: 14, padding: '2px 4px',
                                            opacity: deletingId === r.id ? 0.5 : 1,
                                        }}
                                        title="Beleg löschen"
                                    >
                                        🗑
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
                    <label style={{ display: 'block' }}>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            style={{ display: 'none' }}
                            onChange={handleUpload}
                            disabled={uploading}
                        />
                        <button
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            className="btn btn-primary"
                            style={{ width: '100%', opacity: uploading ? 0.6 : 1 }}
                        >
                            {uploading ? 'Hochladen…' : '+ Beleg hochladen'}
                        </button>
                    </label>
                </div>
            </div>
        </div>
    );
}
