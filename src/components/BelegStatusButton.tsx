'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmModal from '@/components/ConfirmModal';

type TargetStatus = 'eingereicht' | 'bezahlt' | 'abgelehnt';

const CONFIG: Record<TargetStatus, {
    label: string;
    btnClass: string;
    title: string;
    message: (l: string) => string;
    confirmLabel: string;
    confirmClass: string;
}> = {
    eingereicht: {
        label: '📤 Einreichen',
        btnClass: 'btn btn-sm btn-primary',
        title: 'Beleg einreichen',
        message: (l) => `Möchtest du den Beleg „${l}" einreichen? Er kann danach nicht mehr bearbeitet werden.`,
        confirmLabel: '📤 Ja, einreichen',
        confirmClass: 'btn-primary',
    },
    bezahlt: {
        label: '💶 Als bezahlt markieren',
        btnClass: 'btn btn-sm btn-success',
        title: 'Beleg als bezahlt markieren',
        message: (l) => `Möchtest du den Beleg „${l}" als bezahlt markieren?`,
        confirmLabel: '💶 Ja, als bezahlt markieren',
        confirmClass: 'btn-success',
    },
    abgelehnt: {
        label: '❌ Ablehnen',
        btnClass: 'btn btn-sm btn-danger',
        title: 'Beleg ablehnen',
        message: (l) => `Möchtest du den Beleg „${l}" ablehnen?`,
        confirmLabel: '❌ Ja, ablehnen',
        confirmClass: 'btn-danger',
    },
};

export default function BelegStatusButton({ id, label, targetStatus }: {
    id: string;
    label: string;
    targetStatus: TargetStatus;
}) {
    const [showModal, setShowModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const cfg = CONFIG[targetStatus];

    const handleConfirm = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/belege/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: targetStatus }),
            });
            if (res.ok) { setShowModal(false); router.refresh(); }
            else alert('Fehler beim Aktualisieren des Status.');
        } catch {
            alert('Netzwerkfehler.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button onClick={() => setShowModal(true)} className={cfg.btnClass} style={{ padding: '4px 10px' }}>
                {cfg.label}
            </button>
            <ConfirmModal
                isOpen={showModal}
                title={cfg.title}
                message={cfg.message(label)}
                confirmLabel={cfg.confirmLabel}
                confirmClass={cfg.confirmClass}
                isLoading={isLoading}
                onConfirm={handleConfirm}
                onCancel={() => setShowModal(false)}
            />
        </>
    );
}
