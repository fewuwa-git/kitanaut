import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = { title: 'Zugriffsrechte' };

type Role = 'admin' | 'member' | 'eltern' | 'springerin';

const ROLE_LABELS: Record<Role, string> = {
    admin: 'Finanzvorstand (Admin)',
    member: 'Vorstandsmitglied',
    springerin: 'Springer*in',
    eltern: 'Eltern',
};

type NavItem = { href: string; label: string; section: string; roles: Role[] };

const ALL_PAGES: NavItem[] = [
    // Chat
    { href: '/chat', label: 'Chat', section: 'Chat', roles: ['admin', 'member', 'eltern', 'springerin'] },
    // Übersicht
    { href: '/dashboard', label: 'Kontostand', section: 'Übersicht', roles: ['admin', 'member'] },
    { href: '/kontoauszug', label: 'Kontoauszug', section: 'Übersicht', roles: ['admin', 'member'] },
    { href: '/categories', label: 'Kategorien', section: 'Übersicht', roles: ['admin', 'member'] },
    { href: '/dashboard/springerin', label: 'Springerin-Übersicht', section: 'Übersicht', roles: ['admin', 'member'] },
    { href: '/changelog', label: 'Changelog', section: 'Übersicht', roles: ['admin', 'member', 'springerin', 'eltern'] },
    // Springerin
    { href: '/springerin/abrechnung', label: 'Abrechnung', section: 'Springerin', roles: ['admin', 'springerin'] },
    { href: '/springerin/abrechnung/neu', label: 'Neue Abrechnung', section: 'Springerin', roles: ['admin', 'springerin'] },
    // Eltern
    { href: '/eltern/buchungen', label: 'Meine Buchungen', section: 'Eltern', roles: ['eltern', 'member', 'admin'] },
    { href: '/eltern/belege', label: 'Meine Belege', section: 'Eltern', roles: ['eltern', 'member', 'admin'] },
    { href: '/eltern/belege/neu', label: 'Neuer Beleg', section: 'Eltern', roles: ['eltern', 'member', 'admin'] },
    { href: '/eltern/belege/[id]/bearbeiten', label: 'Beleg bearbeiten', section: 'Eltern', roles: ['eltern', 'member', 'admin'] },
    // Upload
    { href: '/upload', label: 'Neuer Upload', section: 'Upload', roles: ['admin'] },
    // Verwaltung
    { href: '/user', label: 'Benutzer', section: 'Verwaltung', roles: ['admin', 'springerin', 'eltern', 'member'] },
    { href: '/user/[id]/edit', label: 'Profil bearbeiten', section: 'Verwaltung', roles: ['admin', 'springerin', 'eltern', 'member'] },
    { href: '/verwaltung/belege', label: 'Buchungsbelege', section: 'Verwaltung', roles: ['admin'] },
    { href: '/verwaltung/kategorien', label: 'Kategorien verwalten', section: 'Verwaltung', roles: ['admin'] },
    { href: '/verwaltung/kategorien/regeln', label: 'Kategorieregeln', section: 'Verwaltung', roles: ['admin'] },
    { href: '/verwaltung/kategorien/regeln/log', label: 'Regelprotokoll (KI)', section: 'Verwaltung', roles: ['admin'] },
    { href: '/verwaltung/emails', label: 'E-Mails', section: 'Verwaltung', roles: ['admin'] },
    { href: '/verwaltung/emails/[id]', label: 'E-Mail-Vorlage bearbeiten', section: 'Verwaltung', roles: ['admin'] },
    { href: '/verwaltung/zugriffsrechte', label: 'Zugriffsrechte', section: 'Verwaltung', roles: ['admin'] },
    { href: '/logfiles', label: 'Audit-Log', section: 'Verwaltung', roles: ['admin'] },
];

const ROLES: Role[] = ['admin', 'member', 'springerin', 'eltern'];

export default async function ZugriffsrechtePage() {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as Role | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'admin') redirect('/dashboard');

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Zugriffsrechte</h1>
                        <p>Übersicht, welche Rollen auf welche Seiten zugreifen dürfen</p>
                    </div>
                </div>
                <div className="page-body">
                    <div className="card" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 600 }}>Bereich</th>
                                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 600 }}>Seite</th>
                                    {ROLES.map(r => (
                                        <th key={r} style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                            {ROLE_LABELS[r]}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {ALL_PAGES.map((page, i) => (
                                    <tr
                                        key={page.href}
                                        style={{
                                            borderBottom: '1px solid var(--border)',
                                            background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
                                        }}
                                    >
                                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                            {page.section}
                                        </td>
                                        <td style={{ padding: '10px 14px', fontWeight: 500 }}>{page.label}</td>
                                        {ROLES.map(r => (
                                            <td key={r} style={{ textAlign: 'center', padding: '10px 14px' }}>
                                                {page.roles.includes(r) ? (
                                                    <span style={{ color: 'var(--success, #22c55e)', fontSize: '16px' }}>✓</span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted, #6b7280)', fontSize: '14px' }}>–</span>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
