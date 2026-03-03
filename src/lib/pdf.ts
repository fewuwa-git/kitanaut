import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface User {
    id: string;
    name: string;
    email: string;
    strasse?: string;
    ort?: string;
    iban?: string;
    steuerid?: string;
    unterschrift?: string;
}

export interface AbrechnungTag {
    id?: string;
    datum: string;
    von: string;
    bis: string;
    stunden: number;
    stundensatz: number;
    betrag: number;
}

export const generateAbrechnungPDF = async (
    user: User,
    monthLabel: string,
    tage: AbrechnungTag[],
    totalStunden: number,
    totalBetrag: number,
    abrechnungId?: string,
    jahr?: number,
    monat?: number
): Promise<string> => {
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Design Tokens
    const COLORS = {
        navy: [26, 46, 69] as [number, number, number],
        primary: [254, 203, 47] as [number, number, number],
        bg: [240, 242, 245] as [number, number, number],
        textMuted: [107, 114, 128] as [number, number, number]
    };

    // Laufende Nummer
    const docYear = jahr ?? new Date().getFullYear();
    const docMonth = monat ?? (new Date().getMonth() + 1);
    const shortId = abrechnungId ? abrechnungId.replace(/-/g, '').slice(0, 6).toUpperCase() : 'XXXXXX';
    const docNumber = `ABR-${docYear}${String(docMonth).padStart(2, '0')}-${shortId}`;

    // Background Header Section
    doc.setFillColor(COLORS.bg[0], COLORS.bg[1], COLORS.bg[2]);
    doc.rect(0, 0, pageWidth, 52, 'F');

    // ─── Logo – ganz oben rechts, sehr klein ────────────────────────────────
    const logoWidth = 9;      // 50% von vorher (18 → 9)
    let logoHeight = 9;
    const logoPadRight = 5;
    const logoPadTop = 5;

    try {
        const img = new Image();
        img.src = '/logo.png';
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });
        logoHeight = (img.height / img.width) * logoWidth;
        doc.addImage(img, 'PNG', pageWidth - logoPadRight - logoWidth, logoPadTop, logoWidth, logoHeight);
    } catch (e) {
        console.error('Could not load logo for PDF', e);
    }

    // Startpunkt für Adressblöcke (Absender links, Empfänger rechts – gleiche Höhe)
    const addressY = logoPadTop + logoHeight + 5;

    // ─── Empfänger (rechts, unter Logo, linksbündig mit margin) ────────────
    const empfaengerX = pageWidth - margin;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    doc.text('EMPFÄNGER', empfaengerX, addressY, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
    doc.text('Pankonauten e.V.', empfaengerX, addressY + 5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Ravenéstr. 10', empfaengerX, addressY + 10, { align: 'right' });
    doc.text('13347 Berlin', empfaengerX, addressY + 15, { align: 'right' });

    // ─── Absender (links, gleiche Höhe wie Empfänger) ────────────────────────
    let y = addressY;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    doc.text('ABSENDER', margin, y);
    y += 5;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
    doc.text(user.name, margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (user.strasse) {
        doc.text(user.strasse, margin, y);
        y += 5;
    }
    if (user.ort) {
        doc.text(user.ort, margin, y);
        y += 5;
    }
    doc.text(user.email, margin, y);

    // ─── Titel + Laufende Nummer ─────────────────────────────────────────────
    const titleY = 65;

    // Accent line
    doc.setDrawColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.setLineWidth(1.5);
    doc.line(margin, titleY - 5, margin + 40, titleY - 5);

    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
    doc.text('Abrechnung', margin, titleY);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    doc.text(monthLabel, margin + 57, titleY - 1);

    // Laufende Nummer – eine Zeile, normal (nicht fett)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    doc.text(`Nr. ${docNumber}`, pageWidth - margin, titleY, { align: 'right' });

    let contentY = titleY + 12;

    // ─── Zahlungsinformationen ───────────────────────────────────────────────
    doc.setFillColor(252, 252, 252);
    doc.setDrawColor(240, 240, 240);
    doc.roundedRect(margin, contentY, 170, 15, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    doc.setFont('helvetica', 'normal');
    doc.text('ZAHLUNGSINFORMATIONEN', margin + 5, contentY + 6);

    doc.setFontSize(10);
    doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`IBAN: ${user.iban || 'N/A'}`, margin + 5, contentY + 11);
    doc.text(`Steuernummer: ${user.steuerid || 'N/A'}`, margin + 110, contentY + 11);

    contentY += 25;

    // ─── Tabelle ─────────────────────────────────────────────────────────────
    autoTable(doc, {
        startY: contentY,
        head: [['Datum', 'Zeitraum', 'Stunden', 'Betrag']],
        body: tage.map(t => {
            const date = new Date(t.datum);
            return [
                date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                `${t.von.slice(0, 5)} – ${t.bis.slice(0, 5)}`,
                `${t.stunden.toFixed(2)} h`,
                `${t.betrag.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`
            ];
        }),
        styles: {
            font: 'helvetica',
            fontSize: 10,
            cellPadding: 4,
        },
        headStyles: {
            fillColor: [240, 242, 245],
            textColor: COLORS.navy,
            fontStyle: 'bold',
            cellPadding: 5
        },
        alternateRowStyles: {
            fillColor: [252, 253, 255]
        },
        columnStyles: {
            0: { cellWidth: 30 },
            2: { halign: 'right' },
            3: { halign: 'right' },
        },
        didParseCell: (data) => {
            if (data.section === 'head' && (data.column.index === 2 || data.column.index === 3)) {
                data.cell.styles.halign = 'right';
            }
        },
        margin: { left: margin, right: margin },
        didDrawPage: () => {
            const footerY = pageHeight - 8;

            // Trennlinie
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.3);
            doc.line(margin, footerY - 12, pageWidth - margin, footerY - 12);

            // §3 Nr. 26 EStG
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
            doc.text(
                'Die steuerfreie Übungsleiterpauschale gemäß § 3 Nr. 26 EStG wird angewandt.',
                margin,
                footerY - 5
            );

            // Erstellungsdatum + Dok-Nr. (links)
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(
                `Erstellt am ${new Date().toLocaleDateString('de-DE')} · Pankonauten Finanzen · Nr. ${docNumber}`,
                margin,
                footerY
            );

            // Seitenzahl (rechts)
            doc.text(
                'Seite ' + doc.getNumberOfPages(),
                pageWidth - margin,
                footerY,
                { align: 'right' }
            );
        }
    });

    // ─── Zusammenfassung ─────────────────────────────────────────────────────
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const summaryWidth = 70;
    const summaryX = pageWidth - margin - summaryWidth;
    const stundensatz = tage[0]?.stundensatz || 0;

    doc.setFillColor(240, 242, 245);
    doc.setDrawColor(220, 222, 225);
    doc.rect(summaryX, finalY, summaryWidth, 40, 'FD');

    doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    doc.text('Gesamtstunden:', summaryX + 5, finalY + 10);
    doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
    doc.text(`${totalStunden.toFixed(2)} h`, summaryX + summaryWidth - 5, finalY + 10, { align: 'right' });

    doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    doc.text('Stundensatz:', summaryX + 5, finalY + 18);
    doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
    doc.text(`${stundensatz.toFixed(2)} €/h`, summaryX + summaryWidth - 5, finalY + 18, { align: 'right' });

    doc.setDrawColor(200, 202, 205);
    doc.line(summaryX + 5, finalY + 24, summaryX + summaryWidth - 5, finalY + 24);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
    doc.text('Auszahlung:', summaryX + 5, finalY + 33);
    doc.text(
        `${totalBetrag.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`,
        summaryX + summaryWidth - 5,
        finalY + 33,
        { align: 'right' }
    );

    // ─── Unterschrift ─────────────────────────────────────────────────────────
    const sigX = margin;
    const sigWidth = summaryX - margin - 10;
    const lineY = finalY + 35;

    if (user.unterschrift) {
        try {
            const img = new Image();
            img.src = user.unterschrift;
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });
            const maxH = 28;
            const maxW = sigWidth;
            const ratio = img.width / img.height;
            let drawW = maxH * ratio;
            let drawH = maxH;
            if (drawW > maxW) { drawW = maxW; drawH = drawW / ratio; }
            doc.addImage(img, 'PNG', sigX, finalY + 4, drawW, drawH);
        } catch (e) {
            console.error('Could not load signature for PDF', e);
        }
    }

    // Linie unter Unterschrift
    doc.setDrawColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
    doc.setLineWidth(0.4);
    doc.line(sigX, lineY, sigX + sigWidth, lineY);

    // Name unter Linie
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
    doc.text(user.name, sigX, lineY + 5);

    const pdfBlob = doc.output('blob');
    return URL.createObjectURL(pdfBlob);
};
