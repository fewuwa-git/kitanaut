'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import SignaturePad from '@/components/SignaturePad';

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

const emptyCreateForm = { name: '', email: '', password: '', role: 'member' };
const emptyEditForm = { name: '', email: '', password: '', role: 'member', strasse: '', ort: '', iban: '', steuerid: '', handynummer: '', stundensatz: 0, unterschrift: '' };

export default function AdminClient({ currentUser }: AdminClientProps) {
    const [users, setUsers] = useState<User[]>([]);

    // Create modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState(emptyCreateForm);
    const [createError, setCreateError] = useState('');
    const [createLoading, setCreateLoading] = useState(false);

    // Edit modal
    const [editUser, setEditUser] = useState<User | null>(null);
    const [editForm, setEditForm] = useState(emptyEditForm);
    const [editError, setEditError] = useState('');
    const [editLoading, setEditLoading] = useState(false);
    const [showSignaturePad, setShowSignaturePad] = useState(false);

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
            fetchUsers();
        } catch {
            setCreateError('Server-Fehler');
        } finally {
            setCreateLoading(false);
        }
    };

    // ─── Edit ─────────────────────────────────────────────────────────────────

    const openEdit = (u: User) => {
        setEditUser(u);
        setEditForm({
            name: u.name,
            email: u.email,
            password: '',
            role: u.role,
            strasse: u.strasse || '',
            ort: u.ort || '',
            iban: u.iban || '',
            steuerid: u.steuerid || '',
            handynummer: u.handynummer || '',
            stundensatz: u.stundensatz || 0,
            unterschrift: u.unterschrift || '',
        });
        setShowSignaturePad(false);
        setEditError('');
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editUser) return;
        setEditError('');
        setEditLoading(true);
        try {
            const body: Record<string, any> = {
                name: editForm.name,
                email: editForm.email,
                role: editForm.role,
            };
            if (editForm.password) body.password = editForm.password;
            if (['springerin', 'eltern', 'member'].includes(editForm.role)) {
                body.strasse = editForm.strasse;
                body.ort = editForm.ort;
                body.iban = editForm.iban;
                body.unterschrift = editForm.unterschrift;
            }
            if (editForm.role === 'springerin') {
                body.steuerid = editForm.steuerid;
                body.handynummer = editForm.handynummer;
                body.stundensatz = Number(editForm.stundensatz);
            }

            const res = await fetch(`/api/users/${editUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) { setEditError(data.error); return; }
            setEditUser(null);
            fetchUsers();
        } catch {
            setEditError('Server-Fehler');
        } finally {
            setEditLoading(false);
        }
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
        new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

    const formatDateTime = (iso: string | null | undefined) => {
        if (!iso) return 'Noch nie';
        return new Date(iso).toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    return (
        <div className="app-layout">
            <Sidebar user={currentUser} />
            <main className="main-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>{currentUser.role === 'admin' ? 'Benutzer' : 'Benutzer - Verwalte hier deine Angaben'}</h1>
                        <p>{currentUser.role === 'admin' ? 'Verwalte hier alle Benutzer' : 'Verwalte hier deine persönlichen Daten'}</p>
                    </div>
                    {currentUser.role === 'admin' && (
                        <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
                            + Neuen Benutzer anlegen
                        </button>
                    )}
                </div>

                {currentUser.role === 'admin' && <div className="card mb-6">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', alignItems: 'center', paddingBottom: '16px' }}>
                        <div className="card-title" style={{ marginBottom: 0 }}>🔍 Suchen & Filtern</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                            <div className="period-selector">
                                <input
                                    type="text"
                                    placeholder="Nach Name oder E-Mail suchen..."
                                    className="form-input"
                                    style={{ padding: '8px 12px', minWidth: '300px', margin: 0 }}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="granularity-selector">
                                <select
                                    className="form-select"
                                    style={{ padding: '8px 12px', width: '200px', margin: 0 }}
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                >
                                    <option value="all">Alle Rollen</option>
                                    <option value="admin">Finanzvorstand</option>
                                    <option value="member">Vorstandsmitglied</option>
                                    <option value="eltern">Eltern</option>
                                    <option value="springerin">Springerin</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>}

                <div className="page-body">
                    {(() => {
                        const ROLE_SECTIONS = [
                            { role: 'admin',      label: 'Finanzvorstand',    icon: '⭐' },
                            { role: 'member',     label: 'Vorstandsmitglieder', icon: '👤' },
                            { role: 'eltern',     label: 'Eltern',            icon: '👪' },
                            { role: 'springerin', label: 'Springerinnen',     icon: '🏃' },
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
                            .map(s => ({ ...s, users: visibleUsers.filter(u => u.role === s.role) }))
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
                                                <div className="user-item-avatar">{initials}</div>
                                                <div className="user-item-info">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div className="user-item-name">{u.name}</div>
                                                    </div>
                                                    <div className="user-item-email">{u.email}</div>
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                    <div>Seit {formatDate(u.created_at)}</div>
                                                    <div>Login: {formatDateTime(u.last_login_at)}</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                    {canEdit && (
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => openEdit(u)}
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
                                <label className="form-label">Passwort</label>
                                <input className="form-input" type="password" placeholder="Mindestens 6 Zeichen"
                                    value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} required minLength={6} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Rolle</label>
                                <select className="form-select" value={createForm.role}
                                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
                                    <option value="member">Vorstandsmitglied</option>
                                    <option value="admin">Finanzvorstand</option>
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

            {/* ─── Edit Modal ───────────────────────────────────────────────────── */}
            {editUser && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2 className="modal-title">Benutzer bearbeiten</h2>
                        <form onSubmit={handleEdit}>
                            <div className="form-group">
                                <label className="form-label">Name</label>
                                <input className="form-input" type="text"
                                    value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    required disabled={currentUser.role !== 'admin' && editForm.role !== 'springerin'} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">E-Mail</label>
                                <input className="form-input" type="email"
                                    value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Neues Passwort <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}>(leer lassen = unverändert)</span></label>
                                <input className="form-input" type="password" placeholder="Neues Passwort"
                                    value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} minLength={6} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Rolle</label>
                                <select className="form-select" value={editForm.role}
                                    disabled={currentUser.role !== 'admin'}
                                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                                    <option value="member">Vorstandsmitglied</option>
                                    <option value="admin">Finanzvorstand</option>
                                    <option value="eltern">Eltern</option>
                                    <option value="springerin">Springerin</option>
                                </select>
                            </div>

                            {['springerin', 'eltern', 'member'].includes(editForm.role) && (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">Straße + Hausnummer</label>
                                        <input className="form-input" type="text"
                                            value={editForm.strasse} onChange={(e) => setEditForm({ ...editForm, strasse: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">PLZ + Ort</label>
                                        <input className="form-input" type="text"
                                            value={editForm.ort} onChange={(e) => setEditForm({ ...editForm, ort: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">IBAN</label>
                                        <input className="form-input" type="text"
                                            value={editForm.iban} onChange={(e) => setEditForm({ ...editForm, iban: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Unterschrift</label>
                                        {!showSignaturePad ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                                {editForm.unterschrift ? (
                                                    <img src={editForm.unterschrift} alt="Unterschrift" style={{ maxHeight: '60px', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px', background: '#fff' }} />
                                                ) : (
                                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Noch keine Unterschrift hinterlegt</span>
                                                )}
                                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowSignaturePad(true)}>
                                                    {editForm.unterschrift ? 'Unterschrift ändern' : 'Unterschrift erstellen'}
                                                </button>
                                            </div>
                                        ) : (
                                            <SignaturePad
                                                existing={editForm.unterschrift || null}
                                                onSave={(dataUrl) => {
                                                    setEditForm({ ...editForm, unterschrift: dataUrl });
                                                    setShowSignaturePad(false);
                                                }}
                                                onCancel={() => setShowSignaturePad(false)}
                                            />
                                        )}
                                    </div>
                                </>
                            )}

                            {editForm.role === 'springerin' && (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">Steuer-ID</label>
                                        <input className="form-input" type="text"
                                            value={editForm.steuerid} onChange={(e) => setEditForm({ ...editForm, steuerid: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Handynummer</label>
                                        <input className="form-input" type="text"
                                            value={editForm.handynummer} onChange={(e) => setEditForm({ ...editForm, handynummer: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Stundensatz (€)</label>
                                        <input className="form-input" type="number" step="0.01" min="0" placeholder="0.00"
                                            value={editForm.stundensatz || ''} onChange={(e) => setEditForm({ ...editForm, stundensatz: parseFloat(e.target.value) || 0 })} />
                                    </div>
                                </>
                            )}

                            {editError && <div className="error-msg">⚠️ {editError}</div>}
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setEditUser(null)}>Abbrechen</button>
                                <button type="submit" className="btn btn-primary" disabled={editLoading}>
                                    {editLoading ? 'Speichern...' : 'Änderungen speichern'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
