import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { getEmailTemplate } from '@/lib/data';
import Sidebar from '@/components/Sidebar';
import EmailTemplateEditClient from '@/components/EmailTemplateEditClient';

export const metadata: Metadata = { title: 'E-Mail-Template bearbeiten' };

export default async function EmailTemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'member' | 'eltern' | 'springerin' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'admin') redirect('/dashboard');

    const { id } = await params;
    const template = await getEmailTemplate(id);
    if (!template) notFound();

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-body">
                    <div className="card" style={{ padding: '16px 24px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="page-header-left">
                            <h1>{template.name}</h1>
                            <p>E-Mail-Template bearbeiten</p>
                        </div>
                    </div>
                    <EmailTemplateEditClient template={template} />
                </div>
            </main>
        </div>
    );
}
