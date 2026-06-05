import { renderTemplate } from './emailTemplateRenderer';
import { Resend } from 'resend';

/**
 * Options for sending (or dry-running) an email.
 */
export interface SendEmailOptions {
    /** Recipient email address */
    to: string;
    /** Email subject line */
    subject: string;
    /** Template name (without .html extension) from cloud-functions/templates/ */
    templateName: string;
    /** Key-value pairs to inject into the template placeholders */
    templateData: Record<string, string>;
    /**
     * When true, the template is rendered and returned as HTML
     * without making any network calls or sending any email.
     */
    dryRun?: boolean;
}

/**
 * Result from a sendEmail call.
 */
export interface SendEmailResult {
    success: boolean;
    /** Rendered HTML — only populated when dryRun is true */
    html?: string;
    /** Provider message/response — only populated when dryRun is false */
    messageId?: string;
    /** Error message if sending failed */
    error?: string;
}

/**
 * Sends an email using Resend, or performs a dry run
 * that renders the template and returns the HTML without sending.
 *
 * Dry-run mode is useful for:
 * - Testing template rendering in CI/CD
 * - Previewing emails in development
 * - Validating template data before sending
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const { to, subject, templateName, templateData, dryRun = false } = options;

    // Always render the template first (validates it exists + data is correct)
    let renderedHtml: string;
    try {
        renderedHtml = renderTemplate(templateName, {
            ...templateData,
            subject,
        });
    } catch (err) {
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
        const resend = new Resend(apiKey);
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
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
