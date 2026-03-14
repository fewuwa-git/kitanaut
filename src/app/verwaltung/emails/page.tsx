import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getEmailTemplates, getOrgById } from '@/lib/data';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = { title: 'E-Mail-Templates' };

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
    invite: 'Wird verschickt, wenn ein Admin einen neuen Benutzer per Einladungslink anlegt.',
    approval: 'Wird verschickt, wenn ein Admin einen selbst registrierten Account freischaltet.',
    password_reset: 'Wird verschickt, wenn ein Benutzer sein Passwort zurücksetzen möchte.',
};

export default async function EmailTemplatesPage() {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'member' | 'eltern' | 'springerin' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    const orgId = headersList.get('x-org-id') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'admin') redirect('/dashboard');

    const [templates, org] = await Promise.all([
        getEmailTemplates(orgId),
        getOrgById(orgId),
    ]);

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Template-Liste */}
                        {templates.map((t) => (
                            <div key={t.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 24px', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>{t.name}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                                        {TEMPLATE_DESCRIPTIONS[t.id] || ''}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        Betreff: <span style={{ color: 'var(--text)' }}>{t.subject}</span>
                                    </div>
                                </div>
                                <Link href={`/verwaltung/emails/${t.id}`} className="btn btn-secondary btn-sm">
                                    Bearbeiten
                                </Link>
                            </div>
                        ))}

                    {/* Setup-Infobox */}
                    <details className="card" style={{ padding: '20px 24px', background: 'var(--bg-secondary)' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '15px', userSelect: 'none' }}>
                            ℹ️ E-Mail-Setup – Wie funktioniert das?
                        </summary>
                        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '14px', lineHeight: '1.6' }}>

                            <div>
                                <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>Versanddienst</div>
                                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                                    E-Mails werden über <strong>Resend</strong> (resend.com) verschickt. Resend ist ein
                                    Transactional-Email-Dienst – er sorgt dafür, dass automatische E-Mails (Einladungen,
                                    Freischaltungen, Passwort-Reset, Abrechnungsbestätigungen) zuverlässig zugestellt werden.
                                </p>
                            </div>

                            <div>
                                <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>Login</div>
                                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                                    Anmeldung unter <strong>resend.com</strong> via <strong>GitHub</strong>.<br />
                                    Absenderadresse: <code style={{ background: 'var(--bg-secondary)', padding: '1px 6px', borderRadius: '4px' }}>{org?.from_email || 'no-reply@kitanaut.de'}</code>
                                </p>
                            </div>

                            <div>
                                <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>API-Key</div>
                                <p style={{ margin: '0 0 6px 0', color: 'var(--text-secondary)' }}>
                                    Der API-Key wird als Umgebungsvariable auf dem Server hinterlegt und nie im Code gespeichert:
                                </p>
                                <code style={{ background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: '4px', fontSize: '13px' }}>
                                    RESEND_API_KEY=re_…
                                </code>
                                <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                    Den aktuellen Key findest du in Vercel unter <strong>Settings → Environment Variables</strong> oder im Resend-Dashboard unter <strong>API Keys</strong>.
                                </p>
                            </div>

                            <div>
                                <div style={{ fontWeight: 700, marginBottom: '10px', color: 'var(--text)' }}>DNS-Einträge bei kitanaut.de</div>
                                <p style={{ margin: '0 0 12px 0', color: 'var(--text-secondary)' }}>
                                    Damit E-Mails nicht im Spam landen, wurden folgende DNS-Records gesetzt. Diese müssen beim DNS-Anbieter
                                    von kitanaut.de gepflegt bleiben:
                                </p>

                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                                                <th style={{ padding: '6px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Zweck</th>
                                                <th style={{ padding: '6px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Typ</th>
                                                <th style={{ padding: '6px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Name</th>
                                                <th style={{ padding: '6px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Inhalt</th>
                                                <th style={{ padding: '6px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Priorität</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                {
                                                    zweck: 'DKIM (Signatur)',
                                                    type: 'TXT',
                                                    name: 'resend._domainkey',
                                                    content: 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDNxku5BA2rTdN3S0camX2KgLkZ7gf4NhqItLtnIgZQFSbhLAuqEfM8hEhiaHNohK0peFc6J64WSkvbVMszLZd8/Yv68qCxVvkH7u0PMwEKrgZhZDtaZGquXhV87OyyAhliB1cltr2HFZ+V00XB3OWNI5rLn7e7htoR6kQaMcDZywIDAQAB',
                                                    priority: '–',
                                                },
                                                {
                                                    zweck: 'SPF (Bounce-Mail)',
                                                    type: 'MX',
                                                    name: 'send',
                                                    content: 'feedback-smtp.eu-west-1.amazonses.com',
                                                    priority: '10',
                                                },
                                                {
                                                    zweck: 'SPF (Berechtigung)',
                                                    type: 'TXT',
                                                    name: 'send',
                                                    content: 'v=spf1 include:amazonses.com ~all',
                                                    priority: '–',
                                                },
                                            ].map((row, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                                                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{row.zweck}</td>
                                                    <td style={{ padding: '8px 12px' }}><code style={{ background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: '3px' }}>{row.type}</code></td>
                                                    <td style={{ padding: '8px 12px' }}><code style={{ background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: '3px' }}>{row.name}</code></td>
                                                    <td style={{ padding: '8px 12px', maxWidth: '320px', wordBreak: 'break-all', color: 'var(--text-secondary)', fontSize: '11px' }}>{row.content}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{row.priority}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <p style={{ margin: '10px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                    <strong>DKIM</strong> signiert ausgehende E-Mails kryptografisch – Empfänger können prüfen, ob die Mail wirklich von uns stammt.<br />
                                    <strong>SPF</strong> legt fest, welche Server E-Mails im Namen von kitanaut.de versenden dürfen. Der MX-Eintrag leitet Bounce-Meldungen (nicht zustellbare Mails) zurück an Amazon SES, das Resend intern nutzt.<br /><br />
                                    DNS-Einträge werden verwaltet bei: <strong>Vercel</strong> (kitanaut.de läuft über Vercel-Nameserver)
                                </p>
                            </div>

                            <div>
                                <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>Was passiert beim Versand?</div>
                                <ol style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <li>Eine Aktion im System löst den Versand aus (z.B. Admin schaltet Nutzer frei)</li>
                                    <li>Das passende E-Mail-Template wird aus der Datenbank geladen</li>
                                    <li>Platzhalter wie <code style={{ background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: '3px' }}>{'{{name}}'}</code> werden durch echte Werte ersetzt</li>
                                    <li>Die fertige E-Mail wird über die Resend-API verschickt</li>
                                    <li>Resend übergibt sie an Amazon SES zur Zustellung</li>
                                </ol>
                            </div>

                        </div>
                    </details>

                    </div>
                </div>
            </main>
        </div>
    );
}
