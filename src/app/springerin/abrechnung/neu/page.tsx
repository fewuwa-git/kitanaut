import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserById, getUsers } from '@/lib/data';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Neue Abrechnung' };
import AbrechnungForm from '@/components/AbrechnungForm';

export default async function NeueAbrechnungPage({
    searchParams
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams;
    const initialYear = params.jahr ? parseInt(params.jahr as string) : undefined;
    const initialMonth = params.monat ? parseInt(params.monat as string) : undefined;
    const springerinId = params.springerinId as string | undefined;

    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'member' | 'eltern' | 'springerin' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'admin' && role !== 'springerin') redirect('/dashboard');

    const [currentUser, initialSpringer, allUsers] = await Promise.all([
        getUserById(userId),
        springerinId ? getUserById(springerinId) : Promise.resolve(undefined),
        role === 'admin' ? getUsers() : Promise.resolve(undefined),
    ]);

    if (!currentUser) redirect('/login');

    const springerList = allUsers?.filter(u => u.role === 'springerin');

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-body">
                    <div className="card" style={{ padding: '16px 24px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="page-header-left">
                            <h1>Neue Abrechnung</h1>
                            <p>Neue Abrechnung für Springer*innen erfassen</p>
                        </div>
                        <div className="page-header-actions">
                            <Link href="/springerin/abrechnung" className="btn btn-secondary">
                                Zurück
                            </Link>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title">Abrechnungsformular</h2>
                        </div>
                        <div className="card-body">
                            <AbrechnungForm
                                user={currentUser}
                                initialMonth={initialMonth}
                                initialYear={initialYear}
                                allSpringerinnen={springerList}
                                initialSpringer={initialSpringer}
                            />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
