'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    status?: string;
    strasse?: string;
    ort?: string;
    iban?: string;
    steuerid?: string;
    handynummer?: string;
    stundensatz?: number;
    unterschrift?: string;
    created_at: string;
    last_login_at?: string | null;
}

interface CurrentUser {
    name: string;
    email: string;
    role: string;
}

interface AdminClientProps {
    currentUser: CurrentUser;
}

const emptyCreateForm = { name: '', email: '', role: 'member' };

export default function AdminClient({ currentUser }: AdminClientProps) {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);

    // Create modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState(emptyCreateForm);
    const [createError, setCreateError] = useState('');
    const [createLoading, setCreateLoading] = useState(false);
    const [inviteLink, setInviteLink] = useState('');
    const [inviteCopied, setInviteCopied] = useState(false);
    const [inviteUserId, setInviteUserId] = useState('');
    const [inviteSending, setInviteSending] = useState(false);
    const [inviteSent, setInviteSent] = useState(false);

    // Filter and Search
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');

    const fetchUsers = async () => {
        const res = await fetch('/api/users');
        if (res.ok) setUsers(await res.json());
    };

    useEffect(() => { fetchUsers(); }, []);

    // ─── Create ───────────────────────────────────────────────────────────────

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError('');
        setCreateLoading(true);
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(createForm),
            });
            const data = await res.json();
            if (!res.ok) { setCreateError(data.error); return; }
            setShowCreateModal(false);
            setCreateForm(emptyCreateForm);
            setInviteLink(data.inviteUrl || '');
            setInviteUserId(data.id || '');
            setInviteCopied(false);
            setInviteSent(false);
            fetchUsers();
        } catch {
            setCreateError('Server-Fehler');
        } finally {
            setCreateLoading(false);
        }
    };

    const handleCopyInviteLink = async () => {
        if (!inviteLink) return;
        await navigator.clipboard.writeText(inviteLink);
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2000);
    };

    const handleSendInvite = async () => {
        if (!inviteUserId) return;
        setInviteSending(true);
        try {
            await fetch(`/api/users/${inviteUserId}/send-invite`, { method: 'POST' });
            setInviteSent(true);
        } finally {
            setInviteSending(false);
        }
    };

    // ─── Approve pending user ─────────────────────────────────────────────────

    const [approveRole, setApproveRole] = useState<Record<string, string>>({});

    const handleApprove = async (id: string, name: string) => {
        const role = approveRole[id] || 'member';
        if (!confirm(`Benutzer „${name}" als ${role} freischalten?`)) return;
        const res = await fetch(`/api/users/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'active', role }),
        });
        if (res.ok) fetchUsers();
    };

    const handleReject = async (id: string, name: string) => {
        if (!confirm(`Anfrage von „${name}" ablehnen und Account löschen?`)) return;
        const res = await fetch(`/api/users/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'inactive' }),
        });
        if (res.ok) fetchUsers();
    };

    // ─── Delete ───────────────────────────────────────────────────────────────

    const handleToggleStatus = async (id: string, name: string, currentStatus: string | undefined) => {
        const newStatus = currentStatus === 'inactive' ? 'active' : 'inactive';
        const action = newStatus === 'active' ? 'aktivieren' : 'deaktivieren';
        if (!confirm(`Benutzer „${name}“ wirklich ${action}?`)) return;
        const res = await fetch(`/api/users/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        });
        if (res.ok) fetchUsers();
    };

    // ─── Helpers ──────────────────────────────────────────────────────────────

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

    const formatDateTime = (iso: string | null | undefined) => {
        if (!iso) return 'Noch nie';
        return new Date(iso).toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });
    };

    return (
        <div className="app-layout">
            <Sidebar user={currentUser} />
            <main className="main-content">
                <div className="page-body">
                {currentUser.role === 'admin' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>Neuen Benutzer anlegen</button>
                    </div>
                )}
                {currentUser.role === 'admin' && (() => {
                    const pending = users.filter(u => u.status === 'pending');
                    if (pending.length === 0) return null;
                    return (
                        <div className="card mb-6" style={{ borderLeft: '4px solid #f59e0b' }}>
                            <div className="card-header" style={{ paddingBottom: '12px' }}>
                                <div className="card-title" style={{ marginBottom: 0 }}>⏳ Ausstehende Registrierungen ({pending.length})</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {pending.map(u => (
                                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '12px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                        <div style={{ flex: 1, minWidth: '200px' }}>
                                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{u.name}</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{u.email}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Registriert: {formatDate(u.created_at)}</div>
                                        </div>
                                        <select
                                            className="form-select"
                                            style={{ padding: '6px 10px', width: '180px', margin: 0 }}
                                            value={approveRole[u.id] || 'member'}
                                            onChange={(e) => setApproveRole({ ...approveRole, [u.id]: e.target.value })}
                                        >
                                            <option value="member">Vorstandsmitglied</option>
                                            <option value="admin">Admin</option>
                                            <option value="finanzvorstand">Finanzvorstand</option>
                                            <option value="eltern">Eltern</option>
                                            <option value="springerin">Springerin</option>
                                        </select>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button className="btn btn-primary btn-sm" onClick={() => handleApprove(u.id, u.name)}>
                                                Freischalten
                                            </button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleReject(u.id, u.name)}>
                                                Ablehnen
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}

                {currentUser.role === 'admin' && <div className="card mb-6">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', alignItems: 'center', paddingBottom: '16px' }}>
                        <div className="card-title" style={{ marginBottom: 0 }}>🔍 Suchen & Filtern</div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                                type="text"
                                placeholder="Nach Name oder E-Mail suchen..."
                                className="form-input"
                                style={{ padding: '8px 12px', width: '260px', margin: 0 }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <select
                                className="form-select"
                                style={{ padding: '8px 12px', width: '180px', margin: 0 }}
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                            >
                                <option value="all">Alle Rollen</option>
                                <option value="admin">Admin</option>
                                <option value="finanzvorstand">Finanzvorstand</option>
                                <option value="member">Vorstandsmitglied</option>
                                <option value="eltern">Eltern</option>
                                <option value="springerin">Springerin</option>
                            </select>
                        </div>
                    </div>
                </div>}

                    {(() => {
                        const ROLE_SECTIONS = [
                            { role: 'admin',          label: 'Admin',               icon: '⭐' },
                            { role: 'finanzvorstand', label: 'Finanzvorstand',       icon: '💰' },
                            { role: 'member',         label: 'Vorstandsmitglieder',  icon: '👤' },
                            { role: 'eltern',         label: 'Eltern',               icon: '👪' },
                            { role: 'springerin',     label: 'Springerinnen',        icon: '🏃' },
                        ];

                        const visibleUsers = users
                            .filter(u => {
                                if (currentUser.role !== 'admin') return u.email === currentUser.email;
                                return true;
                            })
                            .filter(u => {
                                const matchesSearch =
                                    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    u.email.toLowerCase().includes(searchQuery.toLowerCase());
                                const matchesRole = roleFilter === 'all' || u.role === roleFilter;
                                return matchesSearch && matchesRole;
                            });

                        const sections = ROLE_SECTIONS
                            .map(s => ({ ...s, users: visibleUsers.filter(u => u.role === s.role).sort((a, b) => a.name.localeCompare(b.name, 'de')) }))
                            .filter(s => s.users.length > 0);

                        if (sections.length === 0) {
                            return (
                                <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                                    Keine Benutzer gefunden.
                                </div>
                            );
                        }

                        return sections.map((section, sIdx) => (
                            <div key={section.role} style={{ marginBottom: sIdx < sections.length - 1 ? '2rem' : 0 }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    marginBottom: '0.75rem',
                                }}>
                                    <span style={{ fontSize: '16px' }}>{section.icon}</span>
                                    <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--navy)' }}>
                                        {section.label}
                                    </span>
                                    <span style={{
                                        background: 'var(--bg)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '20px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        color: 'var(--text-muted)',
                                        padding: '1px 8px',
                                    }}>
                                        {section.users.length}
                                    </span>
                                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                                </div>
                                <div className="user-list">
                                    {section.users.map((u) => {
                                        const initials = u.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
                                        const isMe = u.email === currentUser.email;
                                        const canEdit = currentUser.role === 'admin' || isMe;
                                        return (
                                            <div key={u.id} className="user-item" style={{ opacity: u.status === 'inactive' ? 0.6 : 1 }}>
                                                <div className="user-item-avatar hide-mobile">{initials}</div>
                                                <div className="user-item-info">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div className="user-item-name">{u.name}</div>
                                                        {u.status === 'invited' && (
                                                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#b45309', background: '#fef3c7', borderRadius: '20px', padding: '1px 8px', border: '1px solid #fcd34d' }}>
                                                                Eingeladen
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="user-item-email">{u.email}</div>
                                                </div>
                                                <div className="hide-mobile" style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                    <div>Seit {formatDate(u.created_at)}</div>
                                                    <div>Login: {formatDateTime(u.last_login_at)}</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                    {canEdit && (
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => router.push(`/user/${u.id}/edit`)}
                                                        >
                                                            Bearbeiten
                                                        </button>
                                                    )}
                                                    {currentUser.role === 'admin' && !isMe && (
                                                        <button
                                                            className={`btn btn-sm ${u.status === 'inactive' ? 'btn-secondary' : 'btn-danger'}`}
                                                            onClick={() => handleToggleStatus(u.id, u.name, u.status)}
                                                        >
                                                            {u.status === 'inactive' ? 'Aktivieren' : 'Deaktivieren'}
                                                        </button>
                                                    )}
                                                    {isMe && (
                                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Du</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ));
                    })()}
                </div>
            </main>

            {/* ─── Create Modal ─────────────────────────────────────────────────── */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2 className="modal-title">Neuen Benutzer anlegen</h2>
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label className="form-label">Name</label>
                                <input className="form-input" type="text" placeholder="Max Mustermann"
                                    value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">E-Mail</label>
                                <input className="form-input" type="email" placeholder="max@example.de"
                                    value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Rolle</label>
                                <select className="form-select" value={createForm.role}
                                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
                                    <option value="member">Vorstandsmitglied</option>
                                    <option value="admin">Admin</option>
                                    <option value="finanzvorstand">Finanzvorstand</option>
                                    <option value="eltern">Eltern</option>
                                    <option value="springerin">Springerin</option>
                                </select>
                            </div>
                            {createError && <div className="error-msg">⚠️ {createError}</div>}
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Abbrechen</button>
                                <button type="submit" className="btn btn-primary" disabled={createLoading}>
                                    {createLoading ? 'Erstellen...' : 'Benutzer erstellen'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Invite Link Modal ────────────────────────────────────────────── */}
            {inviteLink && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2 className="modal-title">Benutzer angelegt</h2>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                            Möchtest du eine Einladungs-E-Mail senden? Du kannst den Link auch manuell weitergeben.
                        </p>
                        <div style={{
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '12px',
                            fontSize: '13px',
                            wordBreak: 'break-all',
                            marginBottom: '16px',
                            color: 'var(--navy)',
                        }}>
                            {inviteLink}
                        </div>
                        {inviteSent && (
                            <p style={{ fontSize: '13px', color: 'var(--success, green)', marginBottom: '12px' }}>
                                Einladungs-E-Mail wurde gesendet.
                            </p>
                        )}
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleCopyInviteLink}
                            >
                                {inviteCopied ? '✓ Kopiert!' : 'Link kopieren'}
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleSendInvite}
                                disabled={inviteSending || inviteSent}
                            >
                                {inviteSending ? 'Sende...' : inviteSent ? '✓ E-Mail gesendet' : 'E-Mail senden'}
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => setInviteLink('')}
                            >
                                Schließen
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
