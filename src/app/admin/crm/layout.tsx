'use client';

import { usePathname } from 'next/navigation';

const SUB_NAV = [
    { href: '/admin/crm', label: 'Alle Kontakte' },
    { href: '/admin/crm/scraper', label: 'Import' },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div>
            <nav style={{
                background: 'var(--bg-secondary, #f8f9fa)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                gap: '4px',
                padding: '0 1.5rem',
            }}>
                {SUB_NAV.map(item => {
                    const active = pathname === item.href;
                    return (
                        <a
                            key={item.href}
                            href={item.href}
                            style={{
                                display: 'inline-block',
                                padding: '10px 14px',
                                fontSize: '13px',
                                fontWeight: active ? 600 : 400,
                                color: active ? 'var(--accent, #3b82f6)' : 'var(--text-muted)',
                                textDecoration: 'none',
                                borderBottom: active ? '2px solid var(--accent, #3b82f6)' : '2px solid transparent',
                                transition: 'color 0.15s',
                            }}
                            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-primary, #111)'; }}
                            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                        >
                            {item.label}
                        </a>
                    );
                })}
            </nav>
            {children}
        </div>
    );
}
