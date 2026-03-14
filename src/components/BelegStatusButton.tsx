'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmModal from '@/components/ConfirmModal';
import type { Beleg } from '@/lib/data';

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
        label: '✅ Bezahlt',
        btnClass: 'btn btn-sm btn-success',
        title: 'Beleg als bezahlt markieren',
        message: (l) => `Möchtest du den Beleg „${l}" als bezahlt markieren?`,
        confirmLabel: '✅ Ja, als bezahlt markieren',
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

export default function BelegStatusButton({ id, label, targetStatus, beleg, orgAddress }: {
    id: string;
    label: string;
    targetStatus: TargetStatus;
    beleg?: Beleg;
    orgAddress?: string;
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
            if (res.ok) {
                setShowModal(false);

                if (targetStatus === 'bezahlt' && beleg) {
                    try {
                        const { generateBelegPDF } = await import('@/lib/belegPdf');
                        const blobUrl = await generateBelegPDF(beleg, orgAddress);
                        const blobRes = await fetch(blobUrl);
                        const blob = await blobRes.blob();
                        URL.revokeObjectURL(blobUrl);

                        const safeName = (beleg.belegnummer || beleg.titel).replace(/[^a-zA-Z0-9äöüÄÖÜß\-]/g, '_');
                        const file = new File([blob], `Beleg_${safeName}.pdf`, { type: 'application/pdf' });

                        const formData = new FormData();
                        formData.append('file', file);
                        await fetch('/api/receipts', { method: 'POST', body: formData });
                    } catch (pdfErr) {
                        console.error('PDF konnte nicht in Belegverwaltung hochgeladen werden:', pdfErr);
                    }
                }

                router.refresh();
            }
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
