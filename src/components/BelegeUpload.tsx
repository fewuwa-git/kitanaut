'use client';

import { useRef, useState, useCallback } from 'react';

interface UploadItem {
    localId: string;
    file: File;
    status: 'pending' | 'uploading' | 'done' | 'error' | 'duplicate';
    error?: string;
    duplicateInfo?: { file_name: string; uploaded_at: string };
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';
const ACCEPT_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

interface Props {
    onUploaded: (receipt: any) => void;
}

export default function BelegeUpload({ onUploaded }: Props) {
    const [queue, setQueue] = useState<UploadItem[]>([]);
    const [dragging, setDragging] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const addFiles = useCallback((files: File[]) => {
        const valid = files.filter(f => ACCEPT_MIME.includes(f.type));
        if (!valid.length) return;
        const items: UploadItem[] = valid.map(file => ({
            localId: crypto.randomUUID(),
            file,
            status: 'pending',
        }));
        setQueue(prev => [...prev, ...items]);
        // Start uploading immediately
        items.forEach(item => uploadFile(item));
    }, []);

    async function uploadFile(item: UploadItem) {
        setQueue(prev => prev.map(q => q.localId === item.localId ? { ...q, status: 'uploading' } : q));
        try {
            const fd = new FormData();
            fd.append('file', item.file);
            const res = await fetch('/api/receipts', { method: 'POST', body: fd });
            const data = await res.json();
            if (res.status === 409 && data.duplicate) {
                setQueue(prev => prev.map(q => q.localId === item.localId ? { ...q, status: 'duplicate', duplicateInfo: data.existing } : q));
            } else if (data.id) {
                setQueue(prev => prev.map(q => q.localId === item.localId ? { ...q, status: 'done' } : q));
                onUploaded({ ...data, ai_vendor: null, ai_amount: null, ai_date: null, ai_description: null, ai_suggestions: null });
            } else {
                setQueue(prev => prev.map(q => q.localId === item.localId ? { ...q, status: 'error', error: data.error ?? 'Unbekannter Fehler' } : q));
            }
        } catch (e: any) {
            setQueue(prev => prev.map(q => q.localId === item.localId ? { ...q, status: 'error', error: e.message } : q));
        }
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        addFiles(files);
        if (fileRef.current) fileRef.current.value = '';
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragging(false);
        addFiles(Array.from(e.dataTransfer.files));
    }

    function handleDragOver(e: React.DragEvent) {
        e.preventDefault();
        setDragging(true);
    }

    function removeItem(localId: string) {
        setQueue(prev => prev.filter(q => q.localId !== localId));
    }

    function clearDone() {
        setQueue(prev => prev.filter(q => q.status !== 'done' && q.status !== 'duplicate'));
    }

    const counts = {
        total: queue.length,
        done: queue.filter(q => q.status === 'done').length,
        uploading: queue.filter(q => q.status === 'uploading').length,
        error: queue.filter(q => q.status === 'error').length,
        duplicate: queue.filter(q => q.status === 'duplicate').length,
        pending: queue.filter(q => q.status === 'pending').length,
    };

    return (
        <div>
            {/* Drop Zone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={() => setDragging(false)}
                onClick={() => fileRef.current?.click()}
                style={{
                    border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    background: dragging ? 'var(--primary-light)' : 'var(--card)',
                    padding: '48px 32px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, background 0.15s',
                    marginBottom: 24,
                    textAlign: 'center',
                }}
            >
                <div style={{ fontSize: 36, lineHeight: 1 }}>📎</div>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>
                    Dateien hierher ziehen oder klicken
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    PDF, JPG, PNG, WebP – mehrere Dateien gleichzeitig möglich
                </div>
                <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPT}
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleInputChange}
                />
            </div>

            {/* Queue */}
            {queue.length > 0 && (
                <div className="card">
                    <div className="card-header" style={{ justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <span className="card-title">Upload-Warteschlange</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {counts.done}/{counts.total} fertig
                                {counts.uploading > 0 && ` · ${counts.uploading} läuft`}
                                {counts.duplicate > 0 && <span style={{ color: '#b45309' }}> · {counts.duplicate} Duplikat{counts.duplicate > 1 ? 'e' : ''}</span>}
                                {counts.error > 0 && <span style={{ color: 'var(--red)' }}> · {counts.error} Fehler</span>}
                            </span>
                        </div>
                        {(counts.done > 0 || counts.duplicate > 0) && (
                            <button
                                onClick={clearDone}
                                className="btn"
                                style={{ fontSize: 12, padding: '4px 10px' }}
                            >
                                Erledigte entfernen
                            </button>
                        )}
                    </div>

                    {/* Progress bar */}
                    {counts.total > 0 && (
                        <div style={{ height: 3, background: 'var(--border)', margin: '0 0 1px' }}>
                            <div style={{
                                height: '100%',
                                width: `${((counts.done + counts.duplicate + counts.error) / counts.total) * 100}%`,
                                background: counts.error > 0 ? 'var(--red)' : counts.duplicate > 0 ? '#f59e0b' : 'var(--primary)',
                                transition: 'width 0.3s',
                                borderRadius: 2,
                            }} />
                        </div>
                    )}

                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Dateiname</th>
                                <th style={{ textAlign: 'right' }}>Größe</th>
                                <th style={{ width: 120 }}>Status</th>
                                <th style={{ width: '1%' }} />
                            </tr>
                        </thead>
                        <tbody>
                            {queue.map(item => (
                                <tr key={item.localId}>
                                    <td style={{ fontSize: 13 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span>{item.file.name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}</span>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>{item.file.name}</span>
                                        </span>
                                    </td>
                                    <td style={{ fontSize: 13, textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        {formatSize(item.file.size)}
                                    </td>
                                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                                        {item.status === 'pending' && <span style={{ color: 'var(--text-muted)' }}>Wartend…</span>}
                                        {item.status === 'uploading' && (
                                            <span style={{ color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--navy)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
                                                Hochladen…
                                            </span>
                                        )}
                                        {item.status === 'done' && <span style={{ color: 'var(--green)', fontWeight: 500 }}>✓ Fertig</span>}
                                        {item.status === 'duplicate' && (
                                            <span style={{ color: '#b45309', fontWeight: 500 }} title={item.duplicateInfo ? `Bereits hochgeladen als „${item.duplicateInfo.file_name}"` : 'Bereits vorhanden'}>
                                                ⚠ Bereits vorhanden
                                            </span>
                                        )}
                                        {item.status === 'error' && (
                                            <span style={{ color: 'var(--red)' }} title={item.error}>✗ Fehler</span>
                                        )}
                                    </td>
                                    <td>
                                        {(item.status === 'done' || item.status === 'error') && (
                                            <button
                                                onClick={() => removeItem(item.localId)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', padding: '2px 4px' }}
                                                title="Entfernen"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {counts.done + counts.duplicate + counts.error === counts.total && counts.total > 0 && counts.error === 0 && counts.done > 0 && (
                        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 500 }}>
                                Alle {counts.total} {counts.total === 1 ? 'Datei' : 'Dateien'} erfolgreich hochgeladen.
                            </span>
                            <a href="/verwaltung/belege?tab=unlinked" className="btn btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}>
                                Zu unzugeordneten Belegen →
                            </a>
                        </div>
                    )}
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
