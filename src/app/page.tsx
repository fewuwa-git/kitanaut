import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function Home() {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role');

    if (userId) {
        if (role === 'springerin') redirect('/springerin/abrechnung');
        if (role === 'eltern') redirect('/eltern/buchungen');
        redirect('/dashboard');
    }
    redirect('/login');
}
