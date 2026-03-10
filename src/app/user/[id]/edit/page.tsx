import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { getUserById } from '@/lib/data';
import Sidebar from '@/components/Sidebar';
import UserEditClient from '@/components/UserEditClient';

export const metadata: Metadata = { title: 'Benutzer bearbeiten' };

export default async function UserEditPage({ params }: { params: Promise<{ id: string }> }) {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'member' | 'eltern' | 'springerin' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');

    const { id } = await params;
    const user = await getUserById(id);
    if (!user) notFound();

    // Nur Admin oder der User selbst darf bearbeiten
    const isSelf = user.email === email;
    if (role !== 'admin' && !isSelf) redirect('/user');

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _p, ...userWithoutPassword } = user;

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-body">
                    <div className="card" style={{ padding: '24px' }}>
                        <UserEditClient user={userWithoutPassword} currentUserRole={role} isSelf={isSelf} />
                    </div>
                </div>
            </main>
        </div>
    );
}
