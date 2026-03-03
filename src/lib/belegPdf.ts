import jsPDF from 'jspdf';
import { Beleg } from './data';

// ─── Betrag in deutsche Wörter ────────────────────────────────────────────────
const EINER = ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun',
    'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const ZEHNER = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

function hundert(n: number): string {
    if (n === 0) return '';
    if (n < 20) return EINER[n];
    const z = Math.floor(n / 10);
    const e = n % 10;
    return e === 0 ? ZEHNER[z] : `${EINER[e]}und${ZEHNER[z]}`;
}

function dreisteller(n: number): string {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return (h > 0 ? `${EINER[h]}hundert` : '') + hundert(rest);
}

export function euroInWorte(betrag: number): string {
    const gerundet = Math.round(betrag * 100) / 100;
    const euro = Math.floor(gerundet);
    const cent = Math.round((gerundet - euro) * 100);

    let wort = '';
    if (euro >= 1000) {
        const t = Math.floor(euro / 1000);
        wort += `${dreisteller(t)}tausend`;
    }
    wort += dreisteller(euro % 1000);
    if (wort === '') wort = 'null';

    const euroWort = wort + ' Euro';
    if (cent === 0) return euroWort;
    return `${euroWort} und ${hundert(cent)} Cent`;
}

// ─── PDF generieren ───────────────────────────────────────────────────────────
export async function generateBelegPDF(beleg: Beleg): Promise<string> {
    // A5: 148 x 210 mm
    const doc = new jsPDF({ format: 'a5', orientation: 'portrait' });
    const W = doc.internal.pageSize.getWidth();   // 148
    // const H = doc.internal.pageSize.getHeight();  // 210
    const M = 10; // margin
    const col = W - M * 2; // 128

    // Avery Zweckform blue palette
    const BLUE: [number, number, number]       = [58, 107, 172];
    const BLUE_LIGHT: [number, number, number] = [197, 215, 240];
    const BLUE_MID: [number, number, number]   = [156, 190, 230];

    const setBlue = () => { doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]); doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]); };
    const line = (x1: number, y1: number, x2: number, y2: number) => { doc.setLineWidth(0.3); doc.line(x1, y1, x2, y2); };

    setBlue();

    const user = beleg.pankonauten_users;
    const brutto = beleg.betrag;
    const netto  = beleg.netto;
    const mwstSatz   = beleg.mwst_satz;
    const mwstBetrag = Math.round((brutto - netto) * 100) / 100;
    const hatMwst    = mwstSatz > 0;
    const betragFuerWorte = hatMwst ? brutto : netto;

    // ─── Titel oben rechts ───────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Ausgabebeleg', W - M, 10, { align: 'right' });

    // ─── Oberer Bereich: Adresse links | Beträge rechts ─────────────────────
    const topY   = 13;
    const leftW  = col * 0.56;   // ~72 mm
    const rightX = M + leftW;
    const rightW = col - leftW;  // ~56 mm

    // Rahmenlinien oben und unten des oberen Bereichs
    line(M, topY, W - M, topY);

    // Adresse (linke Spalte)
    let addrY = topY + 5;
    doc.setFontSize(9);
    if (user?.name) {
        doc.setFont('helvetica', 'bold');
        doc.text(user.name, M + 2, addrY);
        addrY += 5;
    }
    doc.setFont('helvetica', 'normal');
    if (user?.strasse) { doc.text(user.strasse, M + 2, addrY); addrY += 4.5; }
    if (user?.ort)     { doc.text(user.ort,     M + 2, addrY); addrY += 4.5; }
    if (!user?.strasse && !user?.ort) addrY += 4;

    // Beträge (rechte Spalte) – Netto, MwSt, Gesamt
    const amtRowH = 9;
    let ry = topY;

    // Netto-Zeile
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Netto EUR', rightX + 2, ry + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(netto.toLocaleString('de-DE', { minimumFractionDigits: 2 }), W - M - 2, ry + 5.5, { align: 'right' });
    ry += amtRowH;
    line(rightX, ry, W - M, ry);

    // MwSt-Zeile
    doc.setFont('helvetica', 'normal');
    if (hatMwst) {
        doc.text(`+ ${mwstSatz}% MwSt. EUR`, rightX + 2, ry + 5.5);
        doc.setFont('helvetica', 'bold');
        doc.text(mwstBetrag.toLocaleString('de-DE', { minimumFractionDigits: 2 }), W - M - 2, ry + 5.5, { align: 'right' });
    } else {
        doc.text('+ –  % MwSt./EUR', rightX + 2, ry + 5.5);
    }
    ry += amtRowH;
    line(rightX, ry, W - M, ry);

    // Gesamt-Zeile (blauer Hintergrund)
    doc.setFillColor(BLUE_MID[0], BLUE_MID[1], BLUE_MID[2]);
    doc.rect(rightX, ry, rightW, amtRowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Gesamt EUR', rightX + 2, ry + 5.5);
    doc.text(brutto.toLocaleString('de-DE', { minimumFractionDigits: 2 }), W - M - 2, ry + 5.5, { align: 'right' });
    ry += amtRowH;

    // Trennlinie zwischen linker und rechter Spalte
    line(rightX, topY, rightX, ry);

    // Untere Linie des oberen Bereichs
    const topEndY = Math.max(addrY + 4, ry);
    line(M, topEndY, W - M, topEndY);

    // ─── Nr.-Zeile ───────────────────────────────────────────────────────────
    const nrH  = 8;
    const nrY  = topEndY;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Nr.', M + 2, nrY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(beleg.belegnummer || '–', M + 14, nrY + 5.5);
    line(M, nrY + nrH, W - M, nrY + nrH);

    // ─── EUR in Worten (hellblauer Hintergrund) ──────────────────────────────
    const wortenY  = nrY + nrH;
    const wortenH  = 9;
    doc.setFillColor(BLUE_LIGHT[0], BLUE_LIGHT[1], BLUE_LIGHT[2]);
    doc.rect(M, wortenY, col, wortenH, 'F');

    // "EUR in Worten" links
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('EUR in Worten', M + 2, wortenY + wortenH / 2 + 2);

    // Betrag in Worten – eine Zeile
    const worte = euroInWorte(betragFuerWorte);
    const worteText = worte.charAt(0).toUpperCase() + worte.slice(1);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text(worteText, M + 40, wortenY + wortenH / 2 + 2);

    line(M, wortenY + wortenH, W - M, wortenY + wortenH);

    // ─── Für ─────────────────────────────────────────────────────────────────
    const fuerY = wortenY + wortenH;
    const fuerH = 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('für', M + 2, fuerY + 5);

    const fuerLines = doc.splitTextToSize(beleg.titel, col - 4);
    doc.setFont('helvetica', 'normal');
    doc.text(fuerLines, M + 2, fuerY + 11);

    const fuerEndY = Math.max(fuerY + fuerH, fuerY + 11 + fuerLines.length * 4.5 + 4);
    line(M, fuerEndY, W - M, fuerEndY);

    // ─── Zu Gunsten / Lasten ─────────────────────────────────────────────────
    const zuY = fuerEndY;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('zu Gunsten/Lasten', M + 2, zuY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Pankonauten e.V., Ravenéstraße 10, 13347 Berlin', M + 2, zuY + 10.5);
    doc.setFont('helvetica', 'normal');
    doc.text('dankend erhalten.', W - M - 2, zuY + 10.5, { align: 'right' });
    const zuEndY = zuY + 16;
    line(M, zuEndY, W - M, zuEndY);

    // ─── Ort / Datum ─────────────────────────────────────────────────────────
    const ortY = zuEndY;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Ort/Datum', M + 2, ortY + 5.5);
    const datumFormatiert = new Date(beleg.datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.setFont('helvetica', 'bold');
    doc.text(`Berlin, ${datumFormatiert}`, M + 30, ortY + 5.5);
    const ortEndY = ortY + 12;
    line(M, ortEndY, W - M, ortEndY);

    // ─── Buchungsvermerke | Stempel / Unterschrift ───────────────────────────
    const botY  = ortEndY;
    const botH  = 32;
    const sigX  = M + col / 2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Buchungsvermerke', M + 2, botY + 5.5);
    if (beleg.beschreibung) {
        doc.setFontSize(8);
        doc.text(beleg.beschreibung, M + 2, botY + 11);
    }
    doc.setFontSize(8.5);
    doc.text('Stempel/Unterschrift des Empfängers', sigX + 2, botY + 5.5);

    // Vertikale Trennlinie zwischen den zwei unteren Bereichen
    line(sigX, botY, sigX, botY + botH);

    // Unterschrift-Bild
    if (user?.unterschrift) {
        try {
            const img = new Image();
            img.src = user.unterschrift;
            await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
            const maxH  = 18;
            const maxW  = (W - M) - (sigX + 2);
            const ratio = img.width / img.height;
            let dW = maxH * ratio;
            let dH = maxH;
            if (dW > maxW) { dW = maxW; dH = dW / ratio; }
            doc.addImage(img, 'PNG', sigX + 2, botY + 8, dW, dH);
        } catch { /* leer */ }
    }

    // Unterschrift-Linie
    const sigLineY = botY + botH - 6;
    line(sigX + 2, sigLineY, W - M - 2, sigLineY);
    doc.setFontSize(7);
    doc.text(user?.name || '', sigX + 2, sigLineY + 4);

    // Rahmen unten
    line(M, botY + botH, W - M, botY + botH);
    // Linke und rechte Rahmenlinie
    line(M,     topY, M,     botY + botH);
    line(W - M, topY, W - M, botY + botH);

    return URL.createObjectURL(doc.output('blob'));
}
