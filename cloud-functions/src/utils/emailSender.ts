import { renderTemplate } from './emailTemplateRenderer';

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
 * Sends an email using the EmailJS REST API, or performs a dry run
 * that renders the template and returns the HTML without sending.
 *
 * Dry-run mode is useful for:
 * - Testing template rendering in CI/CD
 * - Previewing emails in development
 * - Validating template data before sending
 */
export async function sendEmail(
  options: SendEmailOptions,
): Promise<SendEmailResult> {
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

  // ── Live send via EmailJS REST API ──
  const serviceId = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID || process.env.EMAILJS_SERVICE_ID;
  const publicKey = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY || process.env.EMAILJS_PUBLIC_KEY;
  const templateId = process.env.EMAILJS_TEMPLATE_ID || 'template_general';

  if (!serviceId || !publicKey) {
    return {
      success: false,
      error: 'EmailJS credentials (SERVICE_ID / PUBLIC_KEY) are not configured in environment variables.',
    };
  }

  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: {
      to_email: to,
      subject,
      ...templateData,
    },
  };

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const text = await response.text();
      return { success: true, messageId: text || 'OK' };
    }

    const errorText = await response.text();
    return { success: false, error: `EmailJS error (${response.status}): ${errorText}` };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
