'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface SidebarProps {
    user: { name: string; email: string; role: string };
}

type NavItem = { href: string; icon: string; label: string; roles?: string[] };
type NavGroup = { section: string; items: NavItem[] };

const NAV_ITEMS: NavGroup[] = [
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
        section: 'VERWALTUNG',
        items: [
            { href: '/upload', icon: '⬆️', label: 'Upload', roles: ['admin'] },
            { href: '/user', icon: '👥', label: 'Benutzer', roles: ['admin', 'springerin', 'eltern', 'member'] },
            { href: '/verwaltung/kategorien', icon: '🏷️', label: 'Kategorien', roles: ['admin'] },
        ],
    },
];

export default function Sidebar({ user }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        setIsOpen(false);
    }, [pathname]);

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

                        return (
                            <div key={group.section}>
                                <div className="sidebar-section-label">{group.section}</div>
                                {visibleItems.map((item) => (
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
                    <a
                        href="/changelog"
                        className={`sidebar-link ${pathname === '/changelog' ? 'active' : ''}`}
                        style={{ fontSize: '12px', opacity: 0.6, marginTop: '2px' }}
                    >
                        <span style={{ fontSize: '14px' }}>📋</span>
                        Changelog
                    </a>
                </div>
            </aside>
        </>
    );
}
