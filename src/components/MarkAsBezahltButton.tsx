'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface MarkAsBezahltButtonProps {
    id: string;
    label: string;
    targetStatus: 'eingereicht' | 'bezahlt';
}

export default function MarkAsBezahltButton({ id, label, targetStatus }: MarkAsBezahltButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const isBezahlt = targetStatus === 'bezahlt';
    const confirmText = isBezahlt
        ? `Abrechnung "${label}" als bezahlt markieren?`
        : `Abrechnung "${label}" als eingereicht markieren?`;
    const buttonLabel = isBezahlt ? '✅ Bezahlt' : '📤 Einreichen';
    const btnClass = isBezahlt ? 'btn btn-sm btn-success' : 'btn btn-sm btn-primary';

    const handleClick = async () => {
        const confirmed = window.confirm(confirmText);
        if (!confirmed) return;

        setIsLoading(true);
        try {
            const res = await fetch('/api/abrechnungen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_status', id, status: targetStatus }),
            });

            if (res.ok) {
                router.refresh();
            } else {
                const errorData = await res.json();
                alert(`Fehler: ${errorData.error || 'Unbekannter Fehler'}`);
            }
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Ein Netzwerkfehler ist aufgetreten.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleClick}
            disabled={isLoading}
            className={btnClass}
            style={{ padding: '4px 10px', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1 }}
        >
            {isLoading ? '...' : buttonLabel}
        </button>
    );
}
