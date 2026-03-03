'use client';

import { useState } from 'react';
import { generateAbrechnungPDF, User, AbrechnungTag } from '@/lib/pdf';

interface PDFOverviewButtonProps {
    user: User;
    monthLabel: string;
    tage: AbrechnungTag[];
    totalStunden: number;
    totalBetrag: number;
    abrechnungId?: string;
    jahr?: number;
    monat?: number;
}

export default function PDFOverviewButton({
    user,
    monthLabel,
    tage,
    totalStunden,
    totalBetrag,
    abrechnungId,
    jahr,
    monat
}: PDFOverviewButtonProps) {
    const [generating, setGenerating] = useState(false);

    const handleGenerate = async () => {
        setGenerating(true);
        const win = window.open('', '_blank');
        try {
            const url = await generateAbrechnungPDF(user, monthLabel, tage, totalStunden, totalBetrag, abrechnungId, jahr, monat);
            if (win) win.location.href = url;
        } catch (error) {
            console.error('Error generating PDF:', error);
            if (win) win.close();
            alert('Fehler beim Generieren des PDFs.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn btn-sm"
            style={{
                padding: '4px 10px',
                backgroundColor: 'var(--navy)',
                color: 'white'
            }}
        >
            {generating ? '...' : '📄 PDF'}
        </button>
    );
}
