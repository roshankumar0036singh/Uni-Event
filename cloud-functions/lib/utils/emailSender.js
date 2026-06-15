"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
const emailTemplateRenderer_1 = require("./emailTemplateRenderer");
const resend_1 = require("resend");
/**
 * Sends an email using Resend, or performs a dry run
 * that renders the template and returns the HTML without sending.
 *
 * Dry-run mode is useful for:
 * - Testing template rendering in CI/CD
 * - Previewing emails in development
 * - Validating template data before sending
 */
async function sendEmail(options) {
    const { to, subject, templateName, templateData, dryRun = false } = options;
    // Always render the template first (validates it exists + data is correct)
    let renderedHtml;
    try {
        renderedHtml = (0, emailTemplateRenderer_1.renderTemplate)(templateName, {
            ...templateData,
            subject,
        });
    }
    catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
    // ── Dry-run: return rendered HTML without sending ──
    if (dryRun) {
        return {
            success: true,
            html: renderedHtml,
        };
    }
    // Live send via Resend.
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return {
            success: false,
            error: 'Resend credentials (RESEND_API_KEY) are not configured in environment variables.',
        };
    }
    try {
        const resend = new resend_1.Resend(apiKey);
        const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_SENDER || 'onboarding@resend.dev',
            to: [to],
            subject,
            html: renderedHtml,
        });
        if (error) {
            return { success: false, error: error.message };
        }
        return { success: true, messageId: data?.id };
    }
    catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
