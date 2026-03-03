'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

interface User {
    id: string;
    name: string;
}

interface ElternUserSelectorProps {
    users: User[];
    selectedUserId?: string;
    searchName?: string;
}

export default function ElternUserSelector({ users, selectedUserId, searchName }: ElternUserSelectorProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [customSearch, setCustomSearch] = useState(searchName || '');

    useEffect(() => {
        setCustomSearch(searchName || '');
    }, [searchName]);

    function handleUserChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const params = new URLSearchParams(searchParams.toString());
        const selected = users.find(u => u.id === e.target.value);
        if (e.target.value && selected) {
            params.set('userId', e.target.value);
            params.set('searchName', selected.name);
            params.delete('customSearch');
        } else {
            params.delete('userId');
            params.delete('searchName');
            params.delete('customSearch');
        }
        router.push(`/eltern/buchungen?${params.toString()}`);
    }

    function handleSearchSubmit(e: React.FormEvent) {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        if (customSearch.trim()) {
            params.set('customSearch', customSearch.trim());
        } else {
            params.delete('customSearch');
        }
        router.push(`/eltern/buchungen?${params.toString()}`);
    }

    return (
        <div className="card mb-6">
            <div className="card-header" style={{ paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div className="card-title">👤 Eltern-Account auswählen</div>
                <select
                    className="form-input"
                    style={{ maxWidth: '300px', padding: '8px 12px' }}
                    value={selectedUserId || ''}
                    onChange={handleUserChange}
                >
                    <option value="">– Bitte auswählen –</option>
                    {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                </select>
            </div>
            {selectedUserId && (
                <div className="card-body" style={{ paddingTop: 0 }}>
                    <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            Suche nach:
                        </span>
                        <input
                            type="text"
                            className="form-input"
                            value={customSearch}
                            onChange={e => setCustomSearch(e.target.value)}
                            style={{ padding: '6px 10px', fontSize: '13px', maxWidth: '300px' }}
                            placeholder="Suchbegriff im Gegenüber-Feld..."
                        />
                        <button type="submit" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                            Suchen
                        </button>
                    </form>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                        Falls keine Buchungen gefunden werden, kann der Suchbegriff hier manuell angepasst werden.
                    </p>
                </div>
            )}
        </div>
    );
}
