'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const NAV_ITEMS = [
    { href: '/admin/dashboard', label: 'Alle Kitas' },
    { href: '/admin/kitas/neu', label: 'Neue Kita anlegen' },
    { href: '/admin/daks-scraper', label: 'DaKS Recherche' },
    { href: '/admin/reserved-slugs', label: 'Gesperrte Subdomains' },
    { href: '/admin/changelog', label: 'Changelog' },
    { href: '/admin/logfiles', label: 'Logfiles' },
    { href: '/admin/passwort', label: 'Passwort ändern' },
];

export default function AdminNav() {
    const router = useRouter();
    const pathname = usePathname();

    // Keine Nav auf der Login-Seite
    if (pathname === '/admin/login') return null;
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, []);

    async function handleLogout() {
        await fetch('/api/admin-auth', { method: 'DELETE' });
        router.push('/admin/login');
    }

    return (
        <>
            <nav style={{
                position: 'sticky',
                top: 0,
                zIndex: 100,
                background: 'var(--navy, #1e2a3a)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 1.5rem',
                height: '56px',
                gap: '0',
            }}>
                {/* Logo */}
                <a href="/admin/dashboard" style={{
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '15px',
                    textDecoration: 'none',
                    letterSpacing: '0.01em',
                    marginRight: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexShrink: 0,
                }}>
                    <span style={{
                        background: 'rgba(255,255,255,0.12)',
                        borderRadius: '6px',
                        padding: '3px 7px',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.75)',
                    }}>Admin</span>
                    Kitanaut
                </a>

                {/* Desktop links */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} className="admin-nav-desktop">
                    {NAV_ITEMS.map(item => {
                        const active = pathname === item.href;
                        return (
                            <a key={item.href} href={item.href} style={{
                                color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                                textDecoration: 'none',
                                fontSize: '13.5px',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                                fontWeight: active ? 600 : 400,
                                transition: 'background 0.15s, color 0.15s',
                                whiteSpace: 'nowrap',
                            }}
                                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            >
                                {item.label}
                            </a>
                        );
                    })}
                    <button onClick={handleLogout} style={{
                        marginLeft: '8px',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: '13px',
                        padding: '5px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'background 0.15s',
                    }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                    >
                        Abmelden
                    </button>
                </div>

                {/* Hamburger */}
                <div ref={menuRef} style={{ position: 'relative' }} className="admin-nav-hamburger">
                    <button
                        aria-label="Menü öffnen"
                        onClick={() => setOpen(o => !o)}
                        style={{
                            background: open ? 'rgba(255,255,255,0.12)' : 'transparent',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '6px',
                            padding: '7px 10px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            alignItems: 'center',
                        }}
                    >
                        {[0, 1, 2].map(i => (
                            <span key={i} style={{
                                display: 'block',
                                width: '18px',
                                height: '2px',
                                background: 'rgba(255,255,255,0.8)',
                                borderRadius: '2px',
                                transition: 'transform 0.2s, opacity 0.2s',
                                transform: open
                                    ? i === 0 ? 'translateY(6px) rotate(45deg)' : i === 2 ? 'translateY(-6px) rotate(-45deg)' : 'scaleX(0)'
                                    : 'none',
                                opacity: open && i === 1 ? 0 : 1,
                            }} />
                        ))}
                    </button>

                    {open && (
                        <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            right: 0,
                            background: 'var(--navy, #1e2a3a)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '10px',
                            padding: '6px',
                            minWidth: '220px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                            zIndex: 200,
                        }}>
                            {NAV_ITEMS.map(item => {
                                const active = pathname === item.href;
                                return (
                                    <a key={item.href} href={item.href} onClick={() => setOpen(false)} style={{
                                        display: 'block',
                                        padding: '9px 14px',
                                        borderRadius: '6px',
                                        color: active ? '#fff' : 'rgba(255,255,255,0.7)',
                                        textDecoration: 'none',
                                        fontSize: '14px',
                                        fontWeight: active ? 600 : 400,
                                        background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                                        transition: 'background 0.12s',
                                    }}
                                        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                                        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                    >
                                        {item.label}
                                    </a>
                                );
                            })}
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '6px 0' }} />
                            <button onClick={handleLogout} style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '9px 14px',
                                borderRadius: '6px',
                                color: 'rgba(255,255,255,0.6)',
                                fontSize: '14px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'background 0.12s',
                            }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                Abmelden
                            </button>
                        </div>
                    )}
                </div>
            </nav>

            <style>{`
                .admin-nav-desktop { display: flex; }
                .admin-nav-hamburger { display: none; }
                @media (max-width: 900px) {
                    .admin-nav-desktop { display: none !important; }
                    .admin-nav-hamburger { display: block !important; }
                }
            `}</style>
        </>
    );
}
