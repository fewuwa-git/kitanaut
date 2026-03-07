'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import ImpersonationBar from './ImpersonationBar';

interface SidebarProps {
    user: { name: string; email: string; role: string };
}

type NavItem = { href: string; icon: string; label: string; roles?: string[] };
type NavGroup = { section: string; items: NavItem[] };

const NAV_ITEMS: NavGroup[] = [
    {
        section: 'CHAT',
        items: [
            { href: '/chat', icon: '💬', label: 'Chat', roles: ['admin', 'member', 'eltern', 'springerin'] },
        ],
    },
    {
        section: 'ÜBERSICHT',
        items: [
            { href: '/dashboard', icon: '📊', label: 'Kontostand', roles: ['admin', 'member'] },
            { href: '/kontoauszug', icon: '📝', label: 'Kontoauszug', roles: ['admin', 'member'] },
            { href: '/categories', icon: '📂', label: 'Kategorien', roles: ['admin', 'member'] },
            { href: '/dashboard/springerin', icon: '👩‍🏫', label: 'Springerin', roles: ['admin', 'member'] },
        ],
    },
    {
        section: 'SPRINGERIN',
        items: [
            { href: '/springerin/abrechnung', icon: '🧾', label: 'Abrechnung', roles: ['admin', 'springerin'] },
        ],
    },
    {
        section: 'ELTERN',
        items: [
            { href: '/eltern/belege', icon: '🧾', label: 'Meine Belege', roles: ['eltern', 'member', 'admin'] },
            { href: '/eltern/buchungen', icon: '📒', label: 'Meine Buchungen', roles: ['eltern', 'member', 'admin'] },
        ],
    },
    {
        section: 'UPLOAD',
        items: [
            { href: '/upload', icon: '⬆️', label: 'Neuer Upload', roles: ['admin'] },
        ],
    },
    {
        section: 'VERWALTUNG',
        items: [
            { href: '/user', icon: '👥', label: 'Benutzer', roles: ['admin', 'springerin', 'eltern', 'member'] },
            { href: '/verwaltung/kategorien', icon: '🏷️', label: 'Kategorien', roles: ['admin'] },
            { href: '/verwaltung/belege', icon: '📎', label: 'Buchungsbelege', roles: ['admin'] },
            { href: '/verwaltung/emails', icon: '✉️', label: 'E-Mails', roles: ['admin'] },
            { href: '/verwaltung/zugriffsrechte', icon: '🔐', label: 'Zugriffsrechte', roles: ['admin'] },
        ],
    },
];

const COLLAPSIBLE_SECTIONS = ['VERWALTUNG'];

export default function Sidebar({ user }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(COLLAPSIBLE_SECTIONS));

    useEffect(() => {
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const initials = user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <>
            <ImpersonationBar />
            <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(false)} />

            <div className="mobile-header">
                <button className="mobile-menu-btn" onClick={() => setIsOpen(true)}>
                    <span style={{ fontSize: '24px' }}>☰</span>
                </button>
            </div>

            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
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
                                {user.role === 'admin' ? 'Finanzvorstand' :
                                    user.role === 'eltern' ? 'Eltern' :
                                        user.role === 'springerin' ? 'Springer*in' : 'Vorstandsmitglied'}
                            </div>
                        </div>
                    </div>
                    <button className="sidebar-link" onClick={handleLogout}>
                        <span style={{ fontSize: '16px' }}>🚪</span>
                        Abmelden
                    </button>
                    {(user.role === 'admin' || user.role === 'member') && (
                        <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                            <a
                                href="/changelog"
                                className={`sidebar-link ${pathname === '/changelog' ? 'active' : ''}`}
                                style={{ fontSize: '11px', opacity: 0.4, flex: 1 }}
                            >
                                <span style={{ fontSize: '12px' }}>📋</span>
                                Changelog
                            </a>
                            {user.role === 'admin' && (
                                <a
                                    href="/logfiles"
                                    className={`sidebar-link ${pathname === '/logfiles' ? 'active' : ''}`}
                                    style={{ fontSize: '11px', opacity: 0.4, flex: 1 }}
                                >
                                    <span style={{ fontSize: '12px' }}>🗒️</span>
                                    Logfiles
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
