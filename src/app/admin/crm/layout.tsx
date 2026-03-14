'use client';

import { usePathname } from 'next/navigation';

const SUB_NAV = [
    { href: '/admin/crm', label: 'Alle Kontakte' },
    { href: '/admin/crm/scraper', label: 'DaKS Import' },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div>
            <nav style={{
                background: 'rgba(0,0,0,0.15)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
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
                                color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                                textDecoration: 'none',
                                borderBottom: active ? '2px solid var(--accent, #3b82f6)' : '2px solid transparent',
                                transition: 'color 0.15s',
                            }}
                            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)'; }}
                            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)'; }}
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
