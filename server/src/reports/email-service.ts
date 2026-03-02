/**
 * Email Service — Resend wrapper for pro forma PDF delivery
 *
 * Sends email with PDF attachment. Uses onboarding@resend.dev for sandbox,
 * switch to proforma@homium.io after domain verification.
 */

import { Resend } from 'resend';

// Lazy initialization — Resend throws if API key is missing at construction time.
// This prevents test failures when RESEND_API_KEY is not set.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM_EMAIL = process.env.PROFORMA_FROM_EMAIL || 'onboarding@resend.dev';
const FROM_NAME = 'Homium Pro Forma';

export async function sendProFormaEmail(
  to: string,
  programName: string,
  geoLabel: string,
  pdfBuffer: Buffer,
  recipientName?: string,
): Promise<{ id: string }> {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,';
  const filename = `${programName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-')}-Pro-Forma.pdf`;

  const { data, error } = await getResend().emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [to],
    subject: `${programName} — Pro Forma`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background: #1A2930; padding: 24px 32px; text-align: center;">
          <span style="font-family: Georgia, serif; font-size: 20px; color: #fff; letter-spacing: 2px;">HOMIUM</span>
        </div>
        <div style="padding: 32px;">
          <p style="font-size: 15px; line-height: 1.6;">${greeting}</p>
          <p style="font-size: 15px; line-height: 1.6;">
            Attached is your <strong>${programName}</strong> Pro Forma for ${geoLabel}.
            This document includes an executive summary, detailed assumptions, a 30-year projection table,
            and a home equity growth analysis.
          </p>
          <p style="font-size: 15px; line-height: 1.6;">
            This pro forma was generated using the Homium Fund Model and reflects the parameters
            you configured in Program Explorer.
          </p>
          <p style="font-size: 13px; color: #888; margin-top: 24px;">
            Questions? Reply to this email or contact your Homium representative.
          </p>
        </div>
        <div style="background: #f5f5f5; padding: 16px 32px; font-size: 11px; color: #999; text-align: center;">
          <p>This document contains forward-looking projections. Actual results may vary.<br/>Not an offer to sell securities. For qualified investors only.</p>
          <p style="margin-top: 8px;">Homium, Inc. &middot; Prepared via Program Explorer</p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename,
        content: pdfBuffer.toString('base64'),
        contentType: 'application/pdf',
      },
    ],
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }

  return { id: data!.id };
}
