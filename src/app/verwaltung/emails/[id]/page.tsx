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
    const orgId = headersList.get('x-org-id') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'admin') redirect('/dashboard');

    const { id } = await params;
    const template = await getEmailTemplate(id, orgId);
    if (!template) notFound();

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-body">
                    <EmailTemplateEditClient template={template} />
                </div>
            </main>
        </div>
    );
}
