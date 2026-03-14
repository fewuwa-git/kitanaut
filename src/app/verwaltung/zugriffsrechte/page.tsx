import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = { title: 'Zugriffsrechte' };

type Role = 'admin' | 'finanzvorstand' | 'member' | 'eltern' | 'springerin' | 'teammitglied';

const ROLE_LABELS: Record<Role, string> = {
    admin: 'Admin',
    finanzvorstand: 'Finanzvorstand',
    member: 'Vorstandsmitglied',
    springerin: 'Springer*in',
    teammitglied: 'Teammitglied',
    eltern: 'Eltern',
};

type NavItem = { href: string; label: string; section: string; roles: Role[] };

const ALL_PAGES: NavItem[] = [
    // Chat
    { href: '/chat', label: 'Chat', section: 'Chat', roles: ['admin', 'finanzvorstand', 'member'] },
    // Übersicht
    { href: '/dashboard', label: 'Kontostand', section: 'Übersicht', roles: ['admin', 'finanzvorstand', 'member'] },
    { href: '/kontoauszug', label: 'Kontoauszug', section: 'Übersicht', roles: ['admin', 'finanzvorstand', 'member'] },
    { href: '/categories', label: 'Kategorien', section: 'Übersicht', roles: ['admin', 'finanzvorstand', 'member'] },
    { href: '/dashboard/springerin', label: 'Springerin-Übersicht', section: 'Übersicht', roles: ['admin', 'finanzvorstand', 'member'] },
    // Springerin
    { href: '/springerin/abrechnung', label: 'Abrechnung', section: 'Springerin', roles: ['admin', 'finanzvorstand', 'springerin'] },
    { href: '/springerin/abrechnung/neu', label: 'Neue Abrechnung', section: 'Springerin', roles: ['admin', 'finanzvorstand', 'springerin'] },
    // Eltern
    { href: '/eltern/buchungen', label: 'Meine Buchungen', section: 'Eltern', roles: ['eltern', 'teammitglied', 'finanzvorstand', 'member', 'admin'] },
    { href: '/eltern/belege', label: 'Meine Belege', section: 'Eltern', roles: ['eltern', 'teammitglied', 'finanzvorstand', 'member', 'admin'] },
    { href: '/eltern/belege/neu', label: 'Neuer Beleg', section: 'Eltern', roles: ['eltern', 'teammitglied', 'finanzvorstand', 'member', 'admin'] },
    { href: '/eltern/belege/[id]/bearbeiten', label: 'Beleg bearbeiten', section: 'Eltern', roles: ['eltern', 'teammitglied', 'finanzvorstand', 'member', 'admin'] },
    // Upload
    { href: '/upload', label: 'Neuer Upload', section: 'Upload', roles: ['admin', 'finanzvorstand'] },
    // Verwaltung
    { href: '/user', label: 'Benutzer', section: 'Verwaltung', roles: ['admin', 'finanzvorstand', 'springerin', 'teammitglied', 'eltern', 'member'] },
    { href: '/user/[id]/edit', label: 'Profil bearbeiten', section: 'Verwaltung', roles: ['admin', 'finanzvorstand', 'springerin', 'teammitglied', 'eltern', 'member'] },
    { href: '/verwaltung/belege', label: 'Buchungsbelege', section: 'Buchhaltung', roles: ['admin', 'finanzvorstand'] },
    { href: '/verwaltung/kategorien', label: 'Kategorien verwalten', section: 'Verwaltung', roles: ['admin', 'finanzvorstand'] },
    { href: '/verwaltung/kategorien/regeln', label: 'Kategorieregeln', section: 'Verwaltung', roles: ['admin', 'finanzvorstand'] },
    { href: '/verwaltung/kategorien/regeln/log', label: 'Regelprotokoll (KI)', section: 'Verwaltung', roles: ['admin', 'finanzvorstand'] },
    { href: '/verwaltung/emails', label: 'E-Mails', section: 'Verwaltung', roles: ['admin'] },
    { href: '/verwaltung/emails/[id]', label: 'E-Mail-Vorlage bearbeiten', section: 'Verwaltung', roles: ['admin'] },
    { href: '/verwaltung/kita', label: 'Kita-Profil', section: 'Verwaltung', roles: ['admin'] },
    { href: '/verwaltung/zugriffsrechte', label: 'Zugriffsrechte', section: 'Verwaltung', roles: ['admin'] },
    // CRM
    { href: '/admin/crm', label: 'CRM – Kontakte', section: 'CRM', roles: ['admin'] },
    { href: '/admin/crm/[id]', label: 'CRM – Kita-Detail', section: 'CRM', roles: ['admin'] },
    { href: '/admin/crm/statistik', label: 'CRM – Statistik', section: 'CRM', roles: ['admin'] },
    { href: '/admin/crm/scraper', label: 'CRM – Import', section: 'CRM', roles: ['admin'] },
];

const ROLES: Role[] = ['admin', 'finanzvorstand', 'member', 'springerin', 'teammitglied', 'eltern'];

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
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                        width: 22, height: 22, borderRadius: '50%',
                                                        background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 700,
                                                    }}>✓</span>
                                                ) : (
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                        width: 22, height: 22, borderRadius: '50%',
                                                        background: '#111827', color: '#fff', fontSize: 15, fontWeight: 700, lineHeight: 1,
                                                    }}>–</span>
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
