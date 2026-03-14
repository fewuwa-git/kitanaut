import { Resend } from 'resend';
import { getEmailTemplate, getOrgById } from './data';

const resend = new Resend(process.env.RESEND_API_KEY);
const FALLBACK_FROM = process.env.RESEND_FROM_EMAIL || 'no-reply@kitanaut.de';

function renderTemplate(body: string, vars: Record<string, string>): string {
    return Object.entries(vars).reduce(
        (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
        body
    );
}

async function sendEmail(templateId: string, to: string, vars: Record<string, string>, orgId: string): Promise<void> {
    const [template, org] = await Promise.all([
        getEmailTemplate(templateId, orgId),
        getOrgById(orgId),
    ]);
    if (!template) throw new Error(`E-Mail-Template "${templateId}" nicht gefunden`);

    if (org?.is_demo) {
        console.log('Demo-Modus: E-Mail nicht versendet');
        return;
    }

    const from = org?.from_email || FALLBACK_FROM;
    const subject = renderTemplate(template.subject, vars);
    const html = renderTemplate(template.body, vars);

    const { error } = await resend.emails.send({ from, to, subject, html });
    if (error) throw new Error('E-Mail konnte nicht gesendet werden: ' + error.message);
}

export async function sendInviteEmail(to: string, name: string, inviteUrl: string, orgId: string): Promise<void> {
    await sendEmail('invite', to, { name, url: inviteUrl }, orgId);
}

export async function sendApprovalEmail(to: string, name: string, loginUrl: string, orgId: string): Promise<void> {
    await sendEmail('approval', to, { name, url: loginUrl }, orgId);
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string, orgId: string): Promise<void> {
    await sendEmail('password_reset', to, { name, url: resetUrl }, orgId);
}

export async function sendAbrechnungBezahltEmail(
    to: string,
    name: string,
    monat: string,
    jahr: string,
    betrag: string,
    iban: string,
    orgId: string,
): Promise<void> {
    await sendEmail('abrechnung_bezahlt', to, { name, monat, jahr, betrag, iban }, orgId);
}
