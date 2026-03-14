'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface SidebarProps {
    user: { name: string; email: string; role: string };
}

type NavItem = { href: string; icon: string; label: string; roles?: string[] };
type NavGroup = { section: string; items: NavItem[] };

const NAV_ITEMS: NavGroup[] = [
    {
        section: 'CHAT',
        items: [
            { href: '/chat', icon: '💬', label: 'Chat', roles: ['admin', 'finanzvorstand', 'member'] },
        ],
    },
    {
        section: 'ÜBERSICHT',
        items: [
            { href: '/dashboard', icon: '📊', label: 'Kontostand', roles: ['admin', 'finanzvorstand', 'member'] },
            { href: '/kontoauszug', icon: '📝', label: 'Kontoauszug', roles: ['admin', 'finanzvorstand', 'member'] },
            { href: '/categories', icon: '📂', label: 'Kategorien', roles: ['admin', 'finanzvorstand', 'member'] },
            { href: '/dashboard/springerin', icon: '👩‍🏫', label: 'Springerin', roles: ['admin', 'finanzvorstand', 'member'] },
        ],
    },
    {
        section: 'SPRINGERIN',
        items: [
            { href: '/springerin/abrechnung', icon: '🧾', label: 'Abrechnung', roles: ['admin', 'finanzvorstand', 'springerin'] },
        ],
    },
    {
        section: 'ELTERN',
        items: [
            { href: '/eltern/belege', icon: '🧾', label: 'Meine Belege', roles: ['eltern', 'teammitglied', 'finanzvorstand', 'member', 'admin'] },
            { href: '/eltern/buchungen', icon: '📒', label: 'Meine Buchungen', roles: ['eltern', 'teammitglied', 'finanzvorstand', 'member', 'admin'] },
        ],
    },
    {
        section: 'UPLOAD',
        items: [
            { href: '/upload', icon: '⬆️', label: 'Neuer Upload', roles: ['admin', 'finanzvorstand'] },
        ],
    },
    {
        section: 'BUCHHALTUNG',
        items: [
            { href: '/verwaltung/belege', icon: '📎', label: 'Buchungsbelege', roles: ['admin', 'finanzvorstand'] },
        ],
    },
    {
        section: 'VERWALTUNG',
        items: [
            { href: '/user', icon: '👥', label: 'Benutzer', roles: ['admin', 'finanzvorstand', 'springerin', 'teammitglied', 'eltern', 'member'] },
            { href: '/verwaltung/kategorien', icon: '🏷️', label: 'Kategorien', roles: ['admin', 'finanzvorstand'] },
            { href: '/verwaltung/emails', icon: '✉️', label: 'E-Mails', roles: ['admin'] },
            { href: '/verwaltung/zugriffsrechte', icon: '🔐', label: 'Zugriffsrechte', roles: ['admin'] },
        ],
    },
];

const COLLAPSIBLE_SECTIONS = ['VERWALTUNG'];

const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    finanzvorstand: 'Finanzvorstand',
    member: 'Vorstandsmitglied',
    springerin: 'Springer*in',
    teammitglied: 'Teammitglied',
    eltern: 'Eltern',
};

interface ImpersonationUser { id: string; name: string; role: string; }
interface ImpersonationState { impersonating: boolean; impersonatedUser: ImpersonationUser | null; users: ImpersonationUser[]; }

