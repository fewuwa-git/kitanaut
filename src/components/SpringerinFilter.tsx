'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { User } from '@/lib/data';

const MONTH_NAMES = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

interface SpringerinFilterProps {
    springerinnen: User[];
    availableJahre: number[];
    isAdmin: boolean;
    newButtonHref?: string;
}

export default function SpringerinFilter({ springerinnen, availableJahre, isAdmin, newButtonHref }: SpringerinFilterProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentSpringerId = searchParams.get('springerinId') || '';
    const currentMonat = searchParams.get('monat') || '';
    const currentJahr = searchParams.get('jahr') || '';

    const updateParam = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        router.push(`?${params.toString()}`);
    };

    return (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '8px' }}>
                <div className="card-title">🔍 Filter</div>
                <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
                    {isAdmin && (
                        <select
                            value={currentSpringerId}
                            onChange={(e) => updateParam('springerinId', e.target.value)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--card-bg)', fontSize: '14px', minWidth: '180px' }}
                        >
                            <option value="">Alle Springerinnen</option>
                            {springerinnen.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    )}
                    <select
                        value={currentMonat}
                        onChange={(e) => updateParam('monat', e.target.value)}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--card-bg)', fontSize: '14px', minWidth: '130px' }}
                    >
                        <option value="">Alle Monate</option>
                        {MONTH_NAMES.map((name, i) => (
                            <option key={i + 1} value={String(i + 1)}>{name}</option>
                        ))}
                    </select>
                    <select
                        value={currentJahr}
                        onChange={(e) => updateParam('jahr', e.target.value)}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--card-bg)', fontSize: '14px', minWidth: '90px' }}
                    >
                        <option value="">Alle Jahre</option>
                        {availableJahre.map(y => (
                            <option key={y} value={String(y)}>{y}</option>
                        ))}
                    </select>
                    <select
                        value={searchParams.get('status') || ''}
                        onChange={(e) => updateParam('status', e.target.value)}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--card-bg)', fontSize: '14px', minWidth: '130px' }}
                    >
                        <option value="">Alle Status</option>
                        <option value="entwurf">Entwurf</option>
                        <option value="eingereicht">Eingereicht</option>
                        <option value="bezahlt">Bezahlt</option>
                    </select>
                    {newButtonHref && (
                        <Link href={newButtonHref} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                            ➕ Neue Abrechnung
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
