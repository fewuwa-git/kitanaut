import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { getUserById, getUsers } from '@/lib/data';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
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

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) redirect('/login');

    const payload = await verifyToken(token);
    if (!payload) redirect('/login');

    // Allow both admin and springerin roles
    const isAuthorized = payload.role === 'admin' || payload.role === 'springerin';
    if (!isAuthorized) redirect('/dashboard');

    const currentUser = await getUserById(payload.userId);
    if (!currentUser) redirect('/login');

    const initialSpringer = springerinId ? await getUserById(springerinId) : undefined;

    const springerList = payload.role === 'admin'
        ? (await getUsers()).filter(u => u.role === 'springerin')
        : undefined;

    return (
        <div className="app-layout">
            <Sidebar user={{ name: payload.name, email: payload.email, role: payload.role }} />
            <main className="main-content">
                <div className="page-header">
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
                <div className="page-body">
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