function ImpersonationWidget() {
    const router = useRouter();
    const [state, setState] = useState<ImpersonationState | null>(null);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch('/api/impersonate')
            .then(r => r.ok ? r.json() : null)
            .then(data => setState(data))
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (!open) return;
        setSearch('');
        setTimeout(() => searchRef.current?.focus(), 50);
        function handleClick(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    if (!state) return null;

    async function refreshState() {
        const data = await fetch('/api/impersonate').then(r => r.ok ? r.json() : null);
        setState(data);
    }

    async function impersonate(u: ImpersonationUser) {
        setLoading(true);
        await fetch('/api/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: u.id }) });
        await refreshState();
        setLoading(false);
        setOpen(false);
        router.refresh();
    }

    async function reset() {
        setLoading(true);
        await fetch('/api/impersonate', { method: 'DELETE' });
        await refreshState();
        setLoading(false);
        setOpen(false);
        router.refresh();
    }

    const filtered = state.users
        .filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || (ROLE_LABELS[u.role] ?? u.role).toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name, 'de'));

    const isImpersonating = state.impersonating;

    return (
        <div ref={dropdownRef} style={{ position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '4px', background: isImpersonating ? '#7c3aed' : 'transparent', transition: 'background 0.2s' }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    background: 'transparent',
                    border: 'none',
                    color: isImpersonating ? '#e9d5ff' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                    textAlign: 'left',
                    transition: 'background 0.2s',
                }}
                onMouseEnter={e => { if (!isImpersonating) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { if (!isImpersonating) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
                <span style={{ fontSize: '13px' }}>👁</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isImpersonating ? `Ansicht: ${state.impersonatedUser?.name}` : 'Ansicht wechseln'}
                </span>
                {isImpersonating && (
                    <span
                        onClick={e => { e.stopPropagation(); reset(); }}
                        style={{ fontSize: '10px', opacity: 0.7, cursor: 'pointer', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.15)' }}
                    >
                        ✕
                    </span>
                )}
                <span style={{ fontSize: '9px', opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
            </button>

            {open && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: '#1a2e45',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    zIndex: 200,
                    overflow: 'hidden',
                }}>
                    <div style={{ padding: '8px' }}>
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Name suchen …"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '5px 8px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                        {filtered.length === 0 && <div style={{ padding: '10px 12px', opacity: 0.5, fontSize: '12px', color: '#fff' }}>Keine Treffer</div>}
                        {filtered.map(u => (
                            <button
                                key={u.id}
                                onClick={() => impersonate(u)}
                                disabled={loading}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: state.impersonatedUser?.id === u.id ? 'rgba(124,58,237,0.4)' : 'transparent', border: 'none', color: '#fff', padding: '8px 12px', cursor: loading ? 'wait' : 'pointer', fontSize: '12px', textAlign: 'left', gap: '8px' }}
                                onMouseEnter={e => { if (state.impersonatedUser?.id !== u.id) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; }}
                                onMouseLeave={e => { if (state.impersonatedUser?.id !== u.id) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                            >
                                <span style={{ fontWeight: 500 }}>{u.name}</span>
                                <span style={{ opacity: 0.5, fontSize: '11px', whiteSpace: 'nowrap' }}>{ROLE_LABELS[u.role] ?? u.role}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function MobilePageTitle() {
    const [title, setTitle] = useState('');
    useEffect(() => {
        const raw = document.title || '';
        setTitle(raw.split('|')[0].trim());
    }, []);
    if (!title) return null;
    return <span className="mobile-header-title">{title}</span>;
}

export default function Sidebar({ user }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(COLLAPSIBLE_SECTIONS));

    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    function toggleSection(section: string) {
        setCollapsedSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) next.delete(section);
            else next.add(section);
            return next;
        });
    }

    async function handleLogout() {
        await fetch('/api/auth', { method: 'DELETE' });
        router.push('/login');
        router.refresh();
    }

    const initials = user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

    return (
        <>
            <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(false)} />

            <div className="mobile-header">
                <button className="mobile-menu-btn" onClick={() => setIsOpen(true)}>
                    <span style={{ fontSize: '24px' }}>☰</span>
                </button>
                <MobilePageTitle />
            </div>

            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
                <ImpersonationWidget />

                <div className="sidebar-logo">
                    <img src="/logo.png" alt="Pankonauten Logo" className="sidebar-logo-icon" />
                    <div className="sidebar-logo-text">
                        <span className="name">Pankonauten</span>
                        <span className="subtitle">Finanz-Dashboard</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {NAV_ITEMS.map((group) => {
                        const visibleItems = group.items.filter(item => {
                            if (!item.roles) return true;
                            return item.roles.includes(user.role);
                        });

                        if (visibleItems.length === 0) return null;

                        const isCollapsible = user.role === 'admin' && COLLAPSIBLE_SECTIONS.includes(group.section);
                        const isCollapsed = isCollapsible && collapsedSections.has(group.section);

                        return (
                            <div key={group.section}>
                                <div
                                    className="sidebar-section-label"
                                    onClick={isCollapsible ? () => toggleSection(group.section) : undefined}
                                    style={isCollapsible ? { cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' } : undefined}
                                >
                                    {group.section}
                                    {isCollapsible && <span style={{ fontSize: '10px', opacity: 0.6 }}>{isCollapsed ? '▶' : '▼'}</span>}
                                </div>
                                {!isCollapsed && visibleItems.map((item) => (
                                    <a
                                        key={item.href}
                                        href={item.href}
                                        className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                                    >
                                        <span style={{ fontSize: '16px' }}>{item.icon}</span>
                                        {item.label}
                                    </a>
                                ))}
                            </div>
                        );
                    })}
                </nav>

                <div className="sidebar-bottom">
                    <div className="sidebar-user">
                        <div className="sidebar-avatar">{initials}</div>
                        <div className="sidebar-user-info">
                            <div className="user-name">{user.name}</div>
                            <div className="user-role">
                                {user.role === 'admin' ? 'Admin' :
                                    user.role === 'finanzvorstand' ? 'Finanzvorstand' :
                                        user.role === 'eltern' ? 'Eltern' :
                                            user.role === 'springerin' ? 'Springer*in' :
                                                user.role === 'teammitglied' ? 'Teammitglied' : 'Vorstandsmitglied'}
                            </div>
                        </div>
                    </div>
                    <button className="sidebar-link" onClick={handleLogout}>
                        <span style={{ fontSize: '16px' }}>🚪</span>
                        Abmelden
                    </button>
                </div>
            </aside>
        </>
    );
}
